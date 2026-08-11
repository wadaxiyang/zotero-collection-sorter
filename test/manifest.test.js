const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

const manifest = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "manifest.json"), "utf8")
);
const packageMetadata = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8")
);

test("manifest contains every field required by Zotero 9.0.4", () => {
  const zotero = manifest.applications?.zotero;
  assert.equal(manifest.manifest_version, 2);
  assert.equal(typeof zotero?.id, "string");
  assert.match(zotero?.update_url, /^https:\/\//);
  assert.equal(zotero?.strict_min_version, "9.0");
  assert.equal(zotero?.strict_max_version, "9.0.*");
});

test("package metadata stays aligned with the release manifest", () => {
  assert.equal(manifest.name, "__MSG_extensionName__");
  assert.equal(manifest.description, "__MSG_extensionDescription__");
  assert.equal(manifest.default_locale, "en");
  assert.equal(packageMetadata.name, "zotero-collection-sorter");
  assert.equal(packageMetadata.version, manifest.version);
  assert.equal(packageMetadata.license, "MIT");
  assert.equal(
    manifest.homepage_url,
    "https://github.com/wadaxiyang/zotero-collection-sorter"
  );
  assert.equal(manifest.icons["48"], "assets/icon-48.png");
  assert.equal(manifest.icons["96"], "assets/icon-96.png");
  for (const iconPath of Object.values(manifest.icons)) {
    assert.equal(fs.existsSync(path.join(__dirname, "..", iconPath)), true);
  }
});

test("add-on manager metadata has English and Chinese locale bundles", () => {
  for (const locale of ["en", "zh_CN", "zh_TW"]) {
    const messages = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, "..", "_locales", locale, "messages.json"),
        "utf8"
      )
    );
    assert.equal(typeof messages.extensionName?.message, "string");
    assert.equal(typeof messages.extensionDescription?.message, "string");
  }
});

test("the canonical project icon has no fixed page background", () => {
  const svg = fs.readFileSync(
    path.join(__dirname, "..", "assets", "collection-sorter-icon.svg"),
    "utf8"
  );
  assert.doesNotMatch(svg, /#202126/i);
  assert.doesNotMatch(svg, /<rect[^>]+width="480"[^>]+height="480"/i);
});
