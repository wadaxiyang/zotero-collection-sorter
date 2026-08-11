# Collection Sorter for Zotero development constraints

- Target Zotero 9.x Desktop. The currently verified baseline is Zotero 9.0.4 (BuildID 20260522110811), and compatibility must fail closed if required internal APIs are absent.
- Runtime code must work on Windows, macOS, and Linux. Do not use platform-specific paths, shell commands, native APIs, or UI assumptions in plugin code.
- This is display-only sorting. Never rename or move collections, alter Zotero data/metadata, write sync data, or add a database table.
- Implement only per-parent sorting of direct child collections: Zotero default, name ascending, or name descending. Rules never inherit and root libraries are never configurable.
- Keep the dual-entry approach: patch managed main-tree `CollectionTreeRow.getChildren()` calls and each managed view's `_addSortedRow()` collection branch. Never patch `Zotero.Collections.getByParent()`, replace `Zotero.localeCompare`, or use full-tree `reload()`/`refresh()` as a fallback.
- Preserve and safely restore original functions. Wrappers must become pass-through when inactive, and teardown must not overwrite a later third-party wrapper.
- Keep dependencies at zero unless a concrete requirement proves otherwise. Run `npm test` before packaging.
