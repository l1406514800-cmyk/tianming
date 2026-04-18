# 天命 · 项目架构文档

> 本文档说明三个核心文件的分工、全局数据对象、以及修改规范。
> **AI 助手和开发者在修改任何文件前必须先阅读本文档。**

---

## 文件职责总览

| 文件 | 职责 | 全局数据对象 | 说明 |
|------|------|-------------|------|
| `editor.js` | **独立剧本编辑工具（逻辑）** | `scriptData` | 独立页面，用于创建/编辑剧本文件 |
| `editor.html` | **独立剧本编辑工具（UI）** | `scriptData`（引用 editor.js） | 独立页面，仅 HTML/CSS 结构 |
| `index.html` | **游戏运行时 + 游戏内编辑器** | `P` | 单页应用，包含游戏循环和内置编辑器 |

---

## 两套编辑器系统

本项目存在**两套完全独立的编辑器系统**，职责不同，互不干扰：

### 系统 A：独立剧本编辑工具（editor.html + editor.js）

- **入口**：单独打开 `editor.html` 页面
- **用途**：从零创建、编辑剧本文件，并导出为 JSON
- **全局对象**：`scriptData`
- **数据结构**：
  ```
  scriptData.name / .dynasty / .emperor / .overview
  scriptData.characters[]
  scriptData.factions[]
  scriptData.classes[]
  scriptData.items[]
  scriptData.military: { troops[], facilities[], organization[], campaigns[] }
  scriptData.techTree: { military[], civil[] }
  scriptData.civicTree: { city[], policy[], resource[], corruption[] }
  scriptData.variables[]
  scriptData.rules / .events / .timeline / .map
  scriptData.worldSettings / .government
  ```
- **要修改独立剧本编辑工具 → 改 editor.js（逻辑）和/或 editor.html（布局/样式）**

### 系统 B：游戏内编辑器（index.html 的一部分）

- **入口**：游戏中调用 `enterEditor(sid)`
- **用途**：在游戏运行时内直接编辑当前存档的剧本数据
- **全局对象**：`P`（与游戏运行共用同一对象）
- **关键函数**（均在 index.html 中，属于游戏内编辑器，完全合法）：
  - `enterEditor(sid)` — 进入编辑器界面
  - `renderEdTab(tabId)` — 渲染各标签页
  - `editChr(i)` / `addChr()` — 角色编辑
  - `aiGenChr()` / `aiGenFac()` / `aiGenVar()` 等 — AI 生成
  - `openGenericModal(title, bodyHTML, onSave)` — 通用模态框
  - `gv(id)` — 辅助函数
- **要修改游戏内编辑器 → 改 index.html**

---

## 全局数据对象

### `P`（index.html — 游戏运行时 + 游戏内编辑器）

```
P.scenarios[]     — 剧本列表
P.characters[]    — 角色列表（含 sid 关联剧本）
P.factions[]      — 派系列表
P.variables[]     — 全局变量
P.relations[]     — 人物关系
P.events[]        — 事件列表
P.chapters[]      — 章节列表
P.techTree[]      — 科技树
P.civicTree[]     — 市政树
P.items[]         — 物品列表
P.military        — 军事数据
P.conf            — 全局配置（style、refText、AI key 等）
```

### `scriptData`（editor.js — 独立剧本编辑工具）

- 结构见上方「系统 A」部分
- 与 `P` 完全独立，不交叉使用
- 编辑器保存时将 `scriptData` 序列化导出为 JSON

---

## 修改决策树

```
要修改什么？
│
├── 独立剧本编辑工具（editor.html 页面的功能/UI/逻辑）
│   ├── 逻辑/功能 → 修改 editor.js
│   └── HTML 布局/CSS 样式 → 修改 editor.html
│
├── 游戏内编辑器（enterEditor、renderEdTab、editChr、aiGenChr 等）
│   └── → 修改 index.html
│
├── 游戏运行时（回合推进、战斗、事件触发、存读档、游戏循环）
│   └── → 修改 index.html
│
└── 两者都需要改（如新增一种数据类型）
    ├── 独立编辑工具部分 → editor.js
    └── 游戏内编辑器部分 → index.html
```

---

## ⚠️ 常见错误（已知陷阱）

1. **把「编辑器功能」一律归给 editor.js** — 错误！游戏内编辑器的所有函数（enterEditor、renderEdTab、aiGenChr 等）合法地属于 index.html，不要移到 editor.js
2. **混淆 `P` 和 `scriptData`** — 两者是完全独立的对象，不要交叉使用
3. **在 editor.html 的 `<script>` 块中写业务逻辑** — 应在 editor.js 中
4. **把 index.html 的编辑器代码视为「历史遗留错误」** — 这是错误的认知，它们是游戏内编辑器的正式功能

---

## AI 助手注意事项

- **看到「剧本编辑工具」相关需求（独立页面 editor.html）** → 改 editor.js / editor.html
- **看到「游戏内编辑器」相关需求（游戏中进入的编辑界面）** → 改 index.html
- **看到「游戏运行」相关需求** → 改 index.html
- 不确定时 → 读本文档和各文件顶部的注释块
- **两套编辑器系统都是合法的，各司其职，不要混淆**

---

## 相关外部文件

| 文件 | 用途 |
|------|------|
| `C:\Users\37814\aiGen_override.js` | 参考：AI 生成辅助函数 (_aiStylePrefix 等) |
| `C:\Users\37814\aiGen_override2.js` | 参考：AI 生成函数覆盖 (aiGenChr 等) |
| `C:\Users\37814\.claude\plans\staged-shimmying-hamming.md` | 六阶段统一计划（改进 index.html 的游戏内编辑器） |
