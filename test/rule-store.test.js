const test = require("node:test");
const assert = require("node:assert/strict");
const { loadScript } = require("./helpers");

const { createRuleStore } = loadScript("src/rule-store.js");

function fixture(initial = "{}") {
  let value = initial;
  const errors = [];
  const store = createRuleStore({
    prefs: {
      get: () => value,
      set: (key, next) => { value = next; }
    },
    prefKey: "rules",
    debug() {},
    logError: (error) => errors.push(error)
  });
  return { store, errors, value: () => value };
}

test("rules use stable libraryID:key identities", () => {
  const { store } = fixture();
  assert.equal(store.makeKey({ libraryID: 1, key: "ABCDEFGH" }), "1:ABCDEFGH");
});

test("only asc and desc are loaded", () => {
  const { store } = fixture('{"1:A":"asc","1:B":"desc","1:C":"other"}');
  store.load();
  assert.equal(store.getMode({ libraryID: 1, key: "A" }), "asc");
  assert.equal(store.getMode({ libraryID: 1, key: "B" }), "desc");
  assert.equal(store.getMode({ libraryID: 1, key: "C" }), "default");
});

test("default deletes a stored rule", () => {
  const { store, value } = fixture();
  const collection = { libraryID: 2, key: "KEY" };
  store.load();
  store.setMode(collection, "desc");
  assert.equal(store.getMode(collection), "desc");
  store.setMode(collection, "default");
  assert.equal(store.getMode(collection), "default");
  assert.deepEqual(JSON.parse(value()), {});
});

test("damaged JSON fails safely to an empty in-memory store", () => {
  const { store, errors } = fixture("not json");
  store.load();
  assert.equal(store.getMode({ libraryID: 1, key: "A" }), "default");
  assert.equal(errors.length, 1);
});

test("unsupported modes are rejected", () => {
  const { store } = fixture();
  store.load();
  assert.throws(
    () => store.setMode({ libraryID: 1, key: "A" }, "natural"),
    /Invalid sort mode/
  );
});
