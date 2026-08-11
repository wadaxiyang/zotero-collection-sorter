# Zotero Collection Sort 插件开发手册

> **文档用途**：直接交给 Codex 作为实现规格、技术设计与验收标准。  
> **目标平台**：Zotero 9.x Desktop，Windows 优先；运行时代码不得依赖 Windows 专属 API。  
> **技术路线**：**方案 A——双入口 patch**。从第一版开始就采用方案 A，**不实施、也不保留“先方案 B、后方案 A”的过渡路线**。  
> **文档日期**：2026-08-10

---

## 0. 最高优先级指令

Codex 在实现本项目时，必须把本节视为不可擅自扩展或修改的产品边界。

### 0.1 必须实现

插件允许用户在 **具体 Collection 的右键菜单**中，为该 Collection 的**直接子 Collection**设置显示排序方式：

- `Zotero 默认`
- `名称升序 A → Z`
- `名称降序 Z → A`

规则以**父 Collection 为单位**独立保存。

示例：

```text
00_Inbox
01_Conference
02_Journal
03_Preprint
```

根 Library 不设置规则，继续使用 Zotero 默认顺序。

假设：

```text
01_Conference    [名称降序]
├─ 2026
├─ 2025
└─ 2024
```

而：

```text
2026             [Zotero 默认]
├─ AAAI
├─ ACL
├─ CVPR
├─ ICASSP
└─ ICLR
```

则插件必须得到上述结果。

### 0.2 明确禁止

以下内容 **不得实现**：

- 不做“自定义规则”。
- 不做年份识别。
- 不做 `YYYY_Venue` 解析。
- 不把 `2026_ICASSP` 拆成 `{ year, venue }`。
- 不做数字自然排序。
- 不做日期排序。
- 不做多键排序。
- 不做正则表达式排序。
- 不做拖拽式自定义顺序。
- 不做排序规则继承。
- 不做递归规则传播。
- 不做全局排序开关。
- 不给左侧栏增加图标。
- 不增加工具栏按钮。
- 不增加独立设置页 / Preferences Pane。
- 不做云同步。
- 不调用 Zotero Sync API 保存配置。
- 不修改 Collection 名称。
- 不增加数字前缀。
- 不修改 Collection 的 bibliographic/business metadata。
- 不通过数据库字段伪造排序。
- 不修改用户 PDF、文献条目或附件。
- 不使用方案 B 的“Collection 变化后刷新整棵 Tree”作为正式实现或降级实现。
- 不临时替换全局 `Zotero.localeCompare`。
- 不全局 patch `Zotero.Collections.getByParent()`。
- 不复制/重写整套 Collection Tree。
- 不为了“未来可能有用”加入用户没有要求的功能。

### 0.3 核心安全原则

本插件是：

> **Display-only / View-only sorting plugin**

即：

```text
Zotero 数据层不变
        ↓
Collection Tree 显示层改变顺序
```

最坏情况下，插件失效时只能出现：

> “排序恢复成 Zotero 默认”

而不能出现：

> “Collection 被改名、层级被修改、数据被污染、产生同步冲突”。

---

# 1. 开发难度判断

## 1.1 结论

采用方案 A 后，整体开发难度约为：

> **4 / 10，中低难度。**

难点不在排序算法，而在：

1. 正确接入 Zotero Collection Tree 的两个排序入口；
2. 保证新增、改名、移动后仍立即处于正确位置；
3. 插件禁用或窗口关闭时完整恢复 patch；
4. 尽量减少对 Zotero 内部 Tree 实现的侵入。

## 1.2 为什么方案 A 可以直接采用

当前 Zotero 源码中存在两个明确入口：

### 初始展开 / 重建路径

```text
CollectionTreeRow.prototype.getChildren()
```

Collection 行会通过：

```js
Zotero.Collections.getByParent(this.ref.id)
```

取得直接子 Collection。

### 增量更新路径

```text
CollectionTree._addSortedRow(objectType, id)
```

Collection 新建、重命名、移动等情况下，当前 Tree 会将 Collection 重新插入展开的树。

因此方案 A 的目标非常清晰：

```text
getChildren()
        +
_addSortedRow()
        ↓
共用 RuleStore / comparator
```

无需全树 refresh。

---

# 2. 必须先做的源码核对

**禁止直接按照 GitHub master 猜测用户当前 Zotero 构建。**

Codex 开始编码前必须：

1. 确认实际目标 Zotero 版本，例如从运行时读取：

```js
Zotero.version
```

2. 找到尽可能匹配该 Zotero 版本的源码 tag / commit。
3. 核对以下成员仍存在且语义一致：

```js
Zotero.CollectionTreeRow.prototype.getChildren
win.ZoteroPane.collectionsView
win.ZoteroPane.collectionsView._addSortedRow
win.ZoteroPane.collectionsView._closeContainer
win.ZoteroPane.collectionsView.toggleOpenState
Zotero.MenuManager.registerMenu
Zotero.MenuManager.unregisterMenu
```

4. 如果这些关键结构在目标版本中发生明显变化：

> **停止并报告兼容性问题。**

不得偷偷改用“全树 refresh”的方案 B。

---

# 3. 当前 Zotero 9 源码事实基线

以下是设计方案所依据的当前 Zotero 源码事实。实际开发仍应以用户正在使用的版本源码为准。

## 3.1 `getChildren()`

当前：

```js
Zotero.CollectionTreeRow.prototype.getChildren = function () {
    if (this.isLibrary(true)) {
        return Zotero.Collections.getByLibrary(this.ref.libraryID);
    }
    else if (this.isCollection()) {
        return Zotero.Collections.getByParent(this.ref.id);
    }
    else if (this.isFeeds()) {
        return Zotero.Feeds.getAll().sort(
            (a, b) => Zotero.localeCompare(a.name, b.name)
        );
    }
}
```

设计意义：

- Library root 可以保持完全不处理。
- 只有 `this.isCollection()` 时读取当前父 Collection 的规则。
- 规则自然只影响其“直接 children”。

## 3.2 Zotero 当前默认子 Collection 排序

当前 `Zotero.Collections.getByParent()` 最终会对 children 做：

```js
children.sort((a, b) => Zotero.localeCompare(a.name, b.name));
```

因此当前 Zotero 的默认行为实质上是名称升序。

但本插件必须仍然区分：

