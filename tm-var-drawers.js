/**
 * tm-var-drawers.js — 户口/民心/皇权/皇威 侧边抽屉（纯数据展示）
 *
 * === 三代叠加关系（这不是"死代码并存"，是 add-on 分层增强） ===
 * 本文件为 Phase 1（v1 基础层）：定义 open/close/render 函数
 *   下一代：tm-var-drawers-ext.js   (Phase 2: Rich 替换，把 render* 替换为 Rich 版本)
 *   再下代：tm-var-drawers-final.js (Phase 3: Extra wrap，在 render* 末尾追加 extra 内容)
 *
 * 加载顺序必须严格 1 → 2 → 3（见 index.html）。
 * 任何想合并三个文件的人：注意 v2 的 _install 和 v3 的 _installFinal 原本用 setTimeout(200/400ms)
 * 做延迟安装，2026-04-24 已取消延迟改为模块加载时立即执行（合并前提 = 顺序加载）。
 * 若要真合并为单文件：拼接 v1→v2→v3，删三个 IIFE 保留一个，去重 _fmt/_esc/_sec，
 * _install 与 _installFinal 末尾直接 inline 调用。不紧急，风险 > 收益。
 *
 * 原则：
 *   1. 抽屉只展示信息，不含任何操作按钮/表单。
 *   2. 玩家操作去游戏原有的中间栏标签页（诏令/奏疏/问对/鸿雁/朝议/朝政/官制/科举/
 *      起居注/纪事/史记/编年/文苑）。
 *   3. 突发事件通过 addEB 风闻录事 / 大臣奏疏 / NPC 求见 呈现。
 *   4. 点击 NPC 姓名 → 展开人物详情面板（preview-char-full.html）。
 */
