/* ============================================================
 * tm-settings-ui.js — 设置界面 UI（占位）
 *
 * ⚠ 本文件当前是占位，实际实现仍在 tm-patches.js:1-512
 *
 * 为什么占位而不真迁移？
 *   原代码 512 行含 openSettings 完整重写 + 19 个 sXxx/_sXxx 辅助函数
 *   涉及：主 API / 次要 API / 生图 API 三套配置 + 模型检测 + 连接测试 +
 *        字数档位预览 + 上下文探测 + 输出上限检测
 *   风险：
 *     · openSettings 覆盖 game-engine 原版，innerHTML 内含 400+ 行字符串
 *     · sSaveAPI 涉及 localStorage + Electron autoSave 双路径
 *     · sDetectModels 发起真 AI API 请求
 *   没有测试环境无法验证迁移后等价性。
 *
 * 建议迁移路径（给未来维护者）：
 *   1. 先在 TM.test 补 smoke test：
 *      - openSettings 能开（不抛）
 *      - sSaveAPI 正确写 P.ai + localStorage
 *      - sToggleSecondaryEnabled 正确修改 P.conf.secondaryEnabled
 *      - _sVerbUpdatePreview 不抛 + 恢复 origV
 *   2. 按函数依赖顺序逐个迁移：
 *      ┌─ 最独立（先迁）：
 *      │    _sUpdateMaxoutInfo / _sMaxoutToggle
 *      │    _sShowCtxInfo / sReDetectCtx
 *      │    _sVerbUpdatePreview
 *      │    DEFAULT_PROMPT / DEFAULT_RULES 常量
 *      ├─ 中等依赖（_sXxx helper 迁完后）：
 *      │    sSaveAPI / sSaveAll / sTestConn / sDetectModels
 *      │    sPickModel / sSaveSecondaryAPI / sPickSecModel
 *      │    sTestSecondaryConn / sDetectSecondaryModels
 *      │    sClearSecondaryAPI / sToggleSecondaryEnabled
 *      │    _sTestImgConn / _sDetectImgCap / _sSaveImgAPI
 *      └─ 最后迁（依赖所有 helper）：
 *           openSettings (~200 行 innerHTML)
 *   3. 每迁完一批就在 tm-patches.js 顶部的 redirect 注释扩展"已迁移 XXX"
 *   4. 全部迁完后，index.html 加载顺序：tm-patches.js → tm-settings-ui.js
 *   5. 等双保险稳定 1 周后，删除 tm-patches.js 对应原代码
 *
 * 预估工时：15-25 小时（含完整回归测试）
 * 先决条件：
 *   · 至少 8 个 smoke test（API 保存/连接测试/模型检测 路径）
 *   · 手工验证：打开设置 → 修改每项 → 保存 → 关闭 → 重开，设置应保持
 *
 * 详细切分方案：见 PATCH_CLASSIFICATION.md · tm-patches.js 段
 * ============================================================ */

// 本文件暂为占位，主逻辑在 tm-patches.js。
// 如果你看到这个注释并想做真迁移，按上述步骤执行。
// 切勿在测试环境之外直接动这段代码。

(function(){
  'use strict';
  if (typeof window === 'undefined') return;
  // 记录到 DA.meta 以便统计
  window.TM = window.TM || {};
  window.TM._migrationPlaceholders = window.TM._migrationPlaceholders || [];
  window.TM._migrationPlaceholders.push({
    file: 'tm-settings-ui.js',
    source: 'tm-patches.js:1-512',
    status: 'placeholder',
    estimatedHours: 20,
    createdBy: 'R22',
    date: '2026-04-24'
  });
})();