```text
Zotero 默认
```

与：

```text
名称升序
```

两者语义不同：

- `default`：插件不干预，未来 Zotero 改默认规则时跟随 Zotero。
- `asc`：插件明确要求 A → Z。

## 3.3 `_addSortedRow()`

当前 `_addSortedRow('collection', id)` 会：

1. 读取 Collection；
2. 找到 parent；
3. 检查 parent 是否可见；
4. 检查 parent 是否展开；
5. 确定目标层级；
6. 跳过不属于目标 sibling 层级的节点；
7. 使用 `Zotero.localeCompare()` 找插入点；
8. 通过 `_addRow()` 加入 Tree。

当前升序关键比较为：

```js
if (Zotero.localeCompare(treeRow.ref.name, collection.name) > 0) {
    break;
}
```

降序的核心差异应为：

```js
if (Zotero.localeCompare(treeRow.ref.name, collection.name) < 0) {
    break;
}
```

但实现时不能只粗暴替换这一行；必须保留 Zotero 原函数对层级、展开状态、过滤状态和虚拟节点的处理逻辑。

---

# 4. 总体架构

建议逻辑模块：

```text
bootstrap.js
    │
    ├── PluginLifecycle
    │
    ├── RuleStore
    │
    ├── SortEngine
    │
    ├── TreePatchManager
    │       ├── getChildren patch
    │       └── _addSortedRow patch
    │
    ├── ContextMenuManager
    │
    └── LocalSubtreeRebuilder
```

V1 可以物理上拆文件，也可以先放在较少文件中。

**逻辑职责必须分开。**

建议目录：

```text
zotero-collection-sort/
├─ manifest.json
├─ bootstrap.js
├─ prefs.js
└─ src/
   ├─ rule-store.js
   ├─ sort-engine.js
   ├─ tree-patch.js
   └─ context-menu.js
```

不要求 React、Vue、TypeScript、Webpack 等构建体系。

这是小插件，优先保持：

> **纯 JavaScript + 极少依赖 + 可直接检查。**

---

# 5. 数据模型

## 5.1 唯一配置项

建议使用一个本地 pref：

```text
extensions.zotero.collectionSort.rules
```

值为 JSON 字符串。

例如：

```json
{
  "1:ABCDEFGH": "desc",
  "1:JKLNMOPQ": "asc"
}
```

## 5.2 Key 规则

禁止使用 Collection 名称作为 key：

```text
01_Conference
```

因为用户可能改名。

应使用：

```text
libraryID + ":" + collection.key
```

例如：

```text
1:ABCDEFGH
```

辅助函数：

```js
function makeRuleKey(collection) {
    return `${collection.libraryID}:${collection.key}`;
}
```

这样：

```text
01_Conference
```

改名为：

```text
01_Conference_New
```

排序规则仍然保留。

## 5.3 允许的值

仅允许：

```text
asc
desc
```

**不要保存 `default`。**

“Zotero 默认”代表：

> 删除这一条映射。

即：

```js
rules.delete(key);
```

这样无配置即默认，逻辑最干净。

## 5.4 本地保存

使用 Zotero profile 本地 preferences。

不得：

- 写 Zotero Sync metadata；
- 创建隐藏 Collection；
- 创建隐藏 Item；
- 使用数据库表保存插件规则；
- 把规则写进 Collection 名称；
- 把规则写入 extra 字段。

## 5.5 缓存

不要在每一次 comparator 调用时读取并 parse pref。

启动时：

```text
Pref JSON
   ↓
Map
```

运行期间从 Map 同步读取。

修改后：

```text
Map
 ↓
JSON.stringify()
 ↓
Zotero.Prefs.set()
```

---

# 6. RuleStore 设计

建议接口：

```js
RuleStore.load()
RuleStore.getMode(collection)
RuleStore.setMode(collection, mode)
RuleStore.clearMode(collection)
RuleStore.save()
RuleStore.makeKey(collection)
```

示意：

```js
const VALID_MODES = new Set(["asc", "desc"]);

const RuleStore = {
    rules: new Map(),

    load() {
        // read pref
        // JSON.parse
        // validate each value
        // invalid content => ignore safely, log warning
    },

    getMode(collection) {
        return this.rules.get(this.makeKey(collection)) || "default";
    },

    setMode(collection, mode) {
        if (mode === "default") {
            this.rules.delete(this.makeKey(collection));
        }
        else if (VALID_MODES.has(mode)) {
            this.rules.set(this.makeKey(collection), mode);
        }
        else {
            throw new Error(`Invalid sort mode: ${mode}`);
        }
        this.save();
    },

    makeKey(collection) {
        return `${collection.libraryID}:${collection.key}`;
    }
};
```

---

# 7. SortEngine 设计

## 7.1 comparator

唯一排序字段：

> `Collection.name`

必须使用 Zotero 自身 collation：

```js
Zotero.localeCompare()
```

升序：

```js
function compareAsc(a, b) {
    return Zotero.localeCompare(a.name, b.name);
}
```

降序：

```js
function compareDesc(a, b) {
    return Zotero.localeCompare(b.name, a.name);
}
```

## 7.2 default

`default` 不应调用插件 comparator。

```js
if (mode === "default") {
    return originalResult;
}
```

## 7.3 相同名称

如果两个 sibling 名称相同：

```js
Zotero.localeCompare(a.name, b.name) === 0
```

V1 不添加新的第三排序键。

要求：

> **保持原相对顺序，避免无意义抖动。**

不要自动用 ID、key 或创建时间做第三排序。

---

# 8. 方案 A 第一入口——`getChildren()` patch

## 8.1 为什么 patch 这里

Collection Tree 展开 Collection 时会：

```text
treeRow.getChildren()
```

然后按照返回数组顺序插入 Collection 行。

因此在这里排序，可以覆盖：

- Zotero 启动后的树构建；
- Collection 展开；
- Collection 折叠后重新展开；
- 局部重建。

## 8.2 不要 patch `Zotero.Collections.getByParent()`

禁止：

```js
Zotero.Collections.getByParent = ...
```

原因：

这属于数据访问层，可能被：

- Collection Tree；
- 对话框；
- Search UI；
- 其他插件；
- Zotero 内部其他逻辑

共同使用。

我们的需求只针对主界面左侧 Collection Tree。

