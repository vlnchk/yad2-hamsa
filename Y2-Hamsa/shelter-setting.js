/*
 * Mirrors the "any protected space" setting (chrome.storage.sync `anyShelter`)
 * into a class on <html>, so map-filter.js in the page's MAIN world can read it.
 */
(() => {
  'use strict';
  const KEY = 'anyShelter';
  const apply = (on) => document.documentElement.classList.toggle('y2ha-anyshelter', on === true);
  chrome.storage.sync.get({ [KEY]: false }, (s) => apply(s[KEY]));
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes[KEY]) apply(changes[KEY].newValue);
  });
})();
