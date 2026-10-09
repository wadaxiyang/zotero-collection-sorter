# Test record

Hands-on verification covers Zotero 9.0.x through Zotero 9.0.6 on Windows and macOS. Zotero 10 was audited against official upstream source and is covered by focused mocked API regressions, **not yet by live Zotero 10 tests**. Zotero 7, Zotero 8, and Linux have not been tested directly.

## Automated tests

Run `npm test`. The suite covers:

- default passthrough without copying or sorting;
- explicit ascending and descending name sorting;
- no mutation of Zotero's original child array;
- stable ordering for duplicate names;
- incremental equality behavior;
- stable `libraryID:key` rule identities;
- invalid pref JSON and invalid stored modes;
- the Zotero 9.0.4-required manifest fields, including `update_url`;
- deleting a rule when Default is selected;
- nested descendant skipping during incremental sibling insertion;
- invisible-parent behavior.
- cold-start rebuilding of configured open parents without redundantly rebuilding configured descendants.
- Chinese selection for all `zh-*` Zotero locales and English fallback for every non-Chinese locale.
- localized add-on manager metadata bundles for English, Simplified Chinese, and Traditional Chinese.
- manifest icon metadata and the existence of its 48px and 96px packaged icon files.
- Zotero 9 singular menu context compatibility.
- Zotero 10 plural menu context, including an intentionally throwing legacy getter and hidden multi-selection menus.
- Zotero 10 tree selection snapshot/restore across reordering with focus and pivot preservation.
- canonical SVG background transparency, with transparent PNG variants checked during asset generation.

## Zotero 9.0.4 integration checklist

- [ ] Concrete collection shows one 子分类排序 submenu with three radio entries.
- [ ] Root library, saved search, and virtual rows do not show the submenu.
- [ ] Default, ascending, and descending work for direct children only.
- [ ] Expanded parent reorders immediately without a whole-tree refresh.
- [ ] Folded parent uses the rule on its next expansion.
- [ ] New, renamed, moved, and sync-added children use the destination parent's rule.
- [ ] Child/grandchild rules remain independent; no inheritance occurs.
- [ ] Selection, expanded descendants, filter state, and scrolling remain usable.
- [ ] Disable restores default display ordering and removes the menu.
- [ ] Re-enable restores locally stored rules.
- [ ] Window close/reopen restores the instance patch correctly.
- [ ] Uninstall removes UI, active patches, and the local preference.
- [ ] Read-only group collection allows local display sorting.

The checklist is recorded as passed only after direct observation. Automated source/unit tests are not substituted for UI results.

## Zotero 10.0.x integration checklist (pending)

- [ ] Install 0.1.4 XPI on Zotero 10.0.x without compatibility warnings.
- [ ] Right-click one collection to see the three radio modes; multiple or mixed selected rows do not offer an ambiguous sort command.
- [ ] Toggle each mode on open/collapsed parents; subcollections appear in the requested order.
- [ ] Create, rename, move, and sync new subcollections; default and custom rules behave independently.
- [ ] Select multiple collections (including children under a configured parent), change a rule and check that all visible selections plus focus remain preserved.
- [ ] Reopen an existing profile with expanded configured parents; sorting and multi-selection restoration remain correct.
- [ ] Verify no duplicate menus, crashes, or changes to collection metadata; disable/uninstall safely restore default behavior.

These remain unchecked until a Zotero 10 desktop integration run is recorded.