## 8.3 patch 策略

保存原函数：

```js
const originalGetChildren =
    Zotero.CollectionTreeRow.prototype.getChildren;
```

安装 wrapper：

```js
function patchedGetChildren(...args) {
    const children = originalGetChildren.apply(this, args);

    // 只允许作用于插件当前管理的 Collection Tree view
    if (!TreePatchManager.isManagedView(this.view)) {
        return children;
    }

    // Library / Feeds / Saved Search / Virtual rows 不处理
    if (!this.isCollection()) {
        return children;
    }

    const mode = RuleStore.getMode(this.ref);

    if (mode === "default") {
        return children;
    }

    // 不修改 Zotero 原数组，复制后排序
    const sorted = [...children];

    if (mode === "asc") {
        sorted.sort((a, b) => Zotero.localeCompare(a.name, b.name));
    }
    else if (mode === "desc") {
        sorted.sort((a, b) => Zotero.localeCompare(b.name, a.name));
    }

    return sorted;
}
```

## 8.4 为什么必须检查 `this.view`

`CollectionTreeRow` 可能不仅出现在用户当前主窗口 Collection Tree。

因此全局 prototype patch 后必须设 guard：

```text
只有本插件登记过的 main CollectionTree view 才生效
```

禁止把排序无意扩散到 Zotero 的其他 Tree。

## 8.5 规则不继承的实现保证

当前 row 是：

```text
01_Conference
```

就只读：

```text
RuleStore[01_Conference]
```

返回其直接 children 顺序。

当 Tree 继续展开：

```text
2026
```

会再次调用 `2026.getChildren()`。

此时只读：

```text
RuleStore[2026]
```

**绝对不能向上寻找 `01_Conference` 的规则。**

禁止：

```js
getAncestorSortMode()
inheritParentMode()
```

---

# 9. 方案 A 第二入口——`_addSortedRow()` patch

## 9.1 为什么必须 patch 第二入口

只 patch `getChildren()` 不够。

当一个 Collection 已经展开时：

- 新建 child；
- 重命名 child；
- child 移入该 parent；
- 同步新增 child；

Zotero 可能直接走增量插入：

```text
_addSortedRow()
```

而不是重新调用整棵树的 `getChildren()`。

如果不 patch：

```text
01_Conference [DESC]
├─ 2026
├─ 2025
└─ 2024
```

新建：

```text
2027
```

可能暂时插入错误位置，直到重新折叠/展开才正常。

这是不可接受的。

## 9.2 patch 范围

**优先 patch 每个主窗口中的 `collectionsView` 实例。**

不要首先修改整个 `CollectionTree.prototype`。

目标对象：

```js
win.ZoteroPane.collectionsView
```

保存：

```js
const originalAddSortedRow = view._addSortedRow;
```

然后给该 view 实例设置 wrapper。

这样影响范围最小。

## 9.3 wrapper 总体规则

```js
view._addSortedRow = async function (objectType, id) {
    if (objectType !== "collection") {
        return originalAddSortedRow.call(this, objectType, id);
    }

    const collection = await Zotero.Collections.getAsync(id);

    // 顶层 Collection 没有 parent，根 Library 不允许配置
    if (!collection || !collection.parentID) {
        return originalAddSortedRow.call(this, objectType, id);
    }

    const parent = Zotero.Collections.get(collection.parentID);
    const mode = RuleStore.getMode(parent);

    if (mode === "default") {
        return originalAddSortedRow.call(this, objectType, id);
    }

    return addCollectionRowWithMode(this, collection, mode);
};
```

## 9.4 为什么 `asc` 也建议走插件 comparator

当前 Zotero 默认就是 ASC，因此可以简单委托原函数。

但语义上：

```text
Zotero 默认
```

和：

```text
名称升序
```

不是一回事。

为了确保未来 Zotero 如果改变默认排序行为时，用户显式选择的 ASC 仍然表示 ASC：

> 推荐 `asc` 与 `desc` 都进入 `addCollectionRowWithMode()`。

只有 `default` 委托 Zotero 原函数。

---

# 10. `addCollectionRowWithMode()` 的实现方法

这是本项目最需要认真处理的一段。

## 10.1 原则

不要复制整个 `CollectionTree`。

只实现：

> `_addSortedRow()` 中 `objectType === "collection"` 的当前分支。

而且应尽可能逐行保留目标 Zotero 版本的逻辑，仅把：

```text
“找到 sibling 插入点时的比较器”
```

抽象出来。

## 10.2 结构

伪代码：

```js
async function addCollectionRowWithMode(view, collection, mode) {
    let beforeRow;
    const parentID = collection.parentID;

    if (!parentID) {
        throw new Error("Custom mode must not be applied to root collection");
    }

    // 1. parent 必须已经在 Tree 中
    if (view._rowMap["C" + parentID] === undefined) {
        return false;
    }

    const startParentRow = view._rowMap["C" + parentID];

    // 2. parent 未展开时无需插入
    if (!view.isContainerOpen(startParentRow)) {
        return false;
    }

    const level = view.getLevel(startParentRow) + 1;

    // 3. 空 container
    if (view.isContainerEmpty(startParentRow)) {
        beforeRow = startParentRow + 1;
    }
    else {
        // 4. 按 Zotero 原逻辑扫描 sibling block
        // 5. 跳过 deeper subcollections
        // 6. 找同级 sibling
        // 7. 使用 mode 对应 comparator 决定插入点
    }

    if (view._includedInTree(collection)) {
        view._addRow(
            new Zotero.CollectionTreeRow(
                view,
                "collection",
                collection,
                level
            ),
            beforeRow
        );
    }

    return beforeRow;
}
```

## 10.3 comparator 判断

扫描 existing sibling `treeRow` 与 new `collection`。

### ASC

```js
const cmp =
    Zotero.localeCompare(treeRow.ref.name, collection.name);

if (cmp > 0) {
    break;
}
```

### DESC

```js
const cmp =
    Zotero.localeCompare(treeRow.ref.name, collection.name);

if (cmp < 0) {
    break;
}
```

### 相等

```js
cmp === 0
```

继续扫描，使新项位于已有同名 sibling 之后。

不引入第三排序字段。

## 10.4 绝不能删除 Zotero 原分支中的这些检查

实现时要以目标版本源码为准，至少保留：

