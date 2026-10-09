<p align="center">
  <img src="assets/collection-sorter-icon.svg" width="156" height="156" alt="Collection Sorter for Zotero icon">
</p>

<h1 align="center">Collection Sorter for Zotero</h1>

<p align="center">
  Per-parent sorting for direct child collections in Zotero.<br>
  Small, local, cross-platform, and display-only.
</p>

<p align="center">
  <a href="README-zh.md"><strong>简体中文</strong></a>
  ·
  <a href="#installation">Installation</a>
  ·
  <a href="#usage">Usage</a>
  ·
  <a href="#compatibility">Compatibility</a>
  ·
  <a href="https://github.com/wadaxiyang/zotero-collection-sorter/releases">Releases</a>
</p>

<p align="center">
  <a href="https://github.com/wadaxiyang/zotero-collection-sorter/releases/latest"><img alt="Latest release" src="https://img.shields.io/github/v/release/wadaxiyang/zotero-collection-sorter?style=flat-square&logo=github&label=release"></a>
  <a href="https://github.com/wadaxiyang/zotero-collection-sorter/actions/workflows/release.yml"><img alt="Build status" src="https://img.shields.io/github/actions/workflow/status/wadaxiyang/zotero-collection-sorter/release.yml?style=flat-square&logo=githubactions&logoColor=white&label=build"></a>
  <a href="https://github.com/wadaxiyang/zotero-collection-sorter/releases"><img alt="Total downloads" src="https://img.shields.io/github/downloads/wadaxiyang/zotero-collection-sorter/total?style=flat-square&logo=github&label=downloads"></a>
  <a href="https://www.zotero.org/"><img alt="Zotero 9 and 10" src="https://img.shields.io/badge/Zotero-9%20%26%2010-CC2936?style=flat-square&logo=zotero&logoColor=white"></a>
  <a href="LICENSE"><img alt="MIT License" src="https://img.shields.io/github/license/wadaxiyang/zotero-collection-sorter?style=flat-square&label=license"></a>
</p>

> [!NOTE]
> This is an unofficial third-party plugin. It is not affiliated with Zotero or the Corporation for Digital Scholarship.

## Overview

Collection Sorter adds one focused capability to Zotero's collection tree: each concrete collection can independently control how its **direct child collections** are displayed.

```text
Sort Child Collections
├─ Zotero Default
├─ Name Ascending A → Z
└─ Name Descending Z → A
```

For example, a conference collection can display years in descending order while every year continues to display venues in ascending order:

```text
01_Conference          [Name Descending]
├─ 2026                [Name Ascending]
│  ├─ AAAI
│  ├─ ACL
│  ├─ CVPR
│  ├─ ICASSP
│  └─ ICLR
├─ 2025
└─ 2024
```

The plugin does not understand years, conferences, journals, or naming conventions. It only compares collection names with Zotero's own locale-aware collation.

## Features

- **Independent per-parent rules** — configure each parent collection separately.
- **Direct children only** — rules never inherit and never propagate recursively.
- **Three explicit modes** — Zotero Default, Name Ascending, and Name Descending.
- **Immediate tree updates** — create, rename, move, and sync-driven additions use the destination parent's rule.
- **Cold-start correction** — already-expanded configured parents are locally rebuilt after Zotero restores the tree.
- **Rename-safe persistence** — rules use stable `libraryID:collectionKey` identities.
- **Automatic language selection** — Chinese Zotero locales use Chinese; all other locales use English.
- **Local-only configuration** — rules remain in the current Zotero profile and are not synced.
- **One cross-platform XPI** — no platform-specific runtime API or filesystem path.

## Installation

