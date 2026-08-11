const test = require("node:test");
const assert = require("node:assert/strict");
const { loadScript } = require("./helpers");

const moduleScope = loadScript("src/localization.js");
loadScript("src/sort-engine.js", moduleScope);
loadScript("src/rule-store.js", moduleScope);
loadScript("src/plugin.js", moduleScope);

function treeRow(view, type, ref, level) {
  return {
    view,
    type,
    ref,
    level,
    id: type === "collection" ? "C" + ref.id : type,
    isCollection: () => type === "collection",
    isRecentlyRead: () => type === "recentlyRead"
  };
}

function createPlugin() {
  function CollectionTreeRow(view, type, ref, level) {
    Object.assign(this, treeRow(view, type, ref, level));
  }
  const prefs = new Map([["extensions.zotero.collectionSort.rules", "{}"]]);
  const collectionsByID = new Map();
  const Zotero = {
    version: "9.0.4",
    localeCompare: (left, right) => left.localeCompare(right, "en"),
    CollectionTreeRow,
    Prefs: {
      get: (key) => prefs.get(key),
      set: (key, value) => prefs.set(key, value)
    },
    debug() {},
    logError(error) { throw error; },
    MenuManager: { registerMenu() {}, unregisterMenu() {} },
    Collections: {
      get: (id) => collectionsByID.get(id)
    },
    getMainWindows: () => []
  };
  const plugin = moduleScope.createCollectionSortPlugin({
    Zotero,
    pluginID: "test",
    Localization: moduleScope.Localization,
    SortEngine: moduleScope.SortEngine,
    createRuleStore: moduleScope.createRuleStore
  });
  plugin._test.collectionsByID = collectionsByID;
  return plugin;
}

function createView(names) {
  const view = {
    _rows: [],
    _rowMap: { C10: 0 },
    getRow(index) { return this._rows[index]; },
    getLevel(index) { return this._rows[index].level; },
    isContainerOpen: () => true,
    isContainerEmpty: () => false,
    _includedInTree: () => true,
    _addRow(row, beforeRow) {
      this.added = { row, beforeRow };
    }
  };
  view._rows.push(treeRow(view, "collection", { id: 10, name: "Parent" }, 0));
  for (const { name, level = 1 } of names) {
    view._rows.push(treeRow(view, "collection", { name }, level));
  }
  return view;
}

test("descending insertion skips nested descendants and finds the direct sibling slot", async () => {
  const plugin = createPlugin();
  const view = createView([
    { name: "C" },
    { name: "nested", level: 2 },
    { name: "A" }
  ]);
  const index = await plugin._test.addCollectionRowWithMode(
    view,
    { id: 20, parentID: 10, name: "B" },
    "desc"
  );
  assert.equal(index, 3);
  assert.equal(view.added.beforeRow, 3);
  assert.equal(view.added.row.ref.name, "B");
});

test("ascending insertion uses the inverse comparison", async () => {
  const plugin = createPlugin();
  const view = createView([
    { name: "A" },
    { name: "nested", level: 2 },
    { name: "C" }
  ]);
  const index = await plugin._test.addCollectionRowWithMode(
    view,
    { id: 20, parentID: 10, name: "B" },
    "asc"
  );
  assert.equal(index, 3);
  assert.equal(view.added.beforeRow, 3);
});

test("an invisible parent is not opened or inserted", async () => {
  const plugin = createPlugin();
  const view = createView([]);
  view._rowMap = {};
  const result = await plugin._test.addCollectionRowWithMode(
    view,
    { id: 20, parentID: 10, name: "B" },
    "asc"
  );
  assert.equal(result, false);
  assert.equal(view.added, undefined);
});

test("cold start rebuilds the shallowest configured open parent once", async () => {
  const plugin = createPlugin();
  const parent = {
    id: 10,
    libraryID: 1,
    key: "PARENT",
    parentID: null,
    name: "Parent"
  };
  const child = {
    id: 11,
    libraryID: 1,
    key: "CHILD",
    parentID: 10,
    name: "Child"
  };
  const view = {
    _rows: [],
    selection: { focused: 1 },
    closed: [],
    selected: [],
    openIDs: new Set([10, 11]),
    getRow(index) { return this._rows[index]; },
    getRowIndexByID(id) {
      const index = this._rows.findIndex((row) => row.id === id);
      return index === -1 ? false : index;
    },
    isContainerOpen(index) {
      return this.openIDs.has(this._rows[index].ref.id);
    },
    _closeContainer(index) {
      const id = this._rows[index].ref.id;
      this.closed.push(id);
      this.openIDs.delete(id);
    },
    async toggleOpenState(index) {
      this.openIDs.add(this._rows[index].ref.id);
    },
    async selectByID(id) {
      this.selected.push(id);
    }
  };
  view._rows = [
    treeRow(view, "collection", parent, 0),
    treeRow(view, "collection", child, 1)
  ];
  plugin._test.collectionsByID.set(10, parent);
  plugin._test.collectionsByID.set(11, child);
  plugin._test.ruleStore.load();
  plugin._test.ruleStore.setMode(parent, "desc");
  plugin._test.ruleStore.setMode(child, "desc");
  plugin._test.state.managedViews.add(view);

  await plugin._test.rebuildConfiguredOpenParents({
    ZoteroPane: { collectionsView: view }
  });

  assert.deepEqual(view.closed, [10]);
  assert.deepEqual(view.selected, ["C11"]);
  assert.equal(view.openIDs.has(10), true);
});
