/*
 * UI strings in Hebrew and English. Shared by the popup and the content scripts.
 * The chosen language is stored as `uiLang` ("he" | "en") in chrome.storage.sync;
 * when it is not set, the browser language decides (Hebrew -> he, anything else -> en).
 */
globalThis.Y2HA_I18N = {
  he: {
    dir: 'rtl',
    brand: 'יד2',
    title: 'בלי רעש',
    language: 'שפה',
    realestate: 'הסתרת מתווכים',
    realestateSub: 'משרדי תיווך ובאנרים, ברשימה ובמפה',
    projects: 'הסתרת פרויקטים מקבלן',
    projectsSub: 'דירות חדשות (יד1)',
    mapFull: 'מפה במסך מלא',
    mapFullSub: 'בעמודי חיפוש; הכפתור ⤡ מחזיר את הרשימה',
    anyShelter: 'רק עם מרחב מוגן',
    anyShelterSub: 'במפה: ממ״ד, ממ״ק או מקלט בבניין — מספיק אחד מהם',
    maxAge: 'גיל המודעה במפה',
    maxAgeSub: 'לפי תאריך הפרסום המקורי — הקפצה לא הופכת מודעה לחדשה',
    age0: 'ללא הגבלה',
    age1: 'עד יום',
    age3: 'עד 3 ימים',
    age7: 'עד שבוע',
    age14: 'עד שבועיים',
    age30: 'עד חודש',
    checking: 'בודק…',
    openYad2: 'פתחו עמוד ביד2 כדי לראות כמה מודעות הוסתרו.',
    reload: 'רעננו את העמוד כדי להפעיל את התוסף.',
    allOff: 'ההסתרה כבויה — מתווכים ופרויקטים מוצגים.',
    none: 'לא נמצאו מודעות מסחריות בעמוד הזה.',
    hidden: (n) => `הוסתרו <b>${n}</b> מודעות ברשימה.`,
    countRealestate: 'מתווכים',
    countProjects: 'פרויקטים',
    btnFull: '⤢ מפה מלאה',
    btnList: '⤡ חזרה לרשימה',
    btnFullTitle: 'פתיחת המפה על כל המסך',
    btnListTitle: 'חזרה לרשימה + מפה'
  },
  en: {
    dir: 'ltr',
    brand: 'Yad2',
    title: 'Less noise',
    language: 'Language',
    realestate: 'Hide brokers',
    realestateSub: 'Agency ads and banners, in the list and on the map',
    projects: 'Hide new projects',
    projectsSub: 'Developer listings (Yad1)',
    mapFull: 'Full-screen map',
    mapFullSub: 'On search pages; the ⤡ button brings the list back',
    anyShelter: 'Only with a protected space',
    anyShelterSub: 'On the map: mamad, floor shelter or building shelter — any one is enough',
    maxAge: 'Listing age on the map',
    maxAgeSub: 'By original posting date — a bump doesn\'t make an ad new',
    age0: 'Any',
    age1: 'Up to 1 day',
    age3: 'Up to 3 days',
    age7: 'Up to 1 week',
    age14: 'Up to 2 weeks',
    age30: 'Up to 1 month',
    checking: 'Checking…',
    openYad2: 'Open a Yad2 page to see how many ads were hidden.',
    reload: 'Reload the page to activate the extension.',
    allOff: 'Hiding is off — brokers and projects are shown.',
    none: 'No commercial ads found on this page.',
    hidden: (n) => `<b>${n}</b> ads hidden in the list.`,
    countRealestate: 'brokers',
    countProjects: 'projects',
    btnFull: '⤢ Full map',
    btnList: '⤡ Back to list',
    btnFullTitle: 'Open the map on the whole screen',
    btnListTitle: 'Back to list + map'
  }
};

globalThis.y2haLang = (setting) => {
  if (setting === 'he' || setting === 'en') return setting;
  return /^he|^iw/i.test(navigator.language || '') ? 'he' : 'en';
};
