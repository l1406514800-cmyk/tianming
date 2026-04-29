#!/usr/bin/env node
// scripts/export-official-scenario.js
//
// 把官方剧本 web/scenarios/tianqi7-1627.js 跑一遍 register()，
// 把生成的 scenario 对象 + 其在 P.* 下的实体（characters / factions / parties /
// classes / variables / events / relations / items / rigidHistoryEvents）平铺
// 合并成一份 JSON，写到顶层 scenarios/天启七年·九月（官方）.json。
//
// 与既有用户剧本 JSON（崇祯.json / 挽天倾：崇祯死局.json 等）schema 对齐：
//   { ...scenario, characters: [...], factions: [...], ... }
//
// 用途：备份 · 版本对照 · 独立编辑工具二次加工 · git diff。
// 权威源仍是 tianqi7-1627.js — 这份 JSON 是导出快照，不参与运行时加载。
//
// 用法：
//   node scripts/export-official-scenario.js
//
// 退出码：0 = 成功；1 = 加载/注册失败。
//
// 零依赖（仅 fs / path / 内联运行剧本 JS）。

'use strict';
const fs = require('fs');
const path = require('path');

const SCENARIO_JS = path.resolve(__dirname, '..', 'scenarios', 'tianqi7-1627.js');
const TARGET_JSON = path.resolve(__dirname, '..', '..', 'scenarios', '天启七年·九月（官方）.json');
const SID = 'sc-tianqi7-1627';

global.P = {
  scenarios: [], scripts: [],
  characters: [], factions: [], parties: [], classes: [],
  variables: [], events: [], relations: [],
  rules: [], worldview: [],
  items: [], rigidHistoryEvents: []
};

const origLog = console.log;
console.log = function () {};
require(SCENARIO_JS);
console.log = origLog;

setTimeout(function () {
  const sc = global.P.scenarios.find(function (s) { return s.id === SID; });
  if (!sc) {
    console.error('[export] register 后未找到 scenario id=' + SID);
    process.exit(1);
  }
  function pick(arr) {
    return Array.isArray(arr) ? arr.filter(function (x) { return x && x.sid === SID; }) : [];
  }
  const out = Object.assign({}, sc, {
    characters: pick(global.P.characters),
    factions: pick(global.P.factions),
    parties: pick(global.P.parties),
    classes: pick(global.P.classes),
    variables: pick(global.P.variables),
    events: pick(global.P.events),
    relations: pick(global.P.relations),
    items: pick(global.P.items),
    rigidHistoryEvents: pick(global.P.rigidHistoryEvents)
  });

  fs.writeFileSync(TARGET_JSON, JSON.stringify(out, null, 2), 'utf8');
  const stat = fs.statSync(TARGET_JSON);

  console.log('[export] written → ' + TARGET_JSON);
  console.log('[export] size: ' + (stat.size / 1024).toFixed(1) + ' KB');
  console.log('[export] counts: chars=' + out.characters.length
    + ' facs=' + out.factions.length
    + ' parties=' + out.parties.length
    + ' classes=' + out.classes.length
    + ' vars=' + out.variables.length
    + ' events=' + out.events.length
    + ' rels=' + out.relations.length
    + ' items=' + out.items.length
    + ' rigid=' + out.rigidHistoryEvents.length);
  process.exit(0);
}, 300);
