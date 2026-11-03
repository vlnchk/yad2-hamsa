/*
 * Map filter for Yad2 real estate (runs in the page's MAIN world).
 *
 * The map gets its data from gw.yad2.co.il/realestate-feed/<rent|forsale>/map
 * through XMLHttpRequest. Every marker carries adType: "private" | "commercial".
 * We rewrite the response before the page reads it.
 *
 * Toggles follow the classes and attributes that the content scripts put on <html>:
 *   y2ha-re          -> drop commercial markers + agencyPromotions
 *   y2ha-yad1        -> drop yad1Markers, yad1Promotions, grayMarkers (developer projects)
 *   y2ha-anyshelter  -> "any protected space": instead of one request we make three
 *                       (shelter=1 / floorShelter=1 / buildingShelter=1, i.e. ממ"ד / ממ"ק /
 *                       מקלט בבניין) and merge them, so the map shows OR instead of AND.
 *   data-y2ha-max-age="N" -> drop markers published more than N days ago (0 = off),
 *                       see listingTime(). Markers with no known date are kept.
 *
 * clusters[] (neighborhood bubbles with docCount) are server aggregates with no
 * private/commercial split. With "any shelter" their counts are summed across the
 * three requests, so a listing with several shelter types is counted more than once.
 */
(() => {
  'use strict';

  const MAP_URL = /\/realestate-feed\/[^/?#]+\/map(?:[?#]|$)/;
  const SHELTER_PARAMS = ['shelter', 'floorShelter', 'buildingShelter'];
  const DAY_MS = 24 * 60 * 60 * 1000;
  const root = document.documentElement;

  /* ---------- pure data helpers ---------- */

  // Photo URLs carry the upload time (Israel local time):
  //   .../Pic/202610/22/2_2/o/y2_1pa_010371_20261022191850.jpeg
  const IMAGE_TIME = /_(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\.\w+(?:[?#]|$)/;
  const IMAGE_DAY = /\/Pic\/(\d{4})(\d{2})\/(\d{2})\//;

  const imageTime = (url) => {
    const s = String(url || '');
    let m = IMAGE_TIME.exec(s);
    if (m) return new Date(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +m[6]).getTime();
    m = IMAGE_DAY.exec(s);
    return m ? new Date(+m[1], m[2] - 1, +m[3]).getTime() : null;
  };

  // When the listing was first published (ms), or null if unknown.
  // dates.approvedAt comes only on some markers; otherwise the earliest photo upload,
  // which is minutes before approval. A bump (הקפצה) changes neither of them.
  const listingTime = (m) => {
    const approved = m && m.dates && Date.parse(m.dates.approvedAt);
    if (approved) return approved;
    const meta = (m && m.metaData) || {};
    let min = null;
    for (const u of [meta.coverImage, ...(Array.isArray(meta.images) ? meta.images : [])]) {
      const t = imageTime(u);
      if (t && (min === null || t < min)) min = t;
    }
    return min;
  };

  const filterData = (data, opts) => {
    if (!data || typeof data !== 'object') return { data, hidden: 0 };
    let hidden = 0;
    const out = { ...data };
    if (opts.brokers) {
      if (Array.isArray(out.markers)) {
        const before = out.markers.length;
        out.markers = out.markers.filter((m) => !m || m.adType !== 'commercial');
        hidden += before - out.markers.length;
      }
      if (Array.isArray(out.agencyPromotions)) {
        hidden += out.agencyPromotions.length;
        out.agencyPromotions = [];
      }
    }
    if (opts.projects) {
      for (const k of ['yad1Markers', 'yad1Promotions', 'grayMarkers']) {
        if (Array.isArray(out[k])) {
          hidden += out[k].length;
          out[k] = [];
        }
      }
    }
    if (opts.maxAgeDays > 0 && Array.isArray(out.markers)) {
      const cutoff = (opts.now || Date.now()) - opts.maxAgeDays * DAY_MS;
      const before = out.markers.length;
      out.markers = out.markers.filter((m) => {
        const t = listingTime(m);
        return t === null || t >= cutoff;
      });
      hidden += before - out.markers.length;
    }
    return { data: out, hidden };
  };

  const itemKey = (x) =>
    (x && (x.token || x.listingId || x.projectId)) || JSON.stringify(x);

  // Union of several map responses ({data: {...}, message}) into one.
  const mergeResponses = (responses) => {
    const first = responses[0] || {};
    const out = {};
    for (const r of responses) {
      const d = (r && r.data) || {};
      for (const [k, v] of Object.entries(d)) {
        if (!Array.isArray(v)) { if (!(k in out)) out[k] = v; continue; }
        if (k === 'clusters') {
          const byKey = (out._clusters = out._clusters || new Map());
          for (const c of v) {
            const prev = byKey.get(c.key);
            if (prev) prev.docCount = (prev.docCount || 0) + (c.docCount || 0);
            else byKey.set(c.key, { ...c });
          }
          continue;
        }
        const seen = (out['_seen_' + k] = out['_seen_' + k] || new Map());
        for (const item of v) {
          const id = itemKey(item);
          if (!seen.has(id)) seen.set(id, item);
        }
      }
    }
    const data = {};
    for (const [k, v] of Object.entries(out)) {
      if (k === '_clusters') data.clusters = [...v.values()];
      else if (k.startsWith('_seen_')) data[k.slice(6)] = [...v.values()];
      else data[k] = v;
    }
    return { ...first, data };
  };

  const shelterUrls = (href) => {
    const base = new URL(href, location.href);
    SHELTER_PARAMS.forEach((p) => base.searchParams.delete(p));
    return SHELTER_PARAMS.map((p) => {
      const u = new URL(base);
      u.searchParams.set(p, '1');
      return u.href;
    });
  };

  /* ---------- settings ---------- */

  const currentOpts = () => ({
    brokers: root.classList.contains('y2ha-re'),
    projects: root.classList.contains('y2ha-yad1'),
    anyShelter: root.classList.contains('y2ha-anyshelter'),
    maxAgeDays: Number(root.dataset.y2haMaxAge) || 0
  });

  // Returns the filtered body in the same form it came in (string or object).
  const filterBody = (body) => {
    const opts = currentOpts();
    if (!opts.brokers && !opts.projects && !opts.maxAgeDays) return body;
    try {
      const isString = typeof body === 'string';
      const parsed = isString ? JSON.parse(body) : body;
      if (!parsed || typeof parsed !== 'object' || !parsed.data) return body;
      const { data, hidden } = filterData(parsed.data, opts);
      root.dataset.y2haMapHidden = String(hidden);
      const result = { ...parsed, data };
      return isString ? JSON.stringify(result) : result;
    } catch (_) {
      return body; // never break the site
    }
  };

  const origFetch = window.fetch;

  // Fetches the three shelter variants and returns the merged JSON text.
  const fetchAnyShelter = async (href, headers, credentials) => {
    const results = await Promise.all(shelterUrls(href).map(async (u) => {
      const res = await origFetch.call(window, u, { method: 'GET', headers, credentials, mode: 'cors' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }));
    return JSON.stringify(mergeResponses(results));
  };

  /* ---------- XMLHttpRequest ---------- */

  const XHR = XMLHttpRequest.prototype;
  const origOpen = XHR.open;
  const origSend = XHR.send;
  const origSetHeader = XHR.setRequestHeader;
  const textDesc = Object.getOwnPropertyDescriptor(XHR, 'responseText');
  const respDesc = Object.getOwnPropertyDescriptor(XHR, 'response');
  const meta = new WeakMap(); // xhr -> { href, method, headers }

  const installFilterGetters = (xhr) => {
    let cachedSrc;
    let cachedOut;
    const filtered = (raw) => {
      if (xhr.readyState !== 4) return raw;
      if (raw !== cachedSrc) {
        cachedSrc = raw;
        cachedOut = filterBody(raw);
      }
      return cachedOut;
    };
    Object.defineProperty(xhr, 'responseText', {
      configurable: true,
      get: () => filtered(textDesc.get.call(xhr))
    });
    Object.defineProperty(xhr, 'response', {
      configurable: true,
      get: () => {
        const raw = respDesc.get.call(xhr);
        const t = xhr.responseType;
        return (t === '' || t === 'text' || t === 'json') ? filtered(raw) : raw;
      }
    });
  };

  // Completes an XHR with our own body instead of a network response.
  const fakeComplete = (xhr, href, text) => {
    const body = filterBody(text);
    const asText = typeof body === 'string' ? body : JSON.stringify(body);
    const def = (name, value) => Object.defineProperty(xhr, name, { configurable: true, get: () => value });
    def('readyState', 4);
    def('status', 200);
    def('statusText', 'OK');
    def('responseURL', href);
    def('responseText', asText);
    def('response', xhr.responseType === 'json' ? JSON.parse(asText) : asText);
    xhr.getAllResponseHeaders = () => 'content-type: application/json\r\n';
    xhr.getResponseHeader = (n) => (String(n).toLowerCase() === 'content-type' ? 'application/json' : null);
    for (const type of ['readystatechange', 'load', 'loadend']) {
      xhr.dispatchEvent(new ProgressEvent(type, { lengthComputable: true, loaded: asText.length, total: asText.length }));
    }
  };

  XHR.open = function (method, url, ...rest) {
    try {
      const href = String(url && url.href ? url.href : url);
      if (MAP_URL.test(href)) {
        meta.set(this, { href, method: String(method).toUpperCase(), headers: {} });
        installFilterGetters(this);
      }
    } catch (_) { /* ignore */ }
    return origOpen.call(this, method, url, ...rest);
  };

  XHR.setRequestHeader = function (name, value) {
    const m = meta.get(this);
    if (m) m.headers[name] = value;
    return origSetHeader.call(this, name, value);
  };

  XHR.send = function (body) {
    const m = meta.get(this);
    if (!m || m.method !== 'GET' || !currentOpts().anyShelter || typeof origFetch !== 'function') {
      return origSend.call(this, body);
    }
    const credentials = this.withCredentials ? 'include' : 'same-origin';
    fetchAnyShelter(m.href, m.headers, credentials)
      .then((text) => fakeComplete(this, new URL(m.href, location.href).href, text))
      .catch(() => origSend.call(this, body)); // fall back to the normal request
  };

  /* ---------- fetch (in case Yad2 switches transports) ---------- */

  if (typeof origFetch === 'function') {
    window.fetch = async function (input, init) {
      const href = typeof input === 'string' ? input : (input && input.url) || String(input);
      const isMap = MAP_URL.test(href);
      const method = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();
      if (isMap && method === 'GET' && currentOpts().anyShelter) {
        try {
          const text = await fetchAnyShelter(href, (init && init.headers) || {}, (init && init.credentials) || 'same-origin');
          const out = filterBody(text);
          return new Response(out, { status: 200, headers: { 'content-type': 'application/json' } });
        } catch (_) { /* fall through to the normal request */ }
      }
      const res = await origFetch.call(this, input, init);
      try {
        if (!isMap || !res.ok) return res;
        const text = await res.clone().text();
        const out = filterBody(text);
        if (out === text) return res;
        return new Response(out, { status: res.status, statusText: res.statusText, headers: res.headers });
      } catch (_) {
        return res;
      }
    };
  }

  // exported for tests only
  if (typeof globalThis.__Y2HA_TEST__ === 'object') {
    Object.assign(globalThis.__Y2HA_TEST__, { filterData, mergeResponses, shelterUrls, listingTime });
  }
})();