- parent 是否可见；
- parent 是否展开；
- target level；
- container 是否为空；
- 同层 sibling 边界；
- deeper subcollection 快进；
- Tree filter / `_includedInTree()`；
- `_addRow()`；
- 正确返回 `beforeRow`。

## 10.5 不处理 Search 排序

`_addSortedRow()` 还会处理：

```text
search
```

本插件对此：

> **完全委托原函数。**

不得改 Saved Search 顺序。

---

# 11. 禁止的 `_addSortedRow()` 实现方式

Codex 不得：

### 11.1 临时反转全局 `Zotero.localeCompare`

禁止：

```js
const old = Zotero.localeCompare;
Zotero.localeCompare = ...
await originalAddSortedRow(...);
Zotero.localeCompare = old;
```

原因：

- 是全局状态；
- `await` 期间可能有其他逻辑调用；
- 可能影响 Item / Search / 其他插件；
- 容易产生竞态。

### 11.2 修改 Collection 名称

禁止：

```text
001_2026
002_2025
```

### 11.3 调整数据库 position 字段

没有产品需求，也不应自造持久排序字段。

### 11.4 全树 reload

禁止用：

```js
await view.reload();
```

作为每次 Collection 变化后的主要方案。

### 11.5 全树 refresh

禁止用：

```js
await view.refresh();
```

代替 `_addSortedRow()` patch。

---

# 12. 用户修改规则后如何立即生效

用户在右键菜单中从：

```text
Zotero 默认
```

切换为：

```text
名称降序
```

如果该 Collection 当前已经展开，应立即看到顺序变化。

但不能 refresh 整棵 Tree。

## 12.1 采用“局部 container 重建”

流程：

```text
保存新规则
   ↓
找到该 Collection 当前 row
   ↓
如果 row 不可见 / 未展开
   → 不做额外 UI 操作
   → 下次展开自然按新规则
   ↓
如果 row 已展开
   → 只关闭该 container
   → 立即重新打开该 container
   → getChildren() patch 自动生成新顺序
```

这仍然属于方案 A。

**它不是方案 B。**

方案 B 指的是：

```text
Collection 改变
→ reload / refresh 整棵 Tree
```

我们这里只是在用户主动切换规则时，对一个 parent 的 subtree 做一次局部 rebuild。

## 12.2 推荐伪代码

```js
async function rebuildParentChildren(win, collectionID) {
    const view = win.ZoteroPane.collectionsView;
    const row = view.getRowIndexByID("C" + collectionID);

    if (row === false) {
        return;
    }

    if (!view.isContainerOpen(row)) {
        return;
    }

    const selectedRow = view.getRow(view.selection.focused);
    const selectedID = selectedRow?.id || null;

    view._closeContainer(row);

    const newRow = view.getRowIndexByID("C" + collectionID);

    if (newRow !== false && !view.isContainerOpen(newRow)) {
        await view.toggleOpenState(newRow);
    }

    // 尽量恢复原 selection
    if (selectedID) {
        await view.selectByID(selectedID);
    }
}
```

## 12.3 需要测试的 UI 状态

局部重建必须验证：

- parent 自身展开状态恢复；
- 已展开的 child/grandchild 状态尽量保留；
- selection 不乱跳；
- scroll 不出现明显跳动；
- Tree filter 有内容时不异常。

当前 Zotero `_containerState` 会持久记录展开状态，因此局部 close/open 是比全树 reload 更小的操作，但最终必须用实际目标版本测试。

---

# 13. 右键菜单实现

## 13.1 使用当前 Zotero `MenuManager`

不要直接向 `#zotero-collectionmenu` 任意插 DOM 节点作为首选方案。

当前 Zotero 有：

```js
Zotero.MenuManager.registerMenu()
```

且目标：

```text
main/library/collection
```

是官方当前源码支持的菜单 target。

Collection Context Menu 构建时会调用：

```js
Zotero.MenuManager.updateMenuPopup(
    menu,
    "main/library/collection",
    ...
)
```

因此优先使用 MenuManager。

## 13.2 顶级结构

只增加一个 submenu：

```text
子分类排序 >
    ○ Zotero 默认
    ○ 名称升序 A → Z
    ○ 名称降序 Z → A
```

不得增加：

- 分隔出来的第二组操作；
- 设置页入口；
- “高级设置”；
- “管理规则”；
- “同步设置”；
- “自动检测年份”。

## 13.3 可见条件

只有当：

```js
collectionTreeRows.length === 1
&& collectionTreeRows[0].isCollection()
```

时显示。

以下对象不显示：

- My Library 根；
- Group Library 根；
- Recently Read；
- Saved Search；
- Trash；
- Unfiled；
- Publications；
- Feeds 根；
- 多选状态。

## 13.4 空 Collection

即使当前 parent 没有 child：

> 仍允许设置规则。

未来新增 child 后自动生效。

## 13.5 只读组库

本插件只是显示排序，不写组库数据。

因此 V1 可以允许具体 Collection 在只读 Group Library 中设置本地显示规则。

不要依赖 collection editable 权限。

---

# 14. Radio 状态

目标 UI：

```text
子分类排序 >
    ● Zotero 默认
    ○ 名称升序 A → Z
    ○ 名称降序 Z → A
```

或：

```text
子分类排序 >
    ○ Zotero 默认
    ○ 名称升序 A → Z
    ● 名称降序 Z → A
```

## 14.1 MenuManager 当前限制

当前 MenuManager schema 提供：

- `menuitem`
- `submenu`
- `onShowing`
- `onCommand`
- `menuElem`

但没有直接暴露 `checked` / `radio` 字段。

因此可以在每个 child item 的 `onShowing` 中，对 MenuManager 创建的 XUL `menuitem` 设置：

```js
menuElem.setAttribute("type", "radio");
menuElem.setAttribute("name", "zotero-collection-sort-mode");
menuElem.setAttribute("autocheck", "false");
```

再根据当前 RuleStore：

```js
if (active) {
    menuElem.setAttribute("checked", "true");
}
else {
    menuElem.removeAttribute("checked");
}
```

必须在实际 Zotero 9 Windows 构建上验证 radio 外观和 command 行为。

## 14.2 不依赖自动 radio 变更保存状态

`autocheck` 建议关闭。

真实状态来源永远是：

```text
RuleStore
```