(function(global) {
  'use strict';

  function _fmt(n) {
    if (n === undefined || n === null || isNaN(n)) return '—';
    var abs = Math.abs(n);
    if (abs >= 1e8) return (n/1e8).toFixed(2) + '亿';
    if (abs >= 1e4) return (n/1e4).toFixed(1) + '万';
    return Math.round(n).toLocaleString();
  }
  function _esc(s) {
    return (s == null ? '' : String(s)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function _sec(title, badge, content) {
    return '<section class="vd-section"><div class="vd-section-title">' + _esc(title) + (badge ? ' <span class="vd-badge">' + _esc(badge) + '</span>' : '') + '</div>' + content + '</section>';
  }

  // 跳转提示块（点击跳到对应中间栏标签页）
  function _tabJump(label, tabId) {
    return '<div style="padding:6px 10px;margin:3px 0;background:var(--bg-2);border-left:3px solid var(--gold-d);border-radius:3px;font-size:0.74rem;cursor:pointer;" ' +
      'onclick="if(typeof switchGTab===\'function\')switchGTab(null,\'' + tabId + '\');' +
      'document.querySelectorAll(\'.var-drawer-overlay\').forEach(function(o){o.classList.remove(\'open\');});">' +
      '→ <b>' + _esc(label) + '</b>（切至标签页处理）' +
    '</div>';
  }

  // NPC 姓名点击跳详情
  function _npcLink(name) {
    if (!name) return '';
    var safeName = _esc(name).replace(/'/g, "\\'");
    return '<span style="color:var(--gold-300);cursor:pointer;text-decoration:underline dotted;" ' +
      'onclick="if(typeof openCharDetail===\'function\')openCharDetail(\'' + safeName + '\');else if(typeof openCharRenwuPage===\'function\')openCharRenwuPage(\'' + safeName + '\');">' + _esc(name) + '</span>';
  }

  // 抽屉创建辅助
  function _createDrawer(id, title, subtitleId, bodyId, closeFn) {
    var ov = document.getElementById(id + '-drawer-ov');
    if (ov) return ov;
    ov = document.createElement('div');
    ov.id = id + '-drawer-ov';
    ov.className = 'var-drawer-overlay';
    ov.innerHTML = '<div class="var-drawer" id="' + id + '-drawer">' +
      '<div class="var-drawer-header">' +
        '<div>' +
          '<div class="var-drawer-title">' + _esc(title) + '</div>' +
          '<div class="var-drawer-subtitle" id="' + subtitleId + '"></div>' +
        '</div>' +
        '<button class="var-drawer-close" onclick="' + closeFn + '()">×</button>' +
      '</div>' +
      '<div class="var-drawer-body" id="' + bodyId + '"></div>' +
    '</div>';
    ov.addEventListener('click', function(e) {
      if (e.target === ov) global[closeFn]();
    });
    document.body.appendChild(ov);
    return ov;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  户口之察 · 在籍图
  // ═══════════════════════════════════════════════════════════════════

  function openHukouPanel() {
    _createDrawer('hukou', '户口之察 · 在籍图', 'hukou-subtitle', 'hukou-body', 'closeHukouPanel');
    // 通过 global 查找，让 ext/final 的 Rich 版本能生效（ext.js 在 DOMContentLoaded 后替换 global.renderHukouPanel）
    (global.renderHukouPanel || renderHukouPanel)();
    document.getElementById('hukou-drawer-ov').classList.add('open');
  }
  function closeHukouPanel() {
    var ov = document.getElementById('hukou-drawer-ov');
    if (ov) ov.classList.remove('open');
  }
  function renderHukouPanel() {
    var body = document.getElementById('hukou-body');
    var subt = document.getElementById('hukou-subtitle');
    if (!body) return;
    var G = global.GM || {}; var P = G.population || {};
    if (!P.national) { body.innerHTML = '<div class="vd-empty">户口未初始化</div>'; return; }
    if (subt) subt.textContent = '户 ' + _fmt(P.national.households) + ' · 口 ' + _fmt(P.national.mouths) + ' · 丁 ' + _fmt(P.national.ding);
    var html = '';

    // § 总览
    html += '<section class="vd-section"><div class="vd-overview">';
    html += '<div class="vd-ov-row"><span class="vd-ov-label">户数</span><span class="vd-ov-value">' + _fmt(P.national.households) + '</span></div>';
    html += '<div class="vd-ov-row"><span class="vd-ov-label">人口</span><span class="vd-ov-value">' + _fmt(P.national.mouths) + '</span></div>';
    html += '<div class="vd-ov-row"><span class="vd-ov-label">丁壮</span><span class="vd-ov-value">' + _fmt(P.national.ding) + '</span></div>';
    html += '<div class="vd-ov-row"><span class="vd-ov-label">逃户</span><span class="vd-ov-value" style="color:var(--amber-400);">' + _fmt(P.fugitives||0) + '</span></div>';
    html += '<div class="vd-ov-row"><span class="vd-ov-label">隐户</span><span class="vd-ov-value" style="color:var(--amber-400);">' + _fmt(P.hiddenCount||0) + '</span></div>';
    if (P.meta && P.meta.registrationAccuracy !== undefined) {
      html += '<div class="vd-ov-row"><span class="vd-ov-label">黄册准确度</span><span class="vd-ov-value">' + (P.meta.registrationAccuracy*100).toFixed(0) + '%</span></div>';
    }
    html += '</div></section>';

    // 基础数据会由 ext + final 文件追加（承载力/色目/徭役/兵制/阶层/迁徙/疫病等）
    // 跳转提示：所有户口相关操作走诏令/官制/朝议
    html += _sec('如何操作', null,
      _tabJump('写诏治户口（清查/招抚/改土/迁徙/兴工）', 'gt-edict') +
      _tabJump('看官制树（各省督抚/公库/主官）', 'gt-office') +
      _tabJump('看编年（户口消长历史）', 'gt-biannian')
    );

    body.innerHTML = html;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  民心之察 · 天下民情
  // ═══════════════════════════════════════════════════════════════════

  function openMinxinPanel() {
    _createDrawer('minxin', '民心之察 · 天下民情', 'minxin-subtitle', 'minxin-body', 'closeMinxinPanel');
    (global.renderMinxinPanel || renderMinxinPanel)();
    document.getElementById('minxin-drawer-ov').classList.add('open');
  }
  function closeMinxinPanel() {
    var ov = document.getElementById('minxin-drawer-ov');
    if (ov) ov.classList.remove('open');
  }
  function renderMinxinPanel() {
    var body = document.getElementById('minxin-body');
    var subt = document.getElementById('minxin-subtitle');
    if (!body) return;
    var G = global.GM || {}; var m = G.minxin || {};
    var trueIdx = m.trueIndex || 60;
    var perc = m.perceivedIndex !== undefined ? m.perceivedIndex : trueIdx;
    if (subt) subt.textContent = '真 ' + Math.round(trueIdx) + ' · 视 ' + Math.round(perc) + ' · ' + _esc(m.phase||'peaceful');
    var html = '';

    // § 总览
    html += '<section class="vd-section"><div class="vd-overview">';
    var trueCol = trueIdx >= 60 ? '#6aa88a' : trueIdx >= 40 ? 'var(--gold)' : 'var(--vermillion-400)';
    html += '<div class="vd-ov-row"><span class="vd-ov-label">真实民心</span><span class="vd-ov-value" style="color:' + trueCol + ';">' + Math.round(trueIdx) + ' / 100</span></div>';
    html += '<div class="vd-ov-row"><span class="vd-ov-label">朝廷视野</span><span class="vd-ov-value">' + Math.round(perc) + '（粉饰 ' + (perc-trueIdx>=0?'+':'') + Math.round(perc-trueIdx) + '）</span></div>';
    html += '<div class="vd-ov-row"><span class="vd-ov-label">段位</span><span class="vd-ov-value">' + _esc(m.phase||'peaceful') + '</span></div>';
    html += '</div></section>';

    // 进行中民变（只展示，不干预）— 干预靠写诏/朱批奏疏
    if (m.revolts) {
      var ongoing = m.revolts.filter(function(r){return r.status==='ongoing';});
      if (ongoing.length > 0) {
        var LEVELS = (typeof global.AuthorityComplete !== 'undefined' && global.AuthorityComplete.REVOLT_LEVELS) || [];
        var rh = '';
        ongoing.forEach(function(r) {
          var lv = LEVELS[(r.level||1) - 1] || { name:'L'+r.level };
          rh += '<div style="padding:6px 8px;background:rgba(192,64,48,0.08);border-left:3px solid var(--vermillion-400);border-radius:3px;margin:2px 0;font-size:0.74rem;">';
          rh += '<b style="color:var(--vermillion-300);">[' + _esc(lv.name) + ']</b> ' + _esc(r.region||'某地') + ' · ' + _fmt(r.scale||5000) + (r.cause?' · 因 '+_esc(r.cause):'');
          if (r.leader) rh += ' · 首 ' + _npcLink(r.leader);
          rh += '</div>';
        });
        html += _sec('进行中民变', ongoing.length + ' 起', rh);
      }
    }

    // 近年异象（只展示）
    if (G.heavenSigns && G.heavenSigns.length > 0) {
      var recent = G.heavenSigns.filter(function(s){return (G.turn||0) - s.turn < 12;});
      if (recent.length > 0) {
        var sh = '';
        recent.slice(-8).forEach(function(s) {
          var col = s.type==='good' ? '#6aa88a' : 'var(--vermillion-400)';
          sh += '<div style="font-size:0.72rem;color:' + col + ';padding:1px 0;">' + (s.type==='good'?'🌟':'⚠') + ' [T' + s.turn + '] ' + _esc(s.name) + '</div>';
        });
        html += _sec('近年天象·祥瑞', recent.length + '', sh);
      }
    }

    // 跳转提示
    html += _sec('如何应对', null,
      _tabJump('看奏疏（大臣所献民变/天象应对策）', 'gt-memorial') +
      _tabJump('写诏（蠲免/赈济/招安/大赦等）', 'gt-edict') +
      _tabJump('召见大臣问对', 'gt-wendui') +
      _tabJump('鸿雁传书（密信地方督抚）', 'gt-letter') +
      _tabJump('重大议事朝议', 'gt-chaoyi')
    );

    body.innerHTML = html;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  乾纲之察 · 皇权图
  // ═══════════════════════════════════════════════════════════════════

  function openHuangquanPanel() {
    _createDrawer('huangquan', '乾纲之察 · 皇权图', 'huangquan-subtitle', 'huangquan-body', 'closeHuangquanPanel');
    (global.renderHuangquanPanel || renderHuangquanPanel)();
    document.getElementById('huangquan-drawer-ov').classList.add('open');
  }
  function closeHuangquanPanel() {
    var ov = document.getElementById('huangquan-drawer-ov');
    if (ov) ov.classList.remove('open');
  }
  function renderHuangquanPanel() {
    var body = document.getElementById('huangquan-body');
    var subt = document.getElementById('huangquan-subtitle');
    if (!body) return;
    var G = global.GM || {}; var hq = G.huangquan || {};
    var idx = hq.index || 50;
    var phase = idx >= 70 ? '专制' : idx >= 35 ? '制衡' : '权臣';
    if (subt) subt.textContent = Math.round(idx) + ' / 100 · ' + phase;
    var html = '';

    // § 总览
    html += '<section class="vd-section"><div class="vd-overview">';
    var col = phase === '专制' ? 'var(--vermillion-300)' : phase === '制衡' ? 'var(--gold)' : 'var(--amber-400)';
    html += '<div class="vd-ov-row"><span class="vd-ov-label">皇权指数</span><span class="vd-ov-value" style="color:' + col + ';">' + Math.round(idx) + ' / 100</span></div>';
    html += '<div class="vd-ov-row"><span class="vd-ov-label">段位</span><span class="vd-ov-value">' + phase + '</span></div>';
    if (hq.executionRate) html += '<div class="vd-ov-row"><span class="vd-ov-label">执行率</span><span class="vd-ov-value">' + (hq.executionRate*100).toFixed(0) + '%</span></div>';
    html += '</div></section>';

    // 权臣（只展示，不操作）
    if (hq.powerMinister) {
      var pm = hq.powerMinister;
      var ph = '<div style="padding:8px 10px;background:rgba(192,64,48,0.08);border-left:3px solid var(--vermillion-400);border-radius:3px;font-size:0.78rem;">';
      ph += '⚠ <b>' + _npcLink(pm.name) + '</b> · 控制 ' + ((pm.controlLevel||0)*100).toFixed(0) + '% · 党羽 ' + (pm.faction||[]).length + ' · 拦截 ' + (pm.interceptions||0) + ' · 自拟 ' + (pm.counterEdicts||0);
      ph += '</div>';
      html += _sec('权臣', null, ph);
    }

    // 奏疏/抗疏/问疑 计数（跳转到对应标签页）
    var pendM = (G._pendingMemorials||[]).filter(function(m){return m.status==='drafted';}).length;
    var pendAb = (G._abductions||[]).filter(function(a){return (G.turn||0) - a.turn < 6 && !a.status;}).length;
    var pendClar = (G._pendingClarifications||[]).filter(function(c){return c.status==='awaiting_answer';}).length;
    if (pendM + pendAb + pendClar > 0) {
      var nh = '<div style="font-size:0.76rem;">';
      if (pendM > 0) nh += '<div>· 奏疏待朱批 <b style="color:var(--amber-400);">' + pendM + '</b> 本</div>';
      if (pendAb > 0) nh += '<div>· 抗疏 <b style="color:var(--vermillion-400);">' + pendAb + '</b> 则</div>';
      if (pendClar > 0) nh += '<div>· 侍臣问疑 <b style="color:var(--amber-400);">' + pendClar + '</b> 则</div>';
      nh += '</div>';
      html += _sec('待处理', null, nh);
    }

    // 跳转提示
    html += _sec('如何操作', null,
      _tabJump('朱批奏疏（含抗疏/问疑 诸事）', 'gt-memorial') +
      _tabJump('写诏（任免/削藩/新设/清洗 诸事）', 'gt-edict') +
      _tabJump('召见大臣问对', 'gt-wendui') +
      _tabJump('密信（鸿雁传书）', 'gt-letter') +
      _tabJump('看官制树', 'gt-office') +
      _tabJump('重大议事朝议', 'gt-chaoyi')
    );

    body.innerHTML = html;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  天威之察 · 皇威图
  // ═══════════════════════════════════════════════════════════════════

  function openHuangweiPanel() {
    _createDrawer('huangwei', '天威之察 · 皇威图', 'huangwei-subtitle', 'huangwei-body', 'closeHuangweiPanel');
    (global.renderHuangweiPanel || renderHuangweiPanel)();
    document.getElementById('huangwei-drawer-ov').classList.add('open');
  }
  function closeHuangweiPanel() {
    var ov = document.getElementById('huangwei-drawer-ov');
    if (ov) ov.classList.remove('open');
  }
  function renderHuangweiPanel() {
    var body = document.getElementById('huangwei-body');
    var subt = document.getElementById('huangwei-subtitle');
    if (!body) return;
    var G = global.GM || {}; var w = G.huangwei || {};
    var idx = w.index || 50;
    var perc = w.perceivedIndex !== undefined ? w.perceivedIndex : idx;
    if (subt) subt.textContent = '真 ' + Math.round(idx) + ' · 视 ' + Math.round(perc) + ' · ' + _esc(w.phase||'normal');
    var html = '';

    // § 总览
    html += '<section class="vd-section"><div class="vd-overview">';
    var phase = w.phase || 'normal';
    var phaseName = { tyrant:'暴君',majesty:'威严',normal:'常望',decline:'衰微',lost:'失威' }[phase] || phase;
    var col = phase==='tyrant' ? 'var(--vermillion-500)' : phase==='majesty' ? '#6aa88a' : phase==='normal' ? 'var(--gold)' : 'var(--amber-400)';
    html += '<div class="vd-ov-row"><span class="vd-ov-label">真实威望</span><span class="vd-ov-value" style="color:' + col + ';">' + Math.round(idx) + ' / 100</span></div>';
    html += '<div class="vd-ov-row"><span class="vd-ov-label">朝廷视野</span><span class="vd-ov-value">' + Math.round(perc) + '（差 ' + Math.round(perc-idx) + '）</span></div>';
    html += '<div class="vd-ov-row"><span class="vd-ov-label">段位</span><span class="vd-ov-value">' + phaseName + '段</span></div>';
    html += '</div></section>';

    // 四维/暴君综合症/失威危机/14源降 由 ext + final 追加

    // 跳转提示
    html += _sec('如何操作', null,
      _tabJump('写诏（亲征/大典/罪己/和亲等提升威望）', 'gt-edict') +
      _tabJump('看奏疏（大臣献策）', 'gt-memorial') +
      _tabJump('召见大臣问对', 'gt-wendui') +
      _tabJump('朝议大事', 'gt-chaoyi')
    );

    body.innerHTML = html;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  全局 ESC 关闭 + Orphan UI 重定向（全部改为 toast 提示用标签页）
  // ═══════════════════════════════════════════════════════════════════

  function _closeAll() {
    closeHukouPanel(); closeMinxinPanel(); closeHuangquanPanel(); closeHuangweiPanel();
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') _closeAll();
    });
  }

  function _jumpToTab(tabId) {
    return function() {
      if (typeof global.switchGTab === 'function') global.switchGTab(null, tabId);
      else if (global.toast) global.toast('请切至对应中间栏标签页');
    };
  }

  function _redirectOrphan() {
    // 所有操作 UI 重定向到现有中间栏标签页
    global.openPlayerActionMenu = function() { if (global.toast) global.toast('请用顶栏各变量与中间栏诸标签页'); };
    // 权威四察 → 抽屉
    global.openTianweiInspection = openHuangweiPanel;
    global.openQianGangInspection = openHuangquanPanel;
    global.openMinxinInspection = openMinxinPanel;
    global.openLizhiInspection = function() { if (typeof global.openCorruptionPanel==='function') global.openCorruptionPanel(); };
    global.openHujiDashboard = openHukouPanel;
    global.openMinxinHeatmap = openMinxinPanel;
    // 政务操作 → 诏令
    global.openMilitaryFarmUI = _jumpToTab('gt-edict');
    global.openGaituUI = _jumpToTab('gt-edict');
    global.openMoveCapitalUI = _jumpToTab('gt-edict');
    global.openFrontierUI = _jumpToTab('gt-edict');
    global.openFuyiSchemeComparison = _jumpToTab('gt-edict');
    global.openAnnualFuyiPanel = _jumpToTab('gt-edict');
    global.openEdictReferenceBar = _jumpToTab('gt-edict');
    // 反击权臣 / 朱批 / 问疑 → 奏疏 / 问对
    global.openPowerCounterUI = _jumpToTab('gt-memorial');
    global.openMemorialsPanel = _jumpToTab('gt-memorial');
    global.openRevoltInterventionPanel = _jumpToTab('gt-memorial');
    // 制度志 → 官制 tab
    global.openInstitutionsChronicle = _jumpToTab('gt-office');
    // 天时地利 → 史记/编年
    global.openEnvironmentChronicle = _jumpToTab('gt-biannian');
    // 承载力热力 → 户口抽屉（内嵌数据可看）
    global.openCarryingCapacityHeatmap = openHukouPanel;
    // 年度决算 → 史记
    global.openYearlyReport = _jumpToTab('gt-shiji');
    // 诏令 ABCD、迁都三轮、问疑 → 诏令/奏疏（玩家写诏/批奏）
    if (typeof global.PhaseG3 !== 'undefined') {
      global.PhaseG3.openCorveeABCDPanel = _jumpToTab('gt-edict');
      global.PhaseG3.initiateMovCapitalThreeRound = _jumpToTab('gt-chaoyi');
    }
    if (typeof global.EdictComplete !== 'undefined') {
      global.EdictComplete.openClarificationPanel = _jumpToTab('gt-memorial');
      global.EdictComplete.openMemorialsPanel = _jumpToTab('gt-memorial');
    }
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _redirectOrphan);
    } else {
      setTimeout(_redirectOrphan, 100);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  导出
  // ═══════════════════════════════════════════════════════════════════

  global.openHukouPanel = openHukouPanel;
  global.closeHukouPanel = closeHukouPanel;
  global.renderHukouPanel = renderHukouPanel;
  global.openMinxinPanel = openMinxinPanel;
  global.closeMinxinPanel = closeMinxinPanel;
  global.renderMinxinPanel = renderMinxinPanel;
  global.openHuangquanPanel = openHuangquanPanel;
  global.closeHuangquanPanel = closeHuangquanPanel;
  global.renderHuangquanPanel = renderHuangquanPanel;
  global.openHuangweiPanel = openHuangweiPanel;
  global.closeHuangweiPanel = closeHuangweiPanel;
  global.renderHuangweiPanel = renderHuangweiPanel;

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