1. Download the latest `.xpi` from the [**Releases page**](https://github.com/wadaxiyang/zotero-collection-sorter/releases/latest).
2. Open **Tools → Plugins** in Zotero.
3. Open the gear menu and choose **Install Plugin From File…**, or drag the XPI into the Plugins window.
4. Right-click a concrete collection and open **Sort Child Collections**.

<p align="center">
  <a href="https://github.com/wadaxiyang/zotero-collection-sorter/releases/latest"><strong>Download the latest release →</strong></a>
</p>

Installing a newer XPI over an existing version preserves all local sorting rules.

## Usage

1. Right-click the parent collection whose direct children you want to order.
2. Open **Sort Child Collections**.
3. Select **Zotero Default**, **Name Ascending A → Z**, or **Name Descending Z → A**.

An expanded parent is reordered immediately. A collapsed parent uses the selected rule the next time it is expanded. Choosing **Zotero Default** removes the stored mapping for that parent.

## Compatibility

| Component | Status |
| --- | --- |
| Zotero Desktop `9.0.x` | **Supported** — verified through Zotero 9.0.6 |
| Zotero Desktop `10.0.x` | **Declared compatible** — official source audit + targeted regression checks; in-app verification pending |
| Windows | **Tested** with Zotero 9 |
| macOS | **Tested** with Zotero 9 |
| Linux | Platform-neutral code, but **not yet tested directly** |
| Zotero 7 / Zotero 8 | **Not tested and not declared compatible** |

Version 0.1.4 declares Zotero `9.0` through `10.0.*` compatibility. Zotero 9 was verified in-app through 9.0.6 on Windows and macOS. Zotero 10 compatibility was checked against the upstream [Zotero 10.0 source](https://github.com/zotero/zotero/tree/10.0) and its [developer migration guide](https://www.zotero.org/support/dev/zotero_10_for_developers), and exercised with focused automated regressions. **Live UI testing on Zotero 10 is still required before claiming full verification.** Zotero 10's multi-selection menu context is handled only for a single concrete collection; the custom sort command is intentionally hidden for mixed or multiple selections.

Because this plugin uses a small set of internal CollectionTree methods, compatibility is deliberately conservative. If a required API is missing, the plugin fails closed instead of installing a risky fallback.

## Language behavior

The plugin follows `Zotero.locale` automatically and does not add a separate preferences page:

- `zh-*` Zotero locales → Chinese menu labels.
- Every other Zotero locale → English menu labels.

The Plugins manager name and description include English, Simplified Chinese, and Traditional Chinese locale bundles.

## Safety model

Collection Sorter changes only the collection tree's display order. It does **not**:

- rename, move, or modify collection metadata;
- modify references, PDFs, attachments, or notes;
- create hidden collections, items, or database tables;
- write plugin settings into Zotero Sync;
- patch `Zotero.Collections.getByParent()` or replace `Zotero.localeCompare()`;
- reload or refresh the entire Collection Tree;
- alter root libraries, saved searches, or virtual rows.

If the plugin is disabled or cannot run, the tree simply falls back to Zotero's default order. User data remains unchanged.

## Development

### Requirements

- [Node.js 20+](https://nodejs.org/)
- A shell environment that provides `zip`

### Test and build

```bash
npm test
bash scripts/build-xpi.sh
```

The package is written to:

```text
dist/zotero-collection-sorter-<version>.xpi
```

There are no runtime dependencies and no TypeScript, Webpack, React, or similar build framework.

### Automated releases

[GitHub Actions](https://github.com/wadaxiyang/zotero-collection-sorter/actions/workflows/release.yml) handles releases:

- Every push to `main`, and every manual workflow run, tests and packages the project and uploads XPI and SHA-256 artifacts.
- Pushing a matching `v*` tag additionally publishes a GitHub Release.

```bash
# Update manifest.json and package.json first
git tag v0.1.4
git push origin v0.1.4
```

The tag must match the manifest version exactly.

## Project structure

```text
.
├─ .github/                  # Release workflow and release notes
├─ _locales/                # Add-on manager localization
├─ assets/                  # Project SVG and packaged PNG icons
├─ scripts/build-xpi.sh     # Dependency-free XPI packager
├─ src/
│  ├─ localization.js       # Chinese/English runtime labels
│  ├─ plugin.js             # Lifecycle, menu, and tree patches
│  ├─ rule-store.js         # Local validated preference cache
│  └─ sort-engine.js        # Name-only comparison behavior
├─ test/                    # Node.js regression tests
├─ bootstrap.js
├─ manifest.json
└─ prefs.js
```

See [**Development notes**](DEVELOPMENT.md) for the implementation audit and [**Test record**](TESTING.md) for the regression matrix.

## Local configuration

The plugin stores one local preference:

```text
extensions.zotero.collectionSort.rules
```

Example value:

```json
{
  "1:ABCDEFGH": "desc",
  "2:JKLMN123": "asc"
}
```

Malformed JSON and unsupported mode values are ignored safely.

## Limitations

- Rules do not sync between devices.
- Natural numeric ordering, year detection, multi-key sorting, and custom drag ordering are intentionally unsupported.
- Zotero 10 has been source-audited and regression-tested but not yet verified in a live Zotero 10 UI. Zotero 7, Zotero 8, and Linux have not been tested directly.
- Major Zotero or CollectionTree changes require a new compatibility review.
- Automatic plugin updates are not yet configured; install newer XPI releases manually.

## Contributing

Issues and focused pull requests are welcome:

- [**Report a bug**](https://github.com/wadaxiyang/zotero-collection-sorter/issues/new)
- [**Browse open issues**](https://github.com/wadaxiyang/zotero-collection-sorter/issues)
- [**View the source**](https://github.com/wadaxiyang/zotero-collection-sorter)

When reporting a tree-ordering issue, include your Zotero version, operating system, parent/child collection structure, selected mode, and whether the issue occurs during startup or an incremental update.

## License

Collection Sorter for Zotero is released under the [**MIT License**](LICENSE).

<p align="center">
  <a href="#collection-sorter-for-zotero">Back to top ↑</a>
</p>
