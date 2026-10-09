# Collection Sorter for Zotero development constraints

- Target Zotero 9.x and 10.x Desktop. Zotero 9 has been verified in-app through 9.0.6; Zotero 10 has been source-audited and regression-checked but still requires live UI verification. Compatibility must fail closed if required internal APIs are absent.
- Runtime code must work on Windows, macOS, and Linux. Do not use platform-specific paths, shell commands, native APIs, or UI assumptions in plugin code.
- This is display-only sorting. Never rename or move collections, alter Zotero data/metadata, write sync data, or add a database table.
- Implement only per-parent sorting of direct child collections: Zotero default, name ascending, or name descending. Rules never inherit and root libraries are never configurable.
- Keep the dual-entry approach: patch managed main-tree `CollectionTreeRow.getChildren()` calls and each managed view's `_addSortedRow()` collection branch. Never patch `Zotero.Collections.getByParent()`, replace `Zotero.localeCompare`, or use full-tree `reload()`/`refresh()` as a fallback.
- Preserve and safely restore original functions. Wrappers must become pass-through when inactive, and teardown must not overwrite a later third-party wrapper.
- Keep dependencies at zero unless a concrete requirement proves otherwise. Run `npm test` before packaging.

- Zotero 10 menu contexts expose `collectionTreeRows`, while reading the deprecated `collectionTreeRow` throws. Support Zotero 9's singular context as a safe fallback and hide commands for multi-selection rather than silently choosing one collection.
- Zotero 10 supports multiple selected collection rows. When rebuilding any container, preserve selected IDs, focused ID, and pivot ID; do not collapse valid multi-selection into one row.
