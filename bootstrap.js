/* global Services, Zotero */

var CollectionSortPlugin = null;
var CollectionSortModules = null;

function rootSpec(rootURI) {
  return typeof rootURI === "string" ? rootURI : rootURI.spec;
}

function loadModules(rootURI) {
  const base = rootSpec(rootURI);
  const scope = {};
  Services.scriptloader.loadSubScript(base + "src/localization.js", scope);
  Services.scriptloader.loadSubScript(base + "src/sort-engine.js", scope);
  Services.scriptloader.loadSubScript(base + "src/rule-store.js", scope);
  Services.scriptloader.loadSubScript(base + "src/plugin.js", scope);
  return scope;
}

async function startup({ id, rootURI }, reason) {
  await Zotero.initializationPromise;
  CollectionSortModules = loadModules(rootURI);
  CollectionSortPlugin = CollectionSortModules.createCollectionSortPlugin({
    Zotero,
    Services,
    pluginID: id,
    Localization: CollectionSortModules.Localization,
    SortEngine: CollectionSortModules.SortEngine,
    createRuleStore: CollectionSortModules.createRuleStore
  });
  await CollectionSortPlugin.startup(reason);
}

async function shutdown(data, reason) {
  if (CollectionSortPlugin) {
    await CollectionSortPlugin.shutdown(reason);
  }
  CollectionSortPlugin = null;
  CollectionSortModules = null;
}

function install() {}

function uninstall() {
  try {
    Zotero.Prefs.clear("extensions.zotero.collectionSort.rules");
  }
  catch (error) {
    Zotero.logError(error);
  }
}

async function onMainWindowLoad({ window }) {
  if (CollectionSortPlugin) {
    await CollectionSortPlugin.onMainWindowLoad(window);
  }
}

function onMainWindowUnload({ window }) {
  if (CollectionSortPlugin) {
    CollectionSortPlugin.onMainWindowUnload(window);
  }
}
