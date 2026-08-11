# Development notes

## Verified Zotero source baseline

The installed and running application was inspected before implementation:

- Zotero version: 9.0.4
- Application BuildID: `20260522110811`
- Gecko platform BuildID: `20260414220523`
- Application source archive: `/Applications/Zotero.app/Contents/Resources/app/omni.ja`

The internal API audit above remains tied to the exact 9.0.4 build. Subsequent hands-on compatibility testing on Windows and macOS has verified the plugin through Zotero 9.0.6. Zotero 7, Zotero 8, and Linux have not been tested directly; the current manifest intentionally declares only Zotero 9.0.x compatibility.

Confirmed in that exact build:

- `Zotero.CollectionTreeRow.prototype.getChildren()` returns `Zotero.Collections.getByParent(this.ref.id)` for collection rows.
- `ZoteroPane.collectionsView` is initialized with `CollectionTree.init()`.
- collection add and collection modify/move paths call `collectionsView._addSortedRow("collection", id)`.
- `_addSortedRow()`, `_addRow()`, `_includedInTree()`, `_closeContainer()`, `toggleOpenState()`, and the row/container query methods are present.
- `Zotero.MenuManager` accepts target `main/library/collection`.
- In Zotero 9.0.4, the menu context contains singular `collectionTreeRow`; the implementation intentionally follows the installed source rather than the manual's provisional plural example.
- Zotero 9.0.4's manifest parser requires `applications.zotero.update_url`. This project uses the reserved, non-resolving `.invalid` URL `https://collection-sort.invalid/updates.json` as a local-development placeholder; no update service is implemented.

If these members are missing, the plugin fails closed and does not switch to a full-tree refresh strategy.

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

- Internal CollectionTree APIs can change even within a Zotero release family. The manifest is capped at `9.0.*`, and runtime feature detection guards every required view.
- The verified UI baseline is macOS. Windows is a required runtime target and the code is platform-neutral, but radio rendering and the complete integration matrix still need hands-on Windows Zotero 9 verification before a production release claim.
- Rules are intentionally local and do not sync between Zotero profiles or machines.
- A production distribution must replace the reserved local-development `update_url` with a real HTTPS update manifest endpoint.