菜单只是显示 RuleStore 当前值。

---

# 15. Context Menu command

每个 command 的行为：

```text
用户点击
  ↓
从 context.collectionTreeRows 取得唯一 row
  ↓
确认 row.isCollection()
  ↓
const collection = row.ref
  ↓
RuleStore.setMode(collection, mode)
  ↓
局部 rebuildParentChildren()
```

伪代码：

```js
async function applyModeFromMenu(mode, event, context) {
    const rows = context.collectionTreeRows;

    if (!rows || rows.length !== 1 || !rows[0].isCollection()) {
        return;
    }

    const collection = rows[0].ref;
    RuleStore.setMode(collection, mode);

    const win =
        context.menuElem?.ownerDocument?.defaultView
        || event.target?.ownerDocument?.defaultView;

    if (win) {
        await rebuildParentChildren(win, collection.id);
    }
}
```

---

# 16. 生命周期

Zotero 7+ bootstrapped plugin 应实现：

```js
startup()
shutdown()
install()
uninstall()
onMainWindowLoad()
onMainWindowUnload()
```

## 16.1 `startup()`

职责：

1. 初始化插件 namespace；
2. 载入 RuleStore；
3. feature detection；
4. 安装全局 `getChildren()` wrapper；
5. 注册 Context Menu；
6. 对已经存在的 main windows 注册其 CollectionTree view patch。

## 16.2 `onMainWindowLoad({ window })`

职责：

1. 等待 / 验证：

```js
window.ZoteroPane.collectionsView
```

可用；

2. 把该 view 加入 managed views；
3. patch 该 view 的 `_addSortedRow()`；
4. 保存原函数引用；
5. 不重复 patch 同一 view。

如果窗口加载时 `collectionsView` 尚未建立：

- 允许使用有超时的短期等待；
- 必须支持取消；
- 窗口 unload 后不能留下 timer。

## 16.3 `onMainWindowUnload({ window })`

职责：

1. 将该 view 从 managed views 移除；
2. 恢复该 view 的 `_addSortedRow()`；
3. 清理 window context；
4. 清理 timer / references；
5. 不删除 RuleStore。

## 16.4 `shutdown()`

职责：

1. 标记 plugin inactive；
2. unregister menu；
3. 对所有当前窗口卸载实例 patch；
4. 恢复 `CollectionTreeRow.prototype.getChildren()`；
5. 清理引用；
6. **保留用户排序规则 pref**，这样插件 disable → enable 后规则仍在。

## 16.5 `uninstall()`

建议：

- 真正卸载时删除本插件 pref：
  `extensions.zotero.collectionSort.rules`
- disable / upgrade 不删除。

如果实现者希望 reinstall 后保留，可把清理行为单独注释说明，但不能影响核心功能。

---

# 17. Monkey patch 安全设计

## 17.1 保存原函数

必须保存：

```js
originalGetChildren
```

以及每个 view 的：

```js
originalAddSortedRow
```

## 17.2 防止重复 patch

每个 wrapper 应有标记，例如：

```js
patchedGetChildren.__zoteroCollectionSort = true;
```

view context：

```js
windowContexts.set(win, {
    view,
    originalAddSortedRow,
    patchedAddSortedRow
});
```

## 17.3 多插件兼容

如果另一插件在我们之后又 wrapper 同一方法：

shutdown 时不要粗暴：

```js
prototype.getChildren = originalGetChildren;
```

覆盖别人后安装的 wrapper。

推荐：

```js
if (prototype.getChildren === patchedGetChildren) {
    prototype.getChildren = originalGetChildren;
}
else {
    // 不覆盖未知的新 wrapper
    // 将本插件 active=false，使自身 wrapper 即使仍在 chain 中也完全透传
}
```

同理 `_addSortedRow()`。

## 17.4 inactive 透传

wrapper 顶部：

```js
if (!PluginState.active) {
    return originalFunction.apply(this, args);
}
```

这样 shutdown 后即使因第三方 patch chain 无法物理移除，本插件逻辑也不会继续生效。

---

# 18. Feature Detection

安装 patch 前检查：

```js
typeof Zotero.CollectionTreeRow?.prototype?.getChildren === "function"
```

窗口加载时检查：

```js
const view = win.ZoteroPane?.collectionsView;

view
&& typeof view._addSortedRow === "function"
&& typeof view._addRow === "function"
&& typeof view.getRowIndexByID === "function"
&& typeof view.isContainerOpen === "function"
&& typeof view.getLevel === "function"
&& typeof view._includedInTree === "function"
```

如果关键结构缺失：

> **Fail closed。**

行为：

- 不安装危险 patch；
- 不修改 Zotero 数据；
- 记录清晰 debug/error；
- 隐藏或禁用菜单；
- 报告该 Zotero 版本暂未兼容。

**不得自动切换到方案 B。**

---

# 19. 错误处理策略

## 19.1 Pref JSON 损坏

如果 JSON.parse 失败：

- log warning；
- 内存使用空规则；
- 不让 Zotero 启动失败；
- 下次用户设置规则时写入新的合法 JSON。

## 19.2 自定义增量插入失败

如果 `addCollectionRowWithMode()` 抛异常：

1. `Zotero.logError(error)`；
2. 不修改 Collection；
3. 可以调用保存的原 `_addSortedRow()` 作为安全退路，使 Tree 至少保持 Zotero 默认排序。

这不属于方案 B：

```text
失败 → Zotero 原默认插入
```

而不是：

```text
失败 → 全树 refresh
```

## 19.3 Menu context 异常

找不到唯一 concrete Collection：

> 直接 return。

不要猜测目标 Collection。

---

# 20. 为什么根 Library 不配置

产品边界明确：

```text
My Library
├─ 00_Inbox
├─ 01_Conference
├─ 02_Journal
└─ 03_Preprint
```

这一层不提供插件规则。

原因：

- 用户希望一级目录继续 `00 → 01 → 02 → 03`；
- Zotero 默认名称升序已经满足；
- 插件核心价值是“不同父 Collection 有不同 child 排序”。

技术上：

```js
if (!row.isCollection()) {
    hide menu;
}
```

自然排除 Library root。

---

# 21. 典型目标行为

## 21.1 用户希望年份降序

用户自己创建：

```text
01_Conference
├─ 2024
├─ 2025
└─ 2026
```

右键：

