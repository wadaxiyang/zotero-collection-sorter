const test = require("node:test");
const assert = require("node:assert/strict");
const { loadScript } = require("./helpers");

const moduleScope = loadScript("src/localization.js");
loadScript("src/sort-engine.js", moduleScope);
loadScript("src/rule-store.js", moduleScope);
loadScript("src/plugin.js", moduleScope);

function createPlugin() {
  const Zotero = {
    Prefs: { get: () => "{}", set() {} },
    debug() {},
    logError(error) { throw error; }
  };
  return moduleScope.createCollectionSortPlugin({
    Zotero,
    pluginID: "test",
    Localization: moduleScope.Localization,
    SortEngine: moduleScope.SortEngine,
    createRuleStore: moduleScope.createRuleStore
  });
}

function row(id, isCollection = true) {
  return {
    id,
    ref: { id: Number(id.slice(1)), name: id },
    isCollection: () => isCollection
  };
}

test("Zotero 10 context never reads the throwing singular getter", () => {
  const plugin = createPlugin();
  const collection = row("C1");
  const context = { collectionTreeRows: [collection] };
  Object.defineProperty(context, "collectionTreeRow", {
    get() { throw new Error("Use collectionTreeRows()"); }
  });
  assert.equal(plugin._test.concreteCollectionFromContext(context), collection.ref);
  context.collectionTreeRows = [collection, row("C2")];
  assert.equal(plugin._test.concreteCollectionFromContext(context), null);
  context.collectionTreeRows = [];
  assert.equal(plugin._test.concreteCollectionFromContext(context), null);
  context.collectionTreeRows = [row("L1", false)];
  assert.equal(plugin._test.concreteCollectionFromContext(context), null);
});

test("Zotero 9 singular context remains supported", () => {
  const plugin = createPlugin();
  const collection = row("C1");
  assert.equal(plugin._test.concreteCollectionFromContext({
    collectionTreeRow: collection
  }), collection.ref);
  assert.equal(plugin._test.concreteCollectionFromContext({}), null);
});

test("Zotero 10 selection restoration retains all selected IDs and focus", async () => {
  const plugin = createPlugin();
  const rows = [row("L1", false), row("C1"), row("C2"), row("C3")];
  let notifications = 0;
  const selection = {
    selected: new Set([1, 3]),
    focused: 3,
    pivot: 1,
    _suppressed: false,
    get selectEventsSuppressed() { return this._suppressed; },
    set selectEventsSuppressed(value) {
      if (this._suppressed && !value) notifications++;
      this._suppressed = value;
    }
  };
  const view = {
    selection,
    getRow: (index) => rows[index],
    getRowIndexByID: (id) => {
      const idx = rows.findIndex((entry) => entry.id === id);
      return idx < 0 ? false : idx;
    },
    async selectByID() { throw new Error("Would collapse multi-selection"); }
  };
  const snapshot = plugin._test.captureSelection(view);
  rows.splice(1, 3, rows[3], rows[1], rows[2]); // new order C3, C1, C2
  await plugin._test.restoreSelectionState(view, snapshot);
  assert.deepEqual(Array.from(selection.selected).sort((a, b) => a - b), [1, 2]);
  assert.equal(rows[selection.focused].id, "C3");
  assert.equal(rows[selection.pivot].id, "C1");
  assert.equal(notifications, 1);
});

test("single-selection restoration uses the existing Zotero selection API", async () => {
  const plugin = createPlugin();
  const rows = [row("C1"), row("C2")];
  const selected = [];
  const view = {
    selection: { selected: new Set([1]), focused: 1, pivot: 1 },
    getRow: (index) => rows[index],
    getRowIndexByID: (id) => {
      const idx = rows.findIndex((entry) => entry.id === id);
      return idx < 0 ? false : idx;
    },
    async selectByID(id) { selected.push(id); }
  };
  const snapshot = plugin._test.captureSelection(view);
  rows.reverse();
  await plugin._test.restoreSelectionState(view, snapshot);
  assert.deepEqual(selected, ["C2"]);
});
