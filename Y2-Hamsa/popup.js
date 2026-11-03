'use strict';

const HIDE_DEFAULTS = {
  hideRealestateBrokers: true,
  hideNewProjects: true
};
const DEFAULTS = { ...HIDE_DEFAULTS, mapFullscreen: true, anyShelter: false, maxAgeDays: 0, uiLang: '' };
const SWITCHES = ['hideRealestateBrokers', 'hideNewProjects', 'mapFullscreen', 'anyShelter'];
const HIDE_KEYS = Object.keys(HIDE_DEFAULTS);

const stat = document.getElementById('stat');
const maxAge = document.getElementById('maxAgeDays');
const IS_YAD2 = /^https?:\/\/([a-z0-9-]+\.)*yad2\.co\.il\//i;

let lang = y2haLang('');
const t = () => Y2HA_I18N[lang];

const applyLang = () => {
  const s = t();
  document.documentElement.lang = lang;
  document.documentElement.dir = s.dir;
  document.getElementById('brand').textContent = s.brand;
  document.getElementById('title').textContent = s.title;
  document.getElementById('langGroup').setAttribute('aria-label', s.language);
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = s[el.dataset.i18n];
  });
  document.querySelectorAll('[data-lang]').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.lang === lang));
  });
};

const refresh = () => {
  const s = t();
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab) {
      stat.textContent = s.openYad2;
      return;
    }

    // Ask the content script directly instead of relying on tab.url:
    // if it answers, we are on Yad2.
    chrome.tabs.sendMessage(tab.id, { type: 'y2ha:status' }, (res) => {
      if (chrome.runtime.lastError || !res) {
        const url = tab.url || '';
        stat.textContent = (url && !IS_YAD2.test(url)) ? s.openYad2 : s.reload;
        return;
      }

      const { counts } = res;
      if (!counts.total) {
        const allOff = HIDE_KEYS.every((k) => res.settings[k] === false);
        stat.textContent = allOff ? s.allOff : s.none;
        return;
      }

      const labels = { realestate: s.countRealestate, projects: s.countProjects };
      const parts = ['realestate', 'projects']
        .filter((k) => counts[k])
        .map((k) => `${labels[k]}: ${Number(counts[k])}`);

      stat.innerHTML = `${s.hidden(Number(counts.total))}<small>${parts.join(' · ')}</small>`;
    });
  });
};

chrome.storage.sync.get(DEFAULTS, (settings) => {
  lang = y2haLang(settings.uiLang);
  applyLang();
  stat.textContent = t().checking;
  for (const key of SWITCHES) {
    document.getElementById(key).checked = settings[key] !== false;
  }
  maxAge.value = String(Number(settings.maxAgeDays) || 0);
  refresh();
});

// the map picks the new value up on its next request (pan / zoom)
maxAge.addEventListener('change', () => {
  chrome.storage.sync.set({ maxAgeDays: Number(maxAge.value) });
});

for (const key of SWITCHES) {
  document.getElementById(key).addEventListener('change', (e) => {
    chrome.storage.sync.set({ [key]: e.target.checked }, () => {
      // give the content script a moment to apply and rescan before recounting
      setTimeout(refresh, 120);
    });
  });
}

document.querySelectorAll('[data-lang]').forEach((b) => {
  b.addEventListener('click', () => {
    lang = b.dataset.lang;
    chrome.storage.sync.set({ uiLang: lang });
    applyLang();
    refresh();
  });
});