```text
01_Conference
→ 子分类排序
→ 名称降序 Z → A
```

显示：

```text
01_Conference
├─ 2026
├─ 2025
└─ 2024
```

插件**不知道这些是年份**。

它只是：

```text
"2026" > "2025" > "2024"
```

做名称降序。

## 21.2 年份下面会议仍升序

因为 `2026` 没有规则：

```text
2026
├─ AAAI
├─ ACL
├─ CVPR
├─ ICASSP
├─ ICLR
└─ Interspeech
```

不会继承 `01_Conference` 的 DESC。

## 21.3 另一个 parent 独立 ASC

```text
02_Journal [ASC]
├─ JASA
├─ Speech Communication
└─ TASLP
```

不会影响 `01_Conference`。

---

# 22. Tree Filter / 搜索框

Collection Tree 有自己的 filter/search 行为。

插件必须测试：

1. Tree filter 为空；
2. Tree filter 正在过滤 Collection；
3. 过滤时重命名 Collection；
4. 过滤时新增 / 删除 Collection；
5. 清空 filter 后顺序恢复正确。

原则：

- `getChildren()` 排序在 `_includedInTree()` 过滤之前发生没有问题；
- `_addSortedRow()` 自定义 branch 必须继续调用 `_includedInTree()`；
- 不改变 `_matchesFilter()`；
- 不改 filter cache。

---

# 23. 新增、重命名、移动的行为

## 23.1 新增 child

Parent：

```text
01_Conference [DESC]
```

当前：

```text
2026
2025
2024
```

新增：

```text
2027
```

必须立即显示：

```text
2027
2026
2025
2024
```

无需折叠重开。

## 23.2 重命名 child

当前 DESC：

```text
C
B
A
```

把：

```text
A → D
```

必须立即：

```text
D
C
B
```

## 23.3 移动 child

假设：

```text
Parent-A [DESC]
Parent-B [ASC]
```

将一个 Collection 从 A 拖到 B：

- 从 A 移除；
- 在 B 按 **B 自己的规则**插入；
- 绝不继承 A 的规则。

---

# 24. 同步事件

规则本身不同步。

但是 Zotero Sync 可能在本机同步进：

- 新 Collection；
- Collection 改名；
- Collection 移动。

只要 Zotero 的 Tree 通知仍走 `_addSortedRow()`：

> 本地自定义排序应正常应用。

插件不得主动参与 Sync。

---

# 25. 性能要求

该插件不应造成可感知性能负担。

## 25.1 `getChildren()`

只排序直接 siblings：

```text
O(n log n)
```

且只在展开/重建该 parent 时发生。

## 25.2 `_addSortedRow()`

增量扫描：

```text
O(n)
```

与 Zotero 当前逻辑同量级。

## 25.3 禁止

- 每次 render 读取 Pref；
- 每次 compare `JSON.parse()`；
- 全库遍历；
- 全树 reload；
- 定时轮询排序；
- MutationObserver 监视整个 Tree。

---

# 26. 推荐日志

开发版使用统一前缀：

```text
[CollectionSort]
```

例如：

```js
Zotero.debug("[CollectionSort] Installed getChildren patch");
Zotero.debug("[CollectionSort] Parent 1:ABCDEFGH -> desc");
Zotero.debug("[CollectionSort] Restored _addSortedRow");
```

异常：

```js
Zotero.logError(error);
```

发布版不要大量输出 comparator 日志。

---

# 27. Manifest

采用 Zotero 7+ bootstrapped plugin：

```text
manifest.json
bootstrap.js
```

`manifest.json` 至少包含：

```json
{
  "manifest_version": 2,
  "name": "Collection Sort",
  "version": "0.1.0",
  "description": "Per-collection sorting for direct child collections in Zotero.",
  "applications": {
    "zotero": {
      "id": "zotero-collection-sort@local",
      "strict_min_version": "9.0",
      "strict_max_version": "<填写实际测试通过的 Zotero minor branch>"
    }
  }
}
```

**不要盲目填写无限版本兼容。**

Zotero 官方建议 `strict_max_version` 对应实际测试过的最新 minor 系列。

---

# 28. prefs.js

可以提供默认 pref：

```js
pref("extensions.zotero.collectionSort.rules", "{}");
```

不需要 Preferences UI。

---

# 29. Context Menu 注册示意

当前 Zotero MenuManager 支持：

```text
target = main/library/collection
```

概念结构：

```js
const menuID = Zotero.MenuManager.registerMenu({
    menuID: "zotero-collection-sort-context-menu",
    pluginID: PLUGIN_ID,
    target: "main/library/collection",
    menus: [
        {
            menuType: "submenu",
            onShowing(event, context) {
                // set label
                // only visible for exactly one concrete Collection
            },
            menus: [
                {
                    menuType: "menuitem",
                    onShowing(event, context) {
                        // label = Zotero 默认
                        // radio state
                    },
                    onCommand(event, context) {
                        // apply default
                    }
                },
                {
                    menuType: "menuitem",
                    onShowing(event, context) {
                        // label = 名称升序 A → Z
                    },
                    onCommand(event, context) {
                        // apply asc
                    }
                },
                {
                    menuType: "menuitem",
                    onShowing(event, context) {
                        // label = 名称降序 Z → A
                    },
                    onCommand(event, context) {
                        // apply desc
                    }
                }
            ]
        }
    ]
});
```

实现时以目标 Zotero 版本 `menuManager.js` 的实际 schema 为准。

---

# 30. 不需要独立 Notifier

CollectionTree 本身已经注册 Zotero Notifier，并在 add/modify 等事件中调用自身 Tree 更新逻辑。

因此方案 A 优先：

> patch Tree 的既有更新入口

而不是再写第二套：

```text
Zotero.Notifier observer
→ refresh/reload
```

除非源码核对发现目标版本路径已经改变，否则不要额外注册 Collection notifier 来重复处理同一事件。

---

# 31. 代码层面的推荐状态结构

```js
const PluginState = {
    active: false,
    pluginID: null,
    rootURI: null,

    // 主窗口 / view 管理
    windows: new Map(),
    managedViews: new Set(),

    // global prototype patch
    originalGetChildren: null,
    patchedGetChildren: null,

    menuID: null
};
```

每个 window：

