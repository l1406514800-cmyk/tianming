// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// tm-endturn-record.js — endturn AI 推演·收尾 return assembly (R210 P7-η 拆出)
//
// Phase 7 P7-η (2026-05-05·Claude)·从 tm-endturn-ai-infer.js 收尾 return 段拆出·
// 责任·读 ctx.record / ctx.input·assemble 主入口 return 对象 (12 字段)
// 不动·sanitize 仍在 ai-infer (主入口职责·非 record)·AI 失败兜底亦留 ai-infer
//
// Module:    TM.Endturn.AI.record
// Domain:    endturn / final return assembly
// Status:    active (P7-η refactor·替原 ai-infer 末段 inline return)
// Owner:     Claude (P7-η)
// Imports:   ctx (含 record / input 子组)·只读·非 GM/P 直接依赖
// Exports:   TM.Endturn.AI.record.finalize(ctx)·sync·return 12-field 对象
// Used by:   tm-endturn-ai-infer.js (主入口·末尾调 finalize 替 inline return)
// Side effects: 无 (纯 read·assemble·return)
// Test:      smoke-endturn-public-contract (含 record namespace 检查)
//            smoke-endturn-section-boundary (含 record.js 文件存在 + finalize export)
// Notes:     R210·P7-η·suggestions 来源 ctx.record.suggestions (P7-ζ followup 已自 sc2 写)
//            非读取 p2 的 sc2 局部·避免重引入 main-entry 局部依赖
//            timeRatio 来自 ctx.input.timeRatio·主入口在 finalize 前已 ctx.input 重置
//            sanitize 后·主入口必须先写 sanitized locals 回 ctx.record·再调 finalize
// ============================================================
(function(global) {
  'use strict';
  if (typeof global.TM === 'undefined') global.TM = {};
  if (typeof global.TM.Endturn === 'undefined') global.TM.Endturn = {};
  if (typeof global.TM.Endturn.AI === 'undefined') global.TM.Endturn.AI = {};
  if (typeof global.TM.Endturn.AI.record === 'undefined') global.TM.Endturn.AI.record = {};

  var ns = global.TM.Endturn.AI.record;

  ns.finalize = function(ctx) {
    var record = (ctx && ctx.record) ? ctx.record : {};
    var input = (ctx && ctx.input) ? ctx.input : {};
    return {
      shizhengji: record.shizhengji || '',
      zhengwen: record.zhengwen || '',
      playerStatus: record.playerStatus || '',
      playerInner: record.playerInner || '',
      turnSummary: record.turnSummary || '',
      timeRatio: input.timeRatio,
      suggestions: Array.isArray(record.suggestions) ? record.suggestions : [],
      shiluText: record.shiluText || '',
      szjTitle: record.szjTitle || '',
      szjSummary: record.szjSummary || '',
      personnelChanges: Array.isArray(record.personnelChanges) ? record.personnelChanges : [],
      hourenXishuo: record.hourenXishuo || ''
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
