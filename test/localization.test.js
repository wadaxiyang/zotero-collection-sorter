const test = require("node:test");
const assert = require("node:assert/strict");
const { loadScript } = require("./helpers");

const { Localization } = loadScript("src/localization.js");

test("simplified and traditional Chinese Zotero locales use Chinese labels", () => {
  for (const locale of ["zh", "zh-CN", "zh-TW", "zh-Hans", "zh-Hant"]) {
    assert.equal(Localization.getStrings(locale).submenu, "子分类排序");
  }
});

test("English and every non-Chinese locale fall back to English", () => {
  for (const locale of ["en-US", "de-DE", "fr-FR", "ja-JP", "", undefined]) {
    assert.equal(Localization.getStrings(locale).submenu, "Sort Child Collections");
  }
});

test("both language bundles contain the same keys", () => {
  assert.deepEqual(
    Object.keys(Localization.getStrings("zh-CN")),
    Object.keys(Localization.getStrings("en-US"))
  );
});
