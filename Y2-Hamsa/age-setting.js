/*
 * Mirrors the "listing age on the map" setting (chrome.storage.sync `maxAgeDays`, 0 = off)
 * into data-y2ha-max-age on <html>, so map-filter.js in the page's MAIN world can read it.
 */
(() => {
  'use strict';
  const KEY = 'maxAgeDays';
  const apply = (days) => { document.documentElement.dataset.y2haMaxAge = String(Number(days) || 0); };
  chrome.storage.sync.get({ [KEY]: 0 }, (s) => apply(s[KEY]));
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes[KEY]) apply(changes[KEY].newValue);
  });
})();
