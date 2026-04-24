# scripts/ · 零依赖测试基础设施 (R121)

此目录下的工具**严格遵守项目 `_no_dependencies` 原则**——仅使用 Node.js 内置模块 (`fs`, `path`, `vm`, `child_process`)，不引入任何 npm 包。

## 工具清单

### `syntax-check.js`

对仓库根目录下所有 `*.js` 跑 `node --check`，作为最低门槛的预提交检查。

```bash
node scripts/syntax-check.js
```

完整扫描 ~150 个 .js 文件，耗时约 15s。任一文件语法错误即退出码 1。

**建议用法**：每次 commit 前本地跑一次；大重构前后各跑一次。

---

### `headless-smoke.js`

Node `vm` 模块 + 极简 DOM/window/localStorage/indexedDB stub，按 `index.html` 顺序加载所有 tm-*.js，再跑 `TM.test` 套件。**作为 R110/R111/R112 巨文件拆分的回归护航。**

```bash
node scripts/headless-smoke.js              # 跑全套
node scripts/headless-smoke.js --only E2E   # 只跑名字含 "E2E" 的 suite
node scripts/headless-smoke.js --list       # 列出 suite 名
node scripts/headless-smoke.js --diag       # 打印 TM.* 关键字段
node scripts/headless-smoke.js --verbose    # 输出脚本加载的详细错误栈
```

**能检测**：
- 语法错误（顺带 `syntax-check` 的活儿）
- 加载顺序 bug（如 R114 修的 `var TM = {...}` 覆盖）
- 未定义符号引用（如 R121 修的 `_keyiStartDiscuss` 僵尸）
- 命名空间/门面缺失（`TM.Storage` / `TM.MapSystem.open` 等契约）
- 子系统 API 存在性（ValidatorSchema/DAL/SaveManager 等）

**不能检测**：
- DOM 渲染正确性（需要真浏览器）
- AI 实际返回值合理性（网络依赖）
- 用户交互流程（点击/键盘）
- CSS 布局/视觉问题

这部分仍需在浏览器打开 `index.html?test=1` 人工核验，或未来接 Puppeteer（若允许破例）。

**当前结果**（R121 基线）：208 pass / 3 fail / 0 skip
- 3 个失败都是 headless 环境限制（`document.querySelectorAll` 不完整、`confirm()` 不存在、`uid` 毫秒同刻碰撞），非真 bug。

---

### `smoke-debug.js`

临时调试脚本，用于定位单一文件的初始化副作用。留存作为诊断模板。

---

## 建议工作流

**重构前**：
```bash
node scripts/syntax-check.js && node scripts/headless-smoke.js
# 记录当前 pass/fail 基线
```

**重构后（每个 commit）**：
```bash
node scripts/syntax-check.js         # 必须 0 error
node scripts/headless-smoke.js       # pass 数不能下降
```

如 pass 数下降或出现新 fail，说明拆分引入回归。回滚或修正。

---

## R110/R111/R112 大拆分前置条件

这三个 task（拆 `_endTurn_aiInfer` / `tm-game-engine.js` / `tm-chaoyi-keju.js`）的安全前提：

1. ✅ `syntax-check.js` 通过（R121 已达成）
2. ✅ `headless-smoke.js` 有基线（R121 已达成·208 pass）
3. ⚠ 浏览器侧手工验证矩阵（完全新游戏 → 推进 5 回合 → 存档读档 → 切剧本）— **尚未自动化**
4. ⚠ 每个拆分子模块的行为快照（pre/post JSON diff）— **尚未建立**

第 1-2 条构成"能发现回归"的最低保证。第 3-4 条构成"能发现语义回归"的升级保证，建议在真拆前补齐。