```js
{
    win,
    view,
    originalAddSortedRow,
    patchedAddSortedRow,
    pendingTimer: null
}
```

---

# 32. 启动顺序

必须按以下顺序：

```text
startup
  ↓
PluginState.active = true
  ↓
RuleStore.load()
  ↓
feature-detect global APIs
  ↓
install getChildren wrapper
  ↓
register MenuManager menu
  ↓
for every existing main window
    patchWindow(window)
```

未来打开新窗口：

```text
onMainWindowLoad
  ↓
patchWindow(window)
```

---

# 33. 关闭顺序

```text
shutdown
  ↓
PluginState.active = false
  ↓
unregister MenuManager
  ↓
for each window
    unpatchWindow(window)
  ↓
managedViews.clear()
  ↓
restore getChildren if safe
  ↓
clear references
```

这里 `active = false` 应尽早设置，保证任何未立即移除的 wrapper 先变为透传模式。

---

# 34. 开发过程必须直接走方案 A

开发步骤可以分阶段，但技术路线从第一天开始就是 A：

### Phase 1：Scaffold

- manifest
- bootstrap
- prefs
- startup/shutdown 可用

### Phase 2：RuleStore

- local JSON rules
- validation
- persistence

### Phase 3：Context Menu

- 唯一 submenu
- 三个 radio 选项
- context 识别

### Phase 4：`getChildren()` patch

- direct children sorting
- no inheritance
- root untouched

### Phase 5：`_addSortedRow()` patch

- add
- rename
- move
- sync-driven insertion

### Phase 6：局部 container rebuild

- 点击规则后立即生效
- 不全树 refresh

### Phase 7：完整 teardown

- disable
- re-enable
- window unload
- uninstall

### Phase 8：测试与打包

**不得存在：**

```text
Phase X：先用方案 B 顶着
```

---

# 35. 单元测试建议

SortEngine 应可脱离 Zotero UI 测试。

## 35.1 ASC

输入：

```text
C
A
B
```

输出：

```text
A
B
C
```

## 35.2 DESC

输入：

```text
C
A
B
```

输出：

```text
C
B
A
```

## 35.3 Unicode

使用：

```text
AAAI
ICASSP
Interspeech
中文分类
```

实际期望由 `Zotero.localeCompare` 决定，不自定义 locale 规则。

## 35.4 duplicate names

```text
A(id1)
A(id2)
B
```

A1/A2 相对顺序不得无原因翻转。

---

# 36. 集成测试矩阵

以下全部通过才算 V1 完成。

| 编号 | 场景 | 必须结果 |
|---|---|---|
| T01 | 插件未设置任何规则 | 与 Zotero 默认完全一致 |
| T02 | root Library | 无“子分类排序”设置 |
| T03 | concrete Collection 右键 | 显示唯一排序 submenu |
| T04 | 设置 ASC | 直接 children A→Z |
| T05 | 设置 DESC | 直接 children Z→A |
| T06 | 设置 Default | 删除规则，恢复 Zotero 默认 |
| T07 | parent DESC，grandchild Default | grandchild 不继承 DESC |
| T08 | parent ASC，child DESC | 两层规则互不影响 |
| T09 | parent 当前折叠时切规则 | 下次展开正确 |
| T10 | parent 当前展开时切规则 | 立即局部重排 |
| T11 | DESC parent 新建 child | 新 child 立即在正确位置 |
| T12 | ASC parent 新建 child | 新 child 立即在正确位置 |
| T13 | child 重命名 | 立即重新定位 |
| T14 | child 从 ASC parent 移到 DESC parent | 使用新 parent 的 DESC |
| T15 | child 删除 | Tree 正常 |
| T16 | parent 改名 | 规则仍存在 |
| T17 | Zotero 重启 | 本机规则仍存在 |
| T18 | 插件 disable | Tree 恢复 Zotero 默认，无数据变化 |
| T19 | 插件 re-enable | 本地规则重新生效 |
| T20 | 插件卸载 | 无残留 UI / active patch |
| T21 | Collection Tree filter | 无崩溃、顺序正确 |
| T22 | Saved Search / Recently Read | 不受影响 |
| T23 | Group Library concrete Collection | 仅本地显示排序可用 |
| T24 | 多选 Collection | 菜单隐藏或禁用 |
| T25 | 500+ Collections 压力测试 | 无明显卡顿 |
| T26 | 同名 siblings | 无异常抖动 |
| T27 | Zotero Sync 新增 child | 本机按 parent 规则插入 |
| T28 | 窗口关闭 / 再开 | patch 正确卸载和重装 |

---

# 37. 最关键的人工验收示例

构建以下目录：

```text
My Library
├─ 00_Inbox
├─ 01_Conference
├─ 02_Journal
└─ 03_Preprint
```

`01_Conference`：

```text
01_Conference
├─ 2024
├─ 2025
└─ 2026
```

给 `01_Conference` 设置：

```text
名称降序 Z → A
```

期望：

```text
My Library
├─ 00_Inbox
├─ 01_Conference
│  ├─ 2026
│  ├─ 2025
│  └─ 2024
├─ 02_Journal
└─ 03_Preprint
```

再在 `2026` 下：

```text
2026
├─ Interspeech
├─ ICML
├─ ICLR
├─ ICASSP
├─ CVPR
├─ ACL
└─ AAAI
```

`2026` 保持 `Zotero 默认` 或显式设为 ASC。

期望：

```text
2026
├─ AAAI
├─ ACL
├─ CVPR
├─ ICASSP
├─ ICLR
├─ ICML
└─ Interspeech
```

这就是本插件最主要的验收场景。

---

# 38. 兼容性原则

Collection Tree 的：

```text
getChildren()
_addSortedRow()
_closeContainer()
```

属于 Zotero 内部实现，不是长期稳定的公开排序 API。

这并不意味着插件不能使用。

Zotero 7+ bootstrapped plugin 仍可访问应用内部对象，但插件必须承担版本兼容责任。

因此：

1. feature detection；
2. 尽量少 patch；
3. patch 范围最小；
4. fail closed；
5. 保存原方法；
6. 大版本升级后重新测试；
7. `strict_max_version` 不无限放宽。

---

# 39. Codex 必须避免的“过度工程化”

请不要自行加入：

