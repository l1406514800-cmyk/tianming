#!/usr/bin/env node
// scripts/smoke-faction-npc-in-turn-driver.js
// Locks Phase H3 wiring: index load tag, timer scheduling/cancel, and one in-turn NPC LLM move.

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function runFile(ctx, file) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), ctx, { filename: file });
}

async function main() {
  const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const decisionPos = index.indexOf('tm-faction-npc-llm-decision.js');
  const driverPos = index.indexOf('tm-faction-npc-in-turn-driver.js');
  const indexPos = index.indexOf('tm-faction-index.js');
  assert(decisionPos >= 0, 'index missing tm-faction-npc-llm-decision.js');
  assert(driverPos > decisionPos, 'in-turn driver must load after LLM decision');
  assert(indexPos < 0 || driverPos < indexPos, 'in-turn driver should load before faction index/UI block');

  const timers = [];
  const cleared = [];
  const ctx = {
    console: { log() {}, warn() {} },
    Math,
    Date,
    JSON,
    Object,
    Array,
    Number,
    String,
    Boolean,
    RegExp,
    isFinite,
    parseInt,
    parseFloat,
    setTimeout(fn, delay) {
      const id = { fn, delay, cleared: false };
      timers.push(id);
      return id;
    },
    clearTimeout(id) {
      if (id) id.cleared = true;
      cleared.push(id);
    }
  };
  ctx.window = ctx;
  ctx.global = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);

  runFile(ctx, 'tm-faction-npc-settings.js');
  runFile(ctx, 'tm-faction-npc-in-turn-driver.js');

  ctx.P = {
    playerInfo: { factionName: '明朝廷' },
    conf: {
      npcAiPrecision: true,
      npcAiPrecisionMaxPerTurn: 8,
      npcInTurnMaxPerTurn: 2,
      npcInTurnFirstDelayMs: 10,
      npcInTurnRepeatDelayMs: 20
    },
    ai: { key: 'fake' }
  };
  ctx.P.conf.npcAiPrecisionMode = 'lazy';
  ctx.TM.FactionNpcSettings.setEnabled(true);
  assert(ctx.P.conf.npcAiPrecisionMode === 'eager', 'turning precision on should migrate old lazy mode to eager');
  assert(ctx.TM.FactionNpcSettings.isAiPrecisionEnabled(), 'precision switch + key should enable NPC LLM');
  assert(ctx.TM.FactionNpcSettings.isEagerMode(), 'precision switch should also enable endturn eager NPC LLM batch');
  assert(ctx.TM.FactionNpcSettings.getStatus().maxPerTurn === 2, 'legacy endturn precision max should migrate from 8 to 2');
  assert(ctx.P.conf.npcInTurnMaxPerTurn === 8, 'legacy in-turn precision max should migrate from 2 to 8');
  ctx.GM = {
    turn: 7,
    facs: [
      { name: '明朝廷', derivedStrength: { value: 99 } },
      { name: '后金', derivedStrength: { value: 80 } },
      { name: '察哈尔', derivedStrength: { value: 20 } }
    ],
    qijuHistory: []
  };
  ctx.TM.FactionNpcLlmDecision = {
    calls: [],
    async decideFor(name) {
      this.calls.push(name);
      return { applied: true, rationale: name + ' 自主措置' };
    }
  };
  ctx.TM.FactionNpcNewsBridge = {};

  const driver = ctx.TM.FactionNpcInTurnDriver;
  assert(driver && typeof driver.scheduleInTurnRuns === 'function', 'driver export missing');

  const normalGM = ctx.GM;
  const normalPlayerFactionName = ctx.P.playerInfo.factionName;
  ctx.P.playerInfo.factionName = 'mismatched-player-name';
  ctx.GM = {
    turn: 7,
    facs: [
      { name: 'PlayerMarkedOnly', isPlayer: true, derivedStrength: { value: 999 } }
    ],
    qijuHistory: []
  };
  assert(driver._pickOneFac(7) === null, 'pickOneFac must skip fac.isPlayer even when player faction name mismatches');
  ctx.GM = normalGM;
  ctx.P.playerInfo.factionName = normalPlayerFactionName;

  const scheduled = driver.scheduleInTurnRuns();
  assert(scheduled.scheduled === 8, 'default should move eight precision API runs to after-endturn background');
  assert(timers.length === 8, 'mock timers not registered');
  assert(timers[0].delay === 10 && timers[1].delay === 20 && timers[2].delay === 30, 'timer delays should spread by P.conf cadence');

  driver.cancelInTurnTimers();
  assert(cleared.length === 8 && timers.every(t => t.cleared), 'cancel should clear all active timers');

  const picked = driver._pickOneFac(7);
  assert(picked && picked.name !== '明朝廷', 'pickOneFac must skip player faction');

  const ret = await driver._runOneInTurn(7, 'smoke');
  assert(ret && ret.applied, 'runOneInTurn should apply mocked decision');
  assert(ctx.TM.FactionNpcLlmDecision.calls.length === 1, 'decideFor should be called once');
  assert(ctx.TM.FactionNpcLlmDecision.calls[0] !== '明朝廷', 'decideFor must not target player faction');
  const ranFac = ctx.GM.facs.find(f => f.name === ctx.TM.FactionNpcLlmDecision.calls[0]);
  assert(ranFac._inTurnLlmRanTurns.indexOf(7) >= 0, 'ran faction should be marked for this turn');
  assert(ctx.GM.qijuHistory.length === 1 && ctx.GM.qijuHistory[0]._source === 'npc-in-turn-llm', 'qiju marker missing');
  ctx.TM.FactionNpcSettings.setEnabled(false);
  assert(ctx.P.conf.npcAiPrecision === false, 'turning precision off should lower the master switch');
  assert(!ctx.TM.FactionNpcSettings.isAiPrecisionEnabled(), 'turning precision off should stop NPC LLM');
  assert(!ctx.TM.FactionNpcSettings.isEagerMode(), 'turning precision off should stop endturn eager NPC LLM batch');

  console.log('[smoke-faction-npc-in-turn-driver] all assertions pass');
}

main().catch(function(e) {
  console.error('[smoke-faction-npc-in-turn-driver] failed:', e && e.stack || e);
  process.exit(1);
});
