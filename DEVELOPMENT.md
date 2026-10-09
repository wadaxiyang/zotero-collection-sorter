# Development notes

## Verified Zotero source baseline

The original installed and running Zotero 9 application was inspected before implementation:

- Zotero version: 9.0.4
- Application BuildID: `20260522110811`
- Gecko platform BuildID: `20260414220523`
- Application source archive: `/Applications/Zotero.app/Contents/Resources/app/omni.ja`

The original internal API audit above remains tied to the exact 9.0.4 build. Subsequent hands-on compatibility testing on Windows and macOS verified the plugin through Zotero 9.0.6. Version 0.1.4 declares Zotero 9.0–10.0.x compatibility; Zotero 10 has been **source-audited and regression-checked, but not yet live UI-tested**. Zotero 7, Zotero 8, and Linux have not been tested directly.

Confirmed in that exact build:

- `Zotero.CollectionTreeRow.prototype.getChildren()` returns `Zotero.Collections.getByParent(this.ref.id)` for collection rows.
- `ZoteroPane.collectionsView` is initialized with `CollectionTree.init()`.
- collection add and collection modify/move paths call `collectionsView._addSortedRow("collection", id)`.
- `_addSortedRow()`, `_addRow()`, `_includedInTree()`, `_closeContainer()`, `toggleOpenState()`, and the row/container query methods are present.
- `Zotero.MenuManager` accepts target `main/library/collection`.
- Zotero 9 menu contexts contain singular `collectionTreeRow`; Zotero 10 supplies plural `collectionTreeRows` and throws if the singular getter is read. The plugin prefers plural when present and safely falls back to singular for Zotero 9.
- Zotero 9.0.4's manifest parser requires `applications.zotero.update_url`. This project uses the reserved, non-resolving `.invalid` URL `https://collection-sort.invalid/updates.json` as a local-development placeholder; no update service is implemented.

If these members are missing, the plugin fails closed and does not switch to a full-tree refresh strategy.

## Zotero 10 source audit (2026-10-09)

Compared upstream [Zotero 9.0](https://github.com/zotero/zotero/tree/9.0) and [Zotero 10.0](https://github.com/zotero/zotero/tree/10.0) branches:

- `Zotero.CollectionTreeRow.prototype.getChildren()` still delegates concrete collection children to `Zotero.Collections.getByParent()`; the display-only wrapper remains applicable.
- `CollectionTree._addSortedRow('collection', id)` retains the same incremental sibling-insertion structure in both branches. The plugin keeps its narrowly scoped custom comparison, and delegates default/search/root cases to Zotero.
- The [official Zotero 10 migration notes](https://www.zotero.org/support/dev/zotero_10_for_developers) identify a breaking change to the `main/library/collection` MenuManager context: `collectionTreeRow` now throws; `collectionTreeRows` is the supported replacement.
- Zotero 10's tree selection contains a set of selected row indexes. After a local collapse/re-expand, the plugin now maps previously selected stable row IDs back to new indexes and restores focus/pivot when more than one row remains selected.
- Regression coverage uses mocked menu contexts and selection behavior. **This is not a substitute for testing with the actual Zotero 10 UI.**

## Architecture

- `bootstrap.js` owns the bootstrapped add-on lifecycle.
- `src/localization.js` selects Chinese for Zotero `zh-*` locales and English for every other locale.
- `src/rule-store.js` parses, validates, caches, and saves one local JSON preference.
- `src/sort-engine.js` contains name-only ascending/descending comparison behavior.
- `src/plugin.js` manages the MenuManager entry, the managed main-window views, the two patches, and local parent rebuilding.
- `assets/collection-sorter-icon.svg` is the canonical project mark. It has a transparent background so GitHub and Zotero can supply their own light/dark surfaces; pre-rendered transparent 48px and 96px PNG variants are referenced by the Zotero manifest.

The menu reads the locale already resolved by Zotero in `Zotero.locale`; it does not inspect the operating-system locale or maintain a separate language preference. Standard WebExtension `_locales` bundles localize the add-on manager name and description for English, Simplified Chinese, and Traditional Chinese.

The first patch wraps `CollectionTreeRow.getChildren()` globally but applies custom ordering only when `row.view` belongs to a managed main window and the row itself is a concrete collection. The second patch is installed on each managed `collectionsView` instance and duplicates only Zotero 9.0.4's collection branch of `_addSortedRow()`, changing its direct-sibling comparison for explicit `asc` or `desc` rules. All other object types and default rules delegate to Zotero unchanged.

Changing a rule for an already-open parent closes and reopens only that parent container. It never calls full-tree `reload()` or `refresh()`.

On a cold start, Zotero can restore already-expanded tree rows before the plugin's window hook installs its patches. Immediately after a view is patched, the plugin therefore finds only visible, open concrete collections with explicit rules and locally rebuilds the shallowest configured parents. Re-expansion recursively restores remembered descendant open states through the patched `getChildren()` path. This is a bounded startup correction, not a whole-tree refresh.

## Persistence

Preference: `extensions.zotero.collectionSort.rules`

Example:

```json
{
  "1:ABCDEFGH": "desc",
  "2:JKLMN123": "asc"
}
```

`default` is represented by deleting the mapping. Invalid JSON or invalid mode values are ignored safely.

## Cross-platform requirements

Plugin runtime files contain no filesystem paths, process execution, platform checks, or OS-native APIs. XUL menu attributes and Zotero/Gecko interfaces are shared across supported desktop platforms. Packaging is a standard ZIP-compatible XPI with forward-slash entry names.

## Known compatibility limits

- Internal CollectionTree APIs can change even within a Zotero release family. The manifest is capped at `10.0.*` with `9.0` as the minimum, and runtime feature detection guards every required view.
- Zotero 9 has been directly tested on Windows and macOS through 9.0.6. Zotero 10 menu behavior, multi-selection restoration, and platform-specific rendering still require hands-on verification before a fully verified Zotero 10 release claim.
- Rules are intentionally local and do not sync between Zotero profiles or machines.
- A production distribution must replace the reserved local-development `update_url` with a real HTTPS update manifest endpoint.
