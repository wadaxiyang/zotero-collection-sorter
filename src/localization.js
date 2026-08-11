(function (scope) {
  "use strict";

  const STRINGS = Object.freeze({
    en: Object.freeze({
      submenu: "Sort Child Collections",
      defaultMode: "Zotero Default",
      ascending: "Name Ascending A → Z",
      descending: "Name Descending Z → A"
    }),
    zh: Object.freeze({
      submenu: "子分类排序",
      defaultMode: "Zotero 默认",
      ascending: "名称升序 A → Z",
      descending: "名称降序 Z → A"
    })
  });

  function isChineseLocale(locale) {
    return /^zh(?:-|$)/i.test(String(locale || ""));
  }

  function getStrings(locale) {
    return isChineseLocale(locale) ? STRINGS.zh : STRINGS.en;
  }

  scope.Localization = {
    isChineseLocale,
    getStrings
  };
})(this);
