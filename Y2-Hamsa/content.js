/*
 * יד2 - הסתרת מודעות מתווכים ופרויקטים בנדל"ן
 *
 * יד2 מסמן כל כרטיס בפיד ב-data-testid על ה-<li>, והסימון מתאים אחד-לאחד
 * לחלוקה שה-API מחזיר (private / agency / platinum / booster / ...):
 *   פרטי:   item-basic
 *   מתווך:  agency-item, platinum-item, booster-item
 *   קידום:  king-item, trio-list, leading-agencies
 *   קבלן:   yad1-*, gray-project-feed-item  (קטגוריה נפרדת - לא מתווך ולא פרטי)
 */

(() => {
  'use strict';

  /* ---------- הגדרות קטגוריה ---------- */

  const CATEGORIES = {
    realestate: { setting: 'hideRealestateBrokers', rootClass: 'y2ha-re',   hiddenClass: 'y2ha-hidden-re' },
    projects:   { setting: 'hideNewProjects',       rootClass: 'y2ha-yad1', hiddenClass: 'y2ha-hidden-yad1' }
  };

  const DEFAULTS = {
    hideRealestateBrokers: true,
    hideNewProjects: true
  };

  /* ---------- סלקטורים ---------- */

  const RE_BROKER_SELECTOR = [
    'agency-item', 'platinum-item', 'booster-item',
    'king-item', 'king-of-the-har-item', 'trio-list', 'leading-agencies'
  ].map((t) => `[data-testid="${t}"]`).join(',');

  const PROJECT_SELECTOR = '[data-testid^="yad1-"],[data-testid="gray-project-feed-item"]';

  // חלק מהקישורים באתר יחסיים ("item/abc") וחלק מוחלטים ("/realestate/item/abc"),
  // ולכן הסלקטור לא יכול לדרוש לוכסן מוביל.
  const AD_LINK = 'a[href*="item/"]';

  // לוגו של משרד תיווך (TivMiniSite) או לוגו ברירת המחדל של סוכנות
  const AGENCY_LOGO = 'img[src*="MiniSite/"], img[src*="default-agency-logo"]';

  const root = document.documentElement;

  /* ---------- מצב ---------- */

  const state = { ...DEFAULTS };
  let observer = null;

  // הסתרה אופטימית כבר ב-document_start כדי שלא יהיה הבהוב של מודעות
  // לפני שקריאת ה-storage (אסינכרונית) חוזרת.
  for (const cat of Object.values(CATEGORIES)) root.classList.add(cat.rootClass);

  const isRealestateSection = () => /^\/realestate(\/|$)/.test(location.pathname);

  /* ---------- סימון ---------- */

  const mark = (el, hiddenClass) => {
    if (!el || el.classList.contains(hiddenClass)) return;
    el.classList.add(hiddenClass);
  };

  const eachIn = (node, selector, fn) => {
    if (node instanceof Element && node.matches(selector)) fn(node);
    if (node.querySelectorAll) node.querySelectorAll(selector).forEach(fn);
  };

  /* ---------- נדל"ן ---------- */

  const scanRealestate = (node) => {
    if (!isRealestateSection()) return;
    const { hiddenClass } = CATEGORIES.realestate;

    // כרטיס פיד שאינו מסומן כמתווך אך נושא לוגו של משרד תיווך
    eachIn(node, '[data-nagish="feed-item-list-box"], [data-testid="lookalike-item"]', (item) => {
      if (item.matches('[data-testid="item-basic"]')) return;
      if (item.matches(PROJECT_SELECTOR)) return;
      if (item.querySelector(AGENCY_LOGO)) mark(item, hiddenClass);
    });
  };

  /* ---------- סריקה ---------- */

  const scan = (node) => {
    if (!node) return;
    if (state.hideRealestateBrokers) scanRealestate(node);
    // הפרויקטים מזוהים כולם ע"י ה-CSS לפי data-testid, בלי צורך בסימון
  };

  /* ---------- ספירה לפופאפ ---------- */

  // סופרים רק אלמנטים "עליונים" - כך מודעה שנמצאת בתוך מקטע מוסתר לא נספרת פעמיים
  const countTop = (selector, insideHidden) => {
    let n = 0;
    document.querySelectorAll(selector).forEach((el) => {
      if (el.parentElement && el.parentElement.closest(insideHidden)) return;
      // מקטע קידום שמכיל כמה מודעות נספר לפי מספר המודעות שבו
      const links = el.querySelectorAll(AD_LINK).length;
      n += links > 1 ? links : 1;
    });
    return n;
  };

  const countHidden = () => {
    const hiddenAncestors = Object.values(CATEGORIES)
      .map((c) => '.' + c.hiddenClass).join(',');

    const counts = { realestate: 0, projects: 0 };

    if (state.hideRealestateBrokers) {
      counts.realestate = countTop(
        `${RE_BROKER_SELECTOR},.${CATEGORIES.realestate.hiddenClass}`, hiddenAncestors);
    }
    if (state.hideNewProjects) {
      // מסננים את תתי-האלמנטים של יד1 (preview / link) שלא מהווים מודעה בפני עצמה
      document.querySelectorAll(PROJECT_SELECTOR).forEach((el) => {
        if (el.parentElement && el.parentElement.closest(PROJECT_SELECTOR)) return;
        if (/-(preview|link|image)$/.test(el.dataset.testid || '')) return;
        counts.projects++;
      });
    }

    counts.total = counts.realestate + counts.projects;
    return counts;
  };

  /* ---------- מעקב אחרי תוכן דינמי (גלילה אינסופית / ניווט SPA) ---------- */

  const startObserver = () => {
    if (observer) return;
    observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const added of m.addedNodes) scan(added);
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  };

  const stopObserver = () => {
    if (!observer) return;
    observer.disconnect();
    observer = null;
  };

  const apply = () => {
    let anyOn = false;
    for (const cat of Object.values(CATEGORIES)) {
      const on = state[cat.setting] !== false;
      root.classList.toggle(cat.rootClass, on);
      anyOn = anyOn || on;
    }

    if (anyOn) {
      scan(document);
      startObserver();
    } else {
      stopObserver();
    }
  };

  /* ---------- הגדרות ותקשורת ---------- */

  chrome.storage.sync.get(DEFAULTS, (settings) => {
    Object.assign(state, settings);
    apply();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    let touched = false;
    for (const key of Object.keys(DEFAULTS)) {
      if (!changes[key]) continue;
      state[key] = changes[key].newValue !== false;
      touched = true;
    }
    if (touched) apply();
  });

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === 'y2ha:status') {
      sendResponse({
        settings: { ...state },
        section: isRealestateSection() ? 'realestate' : 'other',
        counts: countHidden()
      });
    }
    return false;
  });

  // סריקה נוספת אחרי טעינת ה-DOM, למקרה שהתוכן הראשוני נוצר לפני שה-observer עלה
  document.addEventListener('DOMContentLoaded', () => scan(document));
})();
