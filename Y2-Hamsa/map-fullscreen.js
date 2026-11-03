/*
 * Full-screen map for Yad2 real-estate search pages.
 *
 * Yad2 shows the results list and the map side by side. When the setting is on,
 * the map column is pinned over the whole viewport below the search bar.
 * A button on the map switches between full map and the normal split view;
 * the choice is saved (chrome.storage.sync, key mapFullscreen).
 *
 * Yad2's own class names are hashed CSS modules that change between deploys,
 * so the map column is found from Mapbox's stable `.mapboxgl-map` container:
 * we climb up while the ancestors have the same width as the map.
 */
(() => {
  'use strict';

  const KEY = 'mapFullscreen';
  const FEED_PATH = /^\/realestate\/(rent|forsale|commercial)(\/|$)/;
  const root = document.documentElement;

  let enabled = true;
  let lang = y2haLang('');
  let active = false;
  let pane = null;      // the map column we pin
  let chain = [];       // elements between pane and the map, stretched to fill
  let btn = null;
  let scheduled = false;

  const resizeSoon = () => {
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    setTimeout(() => window.dispatchEvent(new Event('resize')), 250);
  };

  const findPane = (map) => {
    const r = map.getBoundingClientRect();
    if (r.width < 300 || r.height < 200) return null;
    const path = [];
    let el = map;
    while (el.parentElement && el.parentElement !== document.body) {
      const p = el.parentElement.getBoundingClientRect();
      if (Math.abs(p.width - r.width) > 4) break;
      el = el.parentElement;
      path.push(el);
    }
    // path = ancestors from just above the map up to the column itself
    return { pane: el, chain: [map, ...path.slice(0, -1)] };
  };

  const deactivate = () => {
    if (pane) pane.classList.remove('y2ha-map-full');
    chain.forEach((el) => el.classList.remove('y2ha-map-fill'));
    root.classList.remove('y2ha-map-full-on');
    if (active) resizeSoon();
    active = false;
  };

  const activate = () => {
    if (!pane || active) return;
    window.scrollTo({ top: 0, behavior: 'instant' });
    const top = Math.max(0, Math.round(pane.getBoundingClientRect().top));
    root.style.setProperty('--y2ha-map-top', top + 'px');
    pane.classList.add('y2ha-map-full');
    chain.forEach((el) => el.classList.add('y2ha-map-fill'));
    root.classList.add('y2ha-map-full-on');
    active = true;
    resizeSoon();
  };

  const updateButton = () => {
    if (!btn) return;
    const s = Y2HA_I18N[lang];
    btn.dir = s.dir;
    btn.textContent = active ? s.btnList : s.btnFull;
    btn.title = active ? s.btnListTitle : s.btnFullTitle;
  };

  const addButton = (map) => {
    if (btn && btn.isConnected && map.contains(btn)) return;
    btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'y2ha-map-btn';
    for (const ev of ['mousedown', 'mouseup', 'click', 'dblclick', 'touchstart', 'pointerdown', 'wheel']) {
      btn.addEventListener(ev, (e) => e.stopPropagation());
    }
    btn.addEventListener('click', () => {
      enabled = !active;
      chrome.storage.sync.set({ [KEY]: enabled });
      sync();
    });
    map.appendChild(btn);
  };

  const sync = () => {
    scheduled = false;
    const map = FEED_PATH.test(location.pathname) && document.querySelector('.mapboxgl-map');
    if (!map) {
      deactivate();
      pane = null; chain = [];
      return;
    }

    // React may have replaced the nodes: rebuild if our pane is gone
    if (!pane || !pane.isConnected || !pane.contains(map)) {
      deactivate();
      const found = findPane(map);
      if (!found) return;
      ({ pane, chain } = found);
    }

    addButton(map);
    if (enabled) activate(); else deactivate();
    updateButton();
  };

  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(sync);
  };

  chrome.storage.sync.get({ [KEY]: true, uiLang: '' }, (s) => {
    enabled = s[KEY] !== false;
    lang = y2haLang(s.uiLang);
    new MutationObserver(schedule).observe(root, { childList: true, subtree: true });
    schedule();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    if (changes.uiLang) {
      lang = y2haLang(changes.uiLang.newValue);
      updateButton();
    }
    if (changes[KEY]) {
      enabled = changes[KEY].newValue !== false;
      schedule();
    }
  });
})();
