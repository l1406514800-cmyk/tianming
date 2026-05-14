#!/usr/bin/env node
// smoke-office-appointment-sync.js — lock holder/actualHolders sync for office appointments.

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
let assertions = 0;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
  assertions++;
}

function fakeEl() {
  return { value: '', style: {}, innerHTML: '', textContent: '', appendChild(){}, remove(){}, querySelector(){ return null; } };
}

const context = {
  console,
  Date,
  JSON,
  Math,
  RegExp,
  Array,
  Object,
  String,
  Number,
  Boolean,
  parseInt,
  parseFloat,
  isNaN,
  setTimeout(){},
  clearTimeout(){},
  document: {
    getElementById: () => fakeEl(),
    querySelectorAll: () => [],
    createElement: () => fakeEl(),
    body: fakeEl(),
    addEventListener(){}
  },
  window: null,
  P: { playerInfo: { characterName: '皇帝' } },
  scriptData: {},
  GM: {
    turn: 5,
    officeTree: [],
    chars: [],
    evtLog: [],
    _chronicle: [],
    qijuHistory: []
  },
  SettlementPipeline: { register(){} },
  autoSave(){},
  showToast(){},
  alert(){},
  escHtml(v) { return String(v == null ? '' : v); },
  toast(){},
  _dbg(){},
  addEB(){},
  recordCharacterArc(){},
  _isSameLocation(a, b) { return a === b; },
  getTSText(turn) { return 'T' + turn; },
  findCharByName() { return null; }
};
context.window = context;
context.globalThis = context;
context.addEB = function(type, text) { context.GM.evtLog.push({ type, text }); };
context.findCharByName = function(name) {
  return (context.GM.chars || []).find(ch => ch && ch.name === name) || null;
};

vm.createContext(context);

function load(file) {
  const code = fs.readFileSync(path.join(ROOT, file), 'utf8');
  vm.runInContext(code, context, { filename: file });
}

load('tm-office-system.js');
load('tm-endturn-edict.js');
load('editor-crud.js');
load('tm-office-panel.js');

context.GM.chars = [
  { name: '旧臣', officialTitle: '尚书', position: '尚书', alive: true },
  { name: '新臣', officialTitle: '侍郎', position: '侍郎', alive: true, location: '京师' }
];
context.GM.officeTree = [
  { name: '吏部', positions: [
    { name: '尚书', holder: '旧臣', establishedCount: 1, vacancyCount: 0, actualHolders: [{ name: '旧臣', generated: true }] },
    { name: '侍郎', holder: '新臣', establishedCount: 1, vacancyCount: 0, actualHolders: [{ name: '新臣', generated: true }] }
  ], subs: [] }
];

context.applyEdictActions({ appointments: [{ character: '新臣', position: '尚书' }], dismissals: [], deaths: [] });

const shangshu = context.GM.officeTree[0].positions[0];
const shilang = context.GM.officeTree[0].positions[1];
assert(shangshu.holder === '新臣', 'appointment should update legacy holder');
assert(Array.isArray(shangshu.actualHolders), 'appointment should preserve actualHolders');
assert(shangshu.actualHolders.some(h => h && h.name === '新臣' && h.generated !== false), 'appointment should update actualHolders');
assert(!shangshu.actualHolders.some(h => h && h.name === '旧臣'), 'appointment should remove old holder from target actualHolders');
assert(shangshu.vacancyCount === 0, 'appointment should keep vacancy count synced');
assert(shilang.holder === '', 'appointment should vacate previous office holder field');
assert(!shilang.actualHolders.some(h => h && h.name === '新臣'), 'appointment should vacate previous office actualHolders');
assert(context.GM.chars[0].officialTitle === '', 'appointment should clear displaced character title');
assert(context.GM.chars[1].officialTitle === '尚书', 'appointment should update new character title');

context.applyEdictActions({ appointments: [], dismissals: [{ character: '新臣' }], deaths: [] });

assert(shangshu.holder === '', 'dismissal should clear legacy holder');
assert(!shangshu.actualHolders.some(h => h && h.name === '新臣'), 'dismissal should clear actualHolders');
assert(shangshu.actualHolders.some(h => h && h.generated === false), 'dismissal should leave vacancy placeholder');
assert(context.GM.chars[1].officialTitle === '', 'dismissal should clear character title');

context.scriptData = {
  characters: [
    { name: '编修甲', officialTitle: '无' },
    { name: '原尚书', officialTitle: '尚书' }
  ],
  government: {
    nodes: [
      { name: '吏部', positions: [
        { name: '尚书', holder: '原尚书', establishedCount: 1, vacancyCount: 0, actualHolders: [{ name: '原尚书', generated: true }] }
      ], subs: [] }
    ]
  },
  officeTree: []
};
const editorSync = context._syncCharacterOfficeHolder(
  { name: '编修甲', officialTitle: '无' },
  { name: '编修甲', officialTitle: '吏部尚书' }
);
const editorPos = context.scriptData.government.nodes[0].positions[0];
assert(editorSync.synced === true, 'editor title save should report synced');
assert(editorPos.holder === '编修甲', 'editor title save should update holder');
assert(editorPos.actualHolders.some(h => h && h.name === '编修甲' && h.generated !== false), 'editor title save should update actualHolders');
assert(context.scriptData.characters[1].officialTitle === '无', 'editor title save should clear displaced character title');

context.GM.turn = 9;
context.GM._edictTracker = [];
context.GM._edictSuggestions = [];
context.GM.chars = [
  { name: 'OldOfficer', officialTitle: '', position: '', alive: true },
  { name: 'NewOfficer', officialTitle: '', position: '', alive: true, location: 'Capital' }
];
context.GM.officeTree = [
  { name: 'TestDept', positions: [
    {
      name: 'TestMinister',
      holder: '',
      establishedCount: 1,
      vacancyCount: 0,
      actualHolders: [{ name: 'OldOfficer', generated: true }],
      publicTreasury: { currentHead: 'OldOfficer' }
    }
  ], subs: [] }
];

context._offPickerConfirm('NewOfficer', 'TestDept', 'TestMinister', '', 'resign');

const directPanelPos = context.GM.officeTree[0].positions[0];
assert(directPanelPos.holder === 'NewOfficer', 'direct panel appointment should replace stale actualHolders primary holder');
assert(directPanelPos.actualHolders.some(h => h && h.name === 'NewOfficer' && h.generated !== false), 'direct panel appointment should write new holder to actualHolders');
assert(!directPanelPos.actualHolders.some(h => h && h.name === 'OldOfficer'), 'direct panel appointment should clear stale actualHolders holder');
assert(directPanelPos.publicTreasury.currentHead === 'NewOfficer', 'direct panel appointment should update treasury currentHead');
assert(directPanelPos._pendingEdict && directPanelPos._pendingEdict.prevHolder === 'OldOfficer', 'direct panel appointment should snapshot effective previous holder');
assert(context.GM.chars[1].officialTitle === 'TestMinister', 'direct panel appointment should update new character title');

console.log('[smoke-office-appointment-sync] pass assertions=' + assertions);
