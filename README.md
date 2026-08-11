# Collection Sorter for Zotero

<p align="center">
  <img src="assets/collection-sorter-icon.svg" width="160" height="160" alt="Collection Sorter for Zotero icon">
</p>

[GitHub Repository](https://github.com/wadaxiyang/zotero-collection-sorter) · [Releases](https://github.com/wadaxiyang/zotero-collection-sorter/releases) · [MIT License](LICENSE)

> 为 Zotero 的每个父分类独立设置直接子分类的显示顺序。  
> Set the display order of direct child collections independently for each parent collection in Zotero.

Collection Sorter for Zotero 是一个小型、跨平台、仅改变界面显示的 Zotero 9 插件。它允许你在具体 Collection 的右键菜单中选择 Zotero 默认排序、名称升序或名称降序，并为不同父分类分别保存设置。

Collection Sorter for Zotero is a small, cross-platform, display-only plugin for Zotero 9. It lets you choose Zotero's default order, ascending name order, or descending name order from a collection's context menu, with an independent setting for every parent collection.

本项目是非官方第三方插件，与 Zotero 官方及 Corporation for Digital Scholarship 无隶属关系。

This is an unofficial third-party plugin and is not affiliated with Zotero or the Corporation for Digital Scholarship.

---

## 中文说明

### 它能做什么

右键点击一个具体分类，打开：

```text
子分类排序 >
    Zotero 默认
    名称升序 A → Z
    名称降序 Z → A
```

所选规则只控制该分类的直接子分类。例如：

```text
01_Conference          [名称降序]
├─ 2026
├─ 2025
└─ 2024
```

`2026` 下的分类不会继承 `01_Conference` 的降序规则。你可以让它继续使用 Zotero 默认顺序，也可以单独设为升序或降序：

```text
2026                  [名称升序]
├─ AAAI
├─ ACL
├─ CVPR
├─ ICASSP
└─ ICLR
```

插件只比较 Collection 的名称，不理解“年份”“会议”“期刊”等语义。

### 主要特性

- 每个父 Collection 独立设置规则。
- 只影响直接子 Collection，不继承、不递归传播。
- 支持 Zotero 默认、名称升序和名称降序三种模式。
- 新建、重命名、移动或同步进入的子分类会立即按目标父分类的规则显示。
- 规则使用 `libraryID:collectionKey` 保存，父分类改名后仍然有效。
- 规则保存在本机 Zotero profile，不参与 Zotero Sync。
- Zotero 冷启动恢复展开状态时，会局部重建已展开且设置过规则的父分类。
- 界面语言自动跟随 Zotero：中文 Zotero 显示中文，其他语言统一显示英文，无需单独设置页。
- 支持 Windows、macOS 和 Linux；运行时代码不依赖任何平台专属 API。

### 安全边界

这是一个纯显示层插件。它不会：

- 修改 Collection 名称、层级或元数据；
- 修改文献、PDF、附件或笔记；
- 创建隐藏 Collection、Item 或数据库表；
- 写入 Zotero Sync 数据；
- 刷新或重载整棵 Collection Tree；
- 改变根 Library、Saved Search 或虚拟分类的排序。

插件禁用或失效时，最坏结果只是界面恢复成 Zotero 默认排序，不会污染用户数据。

### 兼容性

- 当前支持版本：Zotero Desktop `9.0.x`，已验证可用于目前最新的 Zotero `9.0.6`。
- 已测试平台：Windows 和 macOS。
- Linux 运行时代码与 Windows/macOS 共用同一份 XPI，且不含平台专属 API，但目前尚未进行实际平台测试。
- Zotero 7 和 Zotero 8 尚未测试，当前 manifest 也未声明兼容；本版本不能安装到 Zotero 7/8。
- 最初的内部源码核对基线为 Zotero 9.0.4，BuildID `20260522110811`；实际兼容性测试已覆盖至 9.0.6。
- manifest 限制为 Zotero `9.0.*`，因为插件会以最小范围调用 CollectionTree 内部方法。

Zotero 更新后，如果关键内部接口缺失，插件会 fail closed：不安装危险 patch、不修改数据，也不会改用整树刷新作为降级方案。

### 安装

1. 从 GitHub Releases 下载最新的 `.xpi` 文件。
2. 在 Zotero 中打开 **工具 → 插件**（Tools → Plugins）。
3. 将 XPI 拖入插件窗口，或使用齿轮菜单选择 **Install Plugin From File…**。
4. 安装完成后，在具体 Collection 上点击右键即可看到 **子分类排序**。

升级时安装新版本 XPI 即可；本地排序规则会保留。

### 使用方法

1. 右键点击需要控制子分类顺序的父 Collection。
2. 选择 **子分类排序**。
3. 选择 **Zotero 默认**、**名称升序 A → Z** 或 **名称降序 Z → A**。
4. 如果父分类已经展开，界面会立即局部重排；如果处于折叠状态，下次展开时生效。

选择 **Zotero 默认** 会删除该父分类保存的插件规则，而不是保存一个名为 `default` 的配置。

### 从源码测试与构建

要求：Node.js 20 或更高版本，以及提供 `zip` 命令的环境。

```bash
npm test
bash scripts/build-xpi.sh
```

生成的文件位于：

```text
dist/zotero-collection-sorter-<version>.xpi
```

项目没有运行时依赖，也不需要 TypeScript、Webpack、React 或其他构建框架。

### GitHub 自动发布

仓库包含 `.github/workflows/release.yml`：

- 普通手动运行 Workflow：执行测试并上传 XPI 和 SHA-256 artifact，不创建 Release。
- 推送 `v*` 标签：执行测试、检查标签版本与 `manifest.json` 一致、构建 XPI、生成 SHA-256，并自动创建 GitHub Release。

发布示例：

```bash
# 先同时更新 manifest.json 和 package.json 中的版本号
git tag v0.1.2
git push origin v0.1.2
```

标签 `v0.1.2` 必须与 manifest 的 `0.1.2` 完全一致，否则 Action 会停止发布。

### 配置存储

插件只使用一个本地 preference：

```text
extensions.zotero.collectionSort.rules
```

其 JSON 内容类似：

```json
{
  "1:ABCDEFGH": "desc",
  "2:JKLMN123": "asc"
}
```

损坏的 JSON 或不受支持的值会被安全忽略。

### 项目结构

```text
.
├─ manifest.json
├─ bootstrap.js
├─ prefs.js
├─ assets/
│  ├─ collection-sorter-icon.svg
│  ├─ icon-48.png
│  └─ icon-96.png
├─ _locales/
│  ├─ en/
│  ├─ zh_CN/
│  └─ zh_TW/
├─ src/
│  ├─ localization.js
│  ├─ plugin.js
│  ├─ rule-store.js
│  └─ sort-engine.js
├─ test/
├─ scripts/build-xpi.sh
└─ .github/workflows/release.yml
```

更多实现细节和兼容性核对结果见 [DEVELOPMENT.md](DEVELOPMENT.md)，测试矩阵见 [TESTING.md](TESTING.md)。

### 已知限制

- 排序规则不会在不同设备之间同步。
- 不支持自然数字排序、年份识别、多键排序或自定义拖拽顺序。
- Zotero 大版本或 CollectionTree 内部实现变化后需要重新验证兼容性。
- 当前 `update_url` 是本地开发占位地址；正式发布自动更新前需要替换为真实的 HTTPS 更新清单地址。

### 许可证

本项目采用 [MIT License](LICENSE)。你可以自由使用、复制、修改、合并、发布和分发本项目，但必须保留原始版权与许可声明。

---

## English

### What it does

Right-click a concrete collection and open:

```text
Sort Child Collections >
    Zotero Default
    Name Ascending A → Z
    Name Descending Z → A
```

The selected rule controls only that collection's direct children. For example:

```text
01_Conference          [Name Descending]
├─ 2026
├─ 2025
└─ 2024
```

Collections below `2026` do not inherit the rule from `01_Conference`. They can keep Zotero's default order or have their own explicit rule:

```text
2026                  [Name Ascending]
├─ AAAI
├─ ACL
├─ CVPR
├─ ICASSP
└─ ICLR
```

The plugin compares collection names only. It has no special understanding of years, conferences, journals, or naming conventions.

### Features

- Independent rule for every parent collection.
- Direct children only, with no inheritance or recursive propagation.
- Zotero Default, Name Ascending, and Name Descending modes.
- Newly created, renamed, moved, or synced child collections are placed immediately according to the destination parent's rule.
- Rules use stable `libraryID:collectionKey` identities and survive parent renames.
- Rules remain local to the Zotero profile and are not written to Zotero Sync.
- Already-expanded configured parents are locally rebuilt after Zotero restores the tree on a cold start.
- The UI follows Zotero automatically: Chinese Zotero locales use Chinese, while every other locale falls back to English. No plugin settings pane is required.
- One cross-platform XPI for Windows, macOS, and Linux, with no platform-specific runtime APIs.

### Safety model

This is a display-only plugin. It does not:

- rename, move, or modify collection metadata;
- modify references, PDFs, attachments, or notes;
- create hidden collections, items, or database tables;
- write configuration into Zotero Sync;
- reload or refresh the entire Collection Tree;
- change root libraries, saved searches, or virtual rows.

If the plugin is disabled or cannot run, the tree simply falls back to Zotero's default order. User data remains unchanged.

### Compatibility

- Currently supported: Zotero Desktop `9.0.x`, verified through the current Zotero `9.0.6` release.
- Tested platforms: Windows and macOS.
- Linux uses the same platform-neutral XPI and the runtime contains no OS-specific APIs, but Linux has not yet been tested directly.
- Zotero 7 and Zotero 8 have not been tested and are not declared compatible by the current manifest. This release cannot be installed on Zotero 7/8.
- The original internal source audit used Zotero 9.0.4, BuildID `20260522110811`; hands-on compatibility testing now covers Zotero 9.0.6.
- The manifest is capped at Zotero `9.0.*` because the plugin uses a small set of internal CollectionTree methods.

If a future Zotero build is missing a required internal API, the plugin fails closed. It does not install a risky patch, alter data, or fall back to reloading the whole tree.

### Installation

1. Download the latest `.xpi` file from GitHub Releases.
2. Open **Tools → Plugins** in Zotero.
3. Drag the XPI into the Plugins window, or choose **Install Plugin From File…** from the gear menu.
4. Right-click a concrete collection and open **Sort Child Collections**.

Install the newer XPI over the existing version to upgrade. Stored local rules are preserved.

### Usage

1. Right-click the parent collection whose children you want to order.
2. Open **Sort Child Collections**.
3. Choose **Zotero Default**, **Name Ascending A → Z**, or **Name Descending Z → A**.
4. An expanded parent is locally reordered immediately. A collapsed parent uses the rule the next time it is expanded.

Choosing **Zotero Default** removes the stored mapping for that parent rather than storing a `default` value.

### Testing and building from source

Requirements: Node.js 20 or newer and an environment that provides the `zip` command.

```bash
npm test
bash scripts/build-xpi.sh
```

The package is written to:

```text
dist/zotero-collection-sorter-<version>.xpi
```

There are no runtime dependencies and no TypeScript, Webpack, React, or similar build framework.

### Automated GitHub releases

The repository includes `.github/workflows/release.yml`:

- Running the workflow manually tests the project and uploads the XPI and SHA-256 files as workflow artifacts without publishing a release.
- Pushing a `v*` tag tests the project, verifies that the tag matches `manifest.json`, builds the XPI, creates a SHA-256 file, and publishes a GitHub Release.

Example release:

```bash
# First update the version in both manifest.json and package.json
git tag v0.1.2
git push origin v0.1.2
```

Tag `v0.1.2` must match manifest version `0.1.2` exactly or the workflow stops before publishing.

### Local configuration

The plugin uses one local preference:

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

Malformed JSON and unsupported values are ignored safely.

### Project layout

```text
.
├─ manifest.json
├─ bootstrap.js
├─ prefs.js
├─ assets/
│  ├─ collection-sorter-icon.svg
│  ├─ icon-48.png
│  └─ icon-96.png
├─ _locales/
│  ├─ en/
│  ├─ zh_CN/
│  └─ zh_TW/
├─ src/
│  ├─ localization.js
│  ├─ plugin.js
│  ├─ rule-store.js
│  └─ sort-engine.js
├─ test/
├─ scripts/build-xpi.sh
└─ .github/workflows/release.yml
```

See [DEVELOPMENT.md](DEVELOPMENT.md) for implementation and compatibility details, and [TESTING.md](TESTING.md) for the test matrix.

### Known limitations

- Rules do not sync between devices.
- Natural numeric ordering, year detection, multi-key sorting, and custom drag ordering are intentionally unsupported.
- Compatibility must be reviewed after major Zotero or CollectionTree internal changes.
- `update_url` is currently a local-development placeholder. Replace it with a real HTTPS update manifest endpoint before offering automatic production updates.

### License

This project is released under the [MIT License](LICENSE). You may use, copy, modify, merge, publish, and distribute the software as long as the original copyright and license notice are retained.
