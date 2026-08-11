const test = require("node:test");
const assert = require("node:assert/strict");
const { loadScript } = require("./helpers");

const { SortEngine } = loadScript("src/sort-engine.js");
const collate = (left, right) => left.localeCompare(right, "en");

test("default mode returns Zotero's original result unchanged", () => {
  const children = [{ name: "C" }, { name: "A" }];
  assert.equal(SortEngine.sortChildren(children, "default", collate), children);
});

test("ascending and descending modes sort copied arrays", () => {
  const children = [{ name: "C" }, { name: "A" }, { name: "B" }];
  assert.deepEqual(
    Array.from(SortEngine.sortChildren(children, "asc", collate), ({ name }) => name),
    ["A", "B", "C"]
  );
  assert.deepEqual(
    Array.from(SortEngine.sortChildren(children, "desc", collate), ({ name }) => name),
    ["C", "B", "A"]
  );
  assert.deepEqual(children.map(({ name }) => name), ["C", "A", "B"]);
});

test("equal names retain their original relative order", () => {
  const children = [
    { name: "A", marker: 1 },
    { name: "B", marker: 3 },
    { name: "A", marker: 2 }
  ];
  const sorted = SortEngine.sortChildren(children, "asc", collate);
  assert.deepEqual(Array.from(sorted, ({ marker }) => marker), [1, 2, 3]);
});

test("incremental insertion puts equal names after existing equal siblings", () => {
  assert.equal(
    SortEngine.shouldInsertBefore({ name: "A" }, { name: "A" }, "asc", collate),
    false
  );
  assert.equal(
    SortEngine.shouldInsertBefore({ name: "A" }, { name: "A" }, "desc", collate),
    false
  );
});