- TypeScript migration；
- Redux / state framework；
- React UI；
- schema migration system；
- 云端配置；
- import/export rules；
- auto update server；
- telemetry；
- analytics；
- crash reporting service；
- 自定义 parser；
- 自定义 collation engine；
- 自定义数据库；
- 配置文件浏览器；
- “Pro mode”。

这是一个非常小的 Zotero 插件。

V1 的核心价值就是：

> **每个父 Collection 独立设置 direct children 的 Default / ASC / DESC。**

---

# 40. Definition of Done

只有同时满足以下条件，才可宣布完成：

### 功能

- [ ] 右键 concrete Collection 可见“子分类排序”。
- [ ] 仅三个选项。
- [ ] Default 正常。
- [ ] ASC 正常。
- [ ] DESC 正常。
- [ ] 直接 children only。
- [ ] 不继承。
- [ ] root 不受影响。
- [ ] 新建后立即正确。
- [ ] 重命名后立即正确。
- [ ] 移动后立即正确。
- [ ] 重启后本地规则保留。

### 安全

- [ ] 不重命名 Collection。
- [ ] 不修改 Collection metadata。
- [ ] 不触碰文献数据。
- [ ] 不产生 Zotero Sync 配置记录。
- [ ] 禁用插件立即回到 Zotero 默认。
- [ ] 无全树 refresh workaround。
- [ ] 所有 monkey patch 可撤销或 inactive 透传。

### UI

- [ ] 无 sidebar 图标。
- [ ] 无 toolbar button。
- [ ] 无 Preferences page。
- [ ] 无额外对话框。
- [ ] 三项 radio 状态正确。
- [ ] 多选 / 非 Collection 不出现菜单。

### 质量

- [ ] 所有核心测试通过。
- [ ] 没有明显 Tree 闪烁。
- [ ] 没有明显滚动位置异常。
- [ ] 没有 selection 异常。
- [ ] 没有 console error。
- [ ] XPI 可正常安装 / disable / enable / uninstall。

---

# 41. Codex 开始开发前的检查清单

在写正式实现前，先输出一份简短的源码核对报告，确认：

```text
[ ] 目标 Zotero 精确版本
[ ] getChildren() 实际代码路径
[ ] _addSortedRow() 实际代码路径
[ ] Collection add/modify 是否仍调用 _addSortedRow()
[ ] ZoteroPane.collectionsView 是否仍是当前 CollectionTree 实例
[ ] MenuManager 是否支持 main/library/collection
[ ] collectionTreeRows context 是否可取得
[ ] _closeContainer / toggleOpenState 是否可用于局部 rebuild
```

如果全部满足，再编码。

如果某项不满足：

> 先调整 **方案 A 内部实现**。

不要改产品边界，不要切方案 B。

---

# 42. 推荐实现顺序与提交点

建议 Git commits：

```text
01 scaffold: bootstrap plugin lifecycle
02 feat: local RuleStore
03 feat: collection context menu
04 feat: patch CollectionTreeRow.getChildren
05 feat: patch CollectionTree incremental insertion
06 feat: local parent subtree rebuild
07 fix: teardown and multi-window safety
08 test: integration regression matrix
09 build: package XPI
```

每个 commit 应可单独理解。

---

# 43. 交付物

Codex 最终应提供：

```text
1. 完整插件源码
2. 可安装 .xpi
3. README.md
4. DEVELOPMENT.md / 技术说明
5. 测试清单及实际测试结果
6. 已测试 Zotero 精确版本
7. 已知兼容性限制
```

README 中不要把插件宣传成“智能年份排序”。

准确描述应是：

> Per-parent name sorting for direct child collections in Zotero.

---

# 44. 官方源码 / 文档核对入口

实现时优先核对 Zotero 官方来源。

## 插件开发

- Zotero 7+ plugin development:
  https://www.zotero.org/support/dev/zotero_7_for_developers

## Collection Tree Row

- 当前源码路径：
  `chrome/content/zotero/xpcom/collectionTreeRow.js`
- GitHub：
  https://github.com/zotero/zotero/blob/master/chrome/content/zotero/xpcom/collectionTreeRow.js

## Collection Tree

- 当前源码路径：
  `chrome/content/zotero/collectionTree.jsx`
- GitHub：
  https://github.com/zotero/zotero/blob/master/chrome/content/zotero/collectionTree.jsx

## Collections data layer

- 当前源码路径：
  `chrome/content/zotero/xpcom/data/collections.js`
- GitHub：
  https://github.com/zotero/zotero/blob/master/chrome/content/zotero/xpcom/data/collections.js

## MenuManager

- 当前源码路径：
  `chrome/content/zotero/xpcom/pluginAPI/menuManager.js`
- GitHub：
  https://github.com/zotero/zotero/blob/master/chrome/content/zotero/xpcom/pluginAPI/menuManager.js

## Zotero Pane Context Menu

- 当前源码路径：
  `chrome/content/zotero/zoteroPane.js`
- GitHub：
  https://github.com/zotero/zotero/blob/master/chrome/content/zotero/zoteroPane.js

> **重要**：上述 `master` 仅用于理解最新实现。正式编码必须优先核对用户实际安装版本对应的源码。

---

# 45. 最终架构摘要

整个插件应该保持为：

```text
                 ┌─────────────────────┐
                 │   Local RuleStore   │
                 │ default/asc/desc    │
                 └─────────┬───────────┘
                           │
             ┌─────────────┴─────────────┐
             │                           │
             ▼                           ▼
┌────────────────────────┐   ┌────────────────────────┐
│ getChildren() wrapper  │   │ _addSortedRow wrapper │
│ initial/expand sorting │   │ incremental insertion  │
└────────────┬───────────┘   └────────────┬───────────┘
             │                           │
             └─────────────┬─────────────┘
                           ▼
                 ┌─────────────────────┐
                 │ Collection Tree UI  │
                 │   display only      │
                 └─────────────────────┘

Context Menu
     │
     ├─ Zotero 默认
     ├─ A → Z
     └─ Z → A
     │
     ▼
 Local RuleStore
     │
     ▼
局部 parent subtree 重建
```

最终原则只有一句：

> **插件不理解“年份”“会议”“期刊”等语义；它只允许每个父 Collection 在本机独立决定其直接子 Collection 使用 Zotero 默认、名称升序或名称降序，并通过方案 A 的 Tree 双入口 patch 保证初始显示与增量更新一致。**
