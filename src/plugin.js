(function (scope) {
  "use strict";

  const PREF_KEY = "extensions.zotero.collectionSort.rules";
  const MENU_ID = "zotero-collection-sort-context-menu";
  const WINDOW_WAIT_TIMEOUT_MS = 10000;
  const WINDOW_WAIT_INTERVAL_MS = 100;

  scope.createCollectionSortPlugin = function createCollectionSortPlugin(env) {
    const { Zotero, pluginID, Localization, SortEngine, createRuleStore } = env;

    const state = {
      active: false,
      compatible: false,
      windows: new Map(),
      managedViews: new Set(),
      originalGetChildren: null,
      patchedGetChildren: null,
      menuID: null
    };

    const debug = (message) => Zotero.debug(`[CollectionSort] ${message}`);
    const logError = (error) => Zotero.logError(error);
    const ruleStore = createRuleStore({
      prefs: Zotero.Prefs,
      prefKey: PREF_KEY,
      debug,
      logError
    });

    function hasGlobalFeatures() {
      const prototype = Zotero.CollectionTreeRow?.prototype;
      return Boolean(
        prototype
        && typeof prototype.getChildren === "function"
        && typeof Zotero.localeCompare === "function"
        && typeof Zotero.MenuManager?.registerMenu === "function"
        && typeof Zotero.MenuManager?.unregisterMenu === "function"
      );
    }

    function hasViewFeatures(view) {
      const required = [
        "_addSortedRow",
        "_addRow",
        "getRow",
        "getRowIndexByID",
        "isContainerOpen",
        "isContainerEmpty",
        "getLevel",
        "_includedInTree",
        "_closeContainer",
        "toggleOpenState",
        "selectByID"
      ];
      return Boolean(view && required.every((name) => typeof view[name] === "function"));
    }

    function installGetChildrenPatch() {
      const prototype = Zotero.CollectionTreeRow.prototype;
      const original = prototype.getChildren;

      function patchedGetChildren(...args) {
        const children = original.apply(this, args);
        if (!state.active || !state.managedViews.has(this.view) || !this.isCollection()) {
          return children;
        }

        const mode = ruleStore.getMode(this.ref);
        if (mode === "default" || !Array.isArray(children)) {
          return children;
        }
        return SortEngine.sortChildren(children, mode, Zotero.localeCompare);
      }

      patchedGetChildren.__zoteroCollectionSort = true;
      state.originalGetChildren = original;
      state.patchedGetChildren = patchedGetChildren;
      prototype.getChildren = patchedGetChildren;
      debug("Installed getChildren patch");
    }

    function restoreGetChildrenPatch() {
      const prototype = Zotero.CollectionTreeRow?.prototype;
      if (prototype && prototype.getChildren === state.patchedGetChildren) {
        prototype.getChildren = state.originalGetChildren;
        debug("Restored getChildren patch");
      }
      state.originalGetChildren = null;
      state.patchedGetChildren = null;
    }

    async function addCollectionRowWithMode(view, collection, mode) {
      let beforeRow;
      const parentID = collection.parentID;

      if (!parentID) {
        throw new Error("Custom sorting cannot be applied at a library root");
      }
      if (view._rowMap["C" + parentID] === undefined) {
        return false;
      }

      let startRow = view._rowMap["C" + parentID];
      if (!view.isContainerOpen(startRow)) {
        return false;
      }

      const level = view.getLevel(startRow) + 1;
      if (view.isContainerEmpty(startRow)) {
        beforeRow = startRow + 1;
      }
      else {
        startRow++;
        while (
          startRow < view._rows.length
          && view.getLevel(startRow) === level
          && view.getRow(startRow).isRecentlyRead()
        ) {
          startRow++;
        }

        siblingLoop:
        for (let i = startRow; i < view._rows.length; i++) {
          let treeRow = view.getRow(i);
          beforeRow = i;

          if (!treeRow.isCollection()) {
            break;
          }

          let rowLevel = view.getLevel(i);
          if (rowLevel < level) {
            break;
          }

          while (rowLevel > level) {
            beforeRow = ++i;
            if (i === view._rows.length || !view.getRow(i).isCollection()) {
              break siblingLoop;
            }
            treeRow = view.getRow(i);
            rowLevel = view.getLevel(i);
            if (rowLevel < level) {
              break siblingLoop;
            }
          }

          if (SortEngine.shouldInsertBefore(
            treeRow.ref,
            collection,
            mode,
            Zotero.localeCompare
          )) {
            break;
          }
        }
      }

      if (view._includedInTree(collection)) {
        view._addRow(
          new Zotero.CollectionTreeRow(view, "collection", collection, level),
          beforeRow
        );
      }
      return beforeRow;
    }

    function patchView(context, view) {
      if (!hasViewFeatures(view)) {
        debug(`Zotero ${Zotero.version}: incompatible CollectionTree view; patch skipped`);
        return false;
      }
      if (state.managedViews.has(view)) {
        return true;
      }

      const original = view._addSortedRow;
      async function patchedAddSortedRow(objectType, id) {
        if (!state.active || !state.managedViews.has(this) || objectType !== "collection") {
          return original.call(this, objectType, id);
        }

        try {
          const collection = await Zotero.Collections.getAsync(id);
          if (!collection || !collection.parentID) {
            return original.call(this, objectType, id);
          }

          const parent = await Zotero.Collections.getAsync(collection.parentID);
          const mode = parent ? ruleStore.getMode(parent) : "default";
          if (mode === "default") {
            return original.call(this, objectType, id);
          }
          return await addCollectionRowWithMode(this, collection, mode);
        }
        catch (error) {
          logError(error);
          return original.call(this, objectType, id);
        }
      }

      patchedAddSortedRow.__zoteroCollectionSort = true;
      context.view = view;
      context.originalAddSortedRow = original;
      context.patchedAddSortedRow = patchedAddSortedRow;
      state.managedViews.add(view);
      view._addSortedRow = patchedAddSortedRow;
      debug("Installed _addSortedRow patch for main window");
      return true;
    }

    function unpatchWindow(win) {
      const context = state.windows.get(win);
      if (!context) {
        return;
      }

      context.cancelled = true;
      if (context.pendingTimer !== null) {
        win.clearTimeout(context.pendingTimer);
        context.pendingTimer = null;
      }
      if (context.view) {
        state.managedViews.delete(context.view);
        if (context.view._addSortedRow === context.patchedAddSortedRow) {
          context.view._addSortedRow = context.originalAddSortedRow;
          debug("Restored _addSortedRow patch for main window");
        }
      }
      state.windows.delete(win);
    }

    async function waitForView(context) {
      const started = Date.now();
      return new Promise((resolve) => {
        const check = () => {
          context.pendingTimer = null;
          if (context.cancelled || !state.active) {
            resolve(null);
            return;
          }

          const view = context.win.ZoteroPane?.collectionsView;
          if (view) {
            resolve(view);
            return;
          }
          if (Date.now() - started >= WINDOW_WAIT_TIMEOUT_MS) {
            debug("Timed out waiting for ZoteroPane.collectionsView");
            resolve(null);
            return;
          }
          context.pendingTimer = context.win.setTimeout(check, WINDOW_WAIT_INTERVAL_MS);
        };
        check();
      });
    }

    async function onMainWindowLoad(win) {
      if (!state.active || !state.compatible || state.windows.has(win)) {
        return;
      }

      const context = {
        win,
        view: null,
        originalAddSortedRow: null,
        patchedAddSortedRow: null,
        pendingTimer: null,
        cancelled: false
      };
      state.windows.set(win, context);
      const view = await waitForView(context);
      if (!view || context.cancelled) {
        return;
      }
      if (patchView(context, view)) {
        try {
          await rebuildConfiguredOpenParents(win);
        }
        catch (error) {
          logError(error);
        }
      }
    }

    function concreteCollectionFromContext(context) {
      const row = context?.collectionTreeRow;
      return row && typeof row.isCollection === "function" && row.isCollection()
        ? row.ref
        : null;
    }

    function setMenuLabel(context, label) {
      context.menuElem?.setAttribute("label", label);
    }

    function strings() {
      return Localization.getStrings(Zotero.locale);
    }

    function contextUsesManagedView(context) {
      const win = context.menuElem?.ownerDocument?.defaultView;
      return Boolean(win && state.managedViews.has(win.ZoteroPane?.collectionsView));
    }

    function configureRadio(context, mode, label) {
      const item = context.menuElem;
      if (!item) {
        return;
      }
      item.setAttribute("label", label);
      item.setAttribute("type", "radio");
      item.setAttribute("name", "zotero-collection-sort-mode");
      item.setAttribute("autocheck", "false");
      const collection = concreteCollectionFromContext(context);
      if (collection && ruleStore.getMode(collection) === mode) {
        item.setAttribute("checked", "true");
      }
      else {
        item.removeAttribute("checked");
      }
    }

    function selectedRowID(view) {
      const focused = view.selection?.focused;
      return Number.isInteger(focused) && focused >= 0
        ? view.getRow(focused)?.id || null
        : null;
    }

    async function rebuildParentChildren(win, collectionID, restoreSelection = true) {
      const view = win?.ZoteroPane?.collectionsView;
      if (!view || !state.managedViews.has(view)) {
        return;
      }

      const row = view.getRowIndexByID("C" + collectionID);
      if (row === false || !view.isContainerOpen(row)) {
        return;
      }

      const selectedID = restoreSelection ? selectedRowID(view) : null;

      view._closeContainer(row);
      const newRow = view.getRowIndexByID("C" + collectionID);
      if (newRow !== false && !view.isContainerOpen(newRow)) {
        await view.toggleOpenState(newRow);
      }
      if (selectedID && view.getRowIndexByID(selectedID) !== false) {
        await view.selectByID(selectedID);
      }
    }

    async function rebuildConfiguredOpenParents(win) {
      const view = win?.ZoteroPane?.collectionsView;
      if (!view || !state.managedViews.has(view) || !ruleStore.snapshot().size) {
        return;
      }

      const candidates = [];
      for (let index = 0; index < view._rows.length; index++) {
        const row = view.getRow(index);
        if (
          row?.isCollection()
          && view.isContainerOpen(index)
          && ruleStore.getMode(row.ref) !== "default"
        ) {
          candidates.push(row.ref);
        }
      }
      if (!candidates.length) {
        return;
      }

      // Rebuilding an open configured ancestor recursively expands its remembered
      // descendants, so separately rebuilding configured descendants is redundant.
      const candidateIDs = new Set(candidates.map((collection) => collection.id));
      const roots = candidates.filter((collection) => {
        let parentID = collection.parentID;
        while (parentID) {
          if (candidateIDs.has(parentID)) {
            return false;
          }
          const parent = Zotero.Collections.get(parentID);
          parentID = parent?.parentID || null;
        }
        return true;
      });

      const selectedID = selectedRowID(view);
      for (const collection of roots) {
        await rebuildParentChildren(win, collection.id, false);
      }
      if (selectedID && view.getRowIndexByID(selectedID) !== false) {
        await view.selectByID(selectedID);
      }
      debug(`Rebuilt ${roots.length} configured open parent(s) after view patch`);
    }

    async function applyMode(mode, event, context) {
      const collection = concreteCollectionFromContext(context);
      if (!collection) {
        return;
      }
      ruleStore.setMode(collection, mode);
      const win = context.menuElem?.ownerDocument?.defaultView
        || event?.target?.ownerDocument?.defaultView;
      if (win) {
        await rebuildParentChildren(win, collection.id);
      }
    }

    function menuItem(mode, labelKey) {
      return {
        menuType: "menuitem",
        onShowing(event, context) {
          configureRadio(context, mode, strings()[labelKey]);
        },
        onCommand(event, context) {
          applyMode(mode, event, context).catch(logError);
        }
      };
    }

    function registerMenu() {
      const registered = Zotero.MenuManager.registerMenu({
        menuID: MENU_ID,
        pluginID,
        target: "main/library/collection",
        menus: [{
          menuType: "submenu",
          onShowing(event, context) {
            setMenuLabel(context, strings().submenu);
            context.setVisible(Boolean(
              state.active
              && state.compatible
              && contextUsesManagedView(context)
              && concreteCollectionFromContext(context)
            ));
          },
          menus: [
            menuItem("default", "defaultMode"),
            menuItem("asc", "ascending"),
            menuItem("desc", "descending")
          ]
        }]
      });

      if (!registered) {
        throw new Error("Zotero MenuManager rejected the Collection Sort menu");
      }
      state.menuID = registered;
      debug("Registered collection context menu");
    }

    async function startup() {
      state.active = true;
      ruleStore.load();
      state.compatible = hasGlobalFeatures();
      if (!state.compatible) {
        state.active = false;
        debug(`Zotero ${Zotero.version}: required APIs are missing; plugin disabled`);
        return;
      }

      try {
        installGetChildrenPatch();
        registerMenu();
        for (const win of Zotero.getMainWindows()) {
          await onMainWindowLoad(win);
        }
        debug(`Started on Zotero ${Zotero.version}`);
      }
      catch (error) {
        logError(error);
        state.active = false;
        if (state.menuID) {
          Zotero.MenuManager.unregisterMenu(state.menuID);
          state.menuID = null;
        }
        for (const win of Array.from(state.windows.keys())) {
          unpatchWindow(win);
        }
        state.managedViews.clear();
        restoreGetChildrenPatch();
        state.compatible = false;
        debug(`Zotero ${Zotero.version}: startup failed closed`);
      }
    }

    async function shutdown() {
      state.active = false;
      if (state.menuID) {
        Zotero.MenuManager.unregisterMenu(state.menuID);
        state.menuID = null;
      }
      for (const win of Array.from(state.windows.keys())) {
        unpatchWindow(win);
      }
      state.managedViews.clear();
      restoreGetChildrenPatch();
      state.compatible = false;
      debug("Stopped");
    }

    return {
      startup,
      shutdown,
      onMainWindowLoad,
      onMainWindowUnload: unpatchWindow,
      _test: {
        state,
        ruleStore,
        addCollectionRowWithMode,
        rebuildParentChildren,
        rebuildConfiguredOpenParents,
        concreteCollectionFromContext,
        strings
      }
    };
  };
})(this);
