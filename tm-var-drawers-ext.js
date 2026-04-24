/**
 * tm-var-drawers-ext.js — 抽屉内容极大扩充
 *
 * 覆盖 tm-var-drawers.js 中户口/民心/皇权/皇威四抽屉的 renderXxxPanel，
 * 展示所有实施的方案内容（含14源14降/民变5级/异象三库/
 * 朝代预设/历史案例/徭役25预设/迁徙通道等）。
 */
(function(global) {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════
  //  中文标签库（把 source/drain key 翻译为古语）
  // ═══════════════════════════════════════════════════════════════════

  var HW_SRC_LABELS = {
    militaryVictory:'军胜', territoryExpansion:'拓疆', grandCeremony:'大典',
    executeRebelMinister:'诛逆', suppressRevolt:'平乱', auspicious:'祥瑞',
    benevolence:'德政', selfBlame:'罪己', tribute:'朝贡', imperialFuneral:'国丧',
    rehabilitation:'昭雪', culturalAchievement:'文治', personalCampaign:'亲征',
    structuralReform:'新制'
  };
  var HW_DRN_LABELS = {
    militaryDefeat:'军败', diplomaticHumiliation:'辱国', idleGovern:'怠政',
    courtScandal:'宫闱', heavenlySign:'天象', forcedAbdication:'逼禅',
    brokenPromise:'食言', deposeFailure:'废立挫', imperialFlight:'出奔',
    capitalFall:'京畿陷', personalCampaignFail:'亲征败', familyScandal:'帝家丑',
    memorialObjection:'抗疏', lostVirtueRumor:'失德谣'
  };
  var HQ_SRC_LABELS = {
    purge:'清洗', secretPolice:'厂卫', personalRule:'亲政',
    structureReform:'改制', militaryCentral:'收军权', tour:'巡狩',
    heirDecision:'定储', executePM:'诛权臣'
  };
  var HQ_DRN_LABELS = {
    trustedMinister:'托孤臣', eunuchsRelatives:'宦外戚', youngOrIllness:'主幼病',
    factionConsuming:'党争', idleGovern:'怠政', militaryDefeat:'大败',
    cabinetization:'票拟制', memorialObjection:'抗疏'
  };
  var MX_SRC_LABELS = {
    taxation:'赋税', corvee:'徭役', disasterRelief:'赈济',
    judicialFairness:'司法', localOfficial:'官吏', priceStability:'物价',
    security:'治安', socialMobility:'仕路', culturalPolicy:'文治',
    heavenSign:'天象', auspicious:'祥瑞', prophecy:'谶纬',
    warResult:'兵事', imperialVirtue:'帝德', policyBalance:'中道',
    policyExtreme:'极端'
  };
  var MX_PHASE_NAMES = { revolt:'揭竿', angry:'窃盗', uneasy:'忍耐', peaceful:'安居', adoring:'颂圣' };
  var HW_PHASE_NAMES = { tyrant:'暴君', majesty:'威严', normal:'常望', decline:'衰微', lost:'失威' };
  var HQ_PHASE_NAMES = { strong:'专制', absolute:'专制', moderate:'制衡', balanced:'制衡', weak:'权臣', minister:'权臣' };

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
  function _meter(value, max, color) {
    var pct = Math.max(0, Math.min(100, (value / (max||100)) * 100));
    return '<div style="height:5px;background:var(--bg-3);border-radius:3px;overflow:hidden;"><div style="height:100%;width:' + pct + '%;background:' + (color||'var(--gold-400)') + ';"></div></div>';
  }
  function _wrap(label, innerHtml, closeExpr) {
    return '<section class="vd-section" style="background:linear-gradient(180deg,rgba(184,154,83,0.08),transparent);border:1px solid var(--gold-d);border-radius:6px;padding:0.8rem 1rem;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;padding-bottom:0.3rem;border-bottom:1px dashed var(--color-border-subtle);">' +
        '<div style="font-size:0.82rem;color:var(--gold);font-weight:600;letter-spacing:0.08em;">' + _esc(label) + '</div>' +
        '<button style="background:none;border:none;color:var(--txt-d);cursor:pointer;font-size:1rem;" onclick="' + closeExpr + '">×</button>' +
      '</div>' + innerHtml + '</section>';
  }

  // ═══════════════════════════════════════════════════════════════════
  //  皇威抽屉 · 详尽版
  // ═══════════════════════════════════════════════════════════════════

  function renderHuangweiPanelRich() {
    var body = document.getElementById('huangwei-body');
    var subt = document.getElementById('huangwei-subtitle');
    if (!body) return;
    var G = global.GM || {}; var w = G.huangwei || {};
    var idx = w.index || 50;
    var perc = w.perceivedIndex !== undefined ? w.perceivedIndex : idx;
    var phase = w.phase || 'normal';
    var phaseName = HW_PHASE_NAMES[phase] || phase;
    if (subt) subt.textContent = '真 ' + Math.round(idx) + ' · 视 ' + Math.round(perc) + ' · ' + phaseName;

    var html = '';

    // § 总览
    html += '<section class="vd-section"><div class="vd-overview">';
    var col = phase==='tyrant'?'var(--vermillion-500)':phase==='majesty'?'#6aa88a':phase==='normal'?'var(--gold)':phase==='decline'?'var(--amber-400)':'var(--vermillion-400)';
    html += '<div class="vd-ov-row"><span class="vd-ov-label">真实威望</span><span class="vd-ov-value" style="color:' + col + ';font-size:1.05rem;font-weight:600;">' + Math.round(idx) + ' / 100</span></div>';
    html += '<div class="vd-ov-row"><span class="vd-ov-label">朝廷视野</span><span class="vd-ov-value">' + Math.round(perc) + '（粉饰 ' + (perc-idx>=0?'+':'') + Math.round(perc-idx) + '）</span></div>';
    html += '<div class="vd-ov-row"><span class="vd-ov-label">段位</span><span class="vd-ov-value" style="color:' + col + ';"><b>' + phaseName + '</b>段</span></div>';
    var execMult = phase==='tyrant'?1.3:phase==='majesty'?1.0:phase==='normal'?0.85:phase==='decline'?0.65:0.35;
    var execCol = execMult>=1?'#6aa88a':execMult>=0.7?'var(--gold)':'var(--vermillion-400)';
    html += '<div class="vd-ov-row"><span class="vd-ov-label">执行度乘数</span><span class="vd-ov-value" style="color:' + execCol + ';">×' + execMult.toFixed(2) + '（' + (execMult>=1.2?'令出必行':execMult>=0.9?'诏命畅达':execMult>=0.6?'诏行有阻':'诏不出京') + '）</span></div>';
    // 朝代预设提示
    if (G.dynasty && typeof global.PhaseG1 !== 'undefined' && global.PhaseG1.DYNASTY_AUTHORITY_PRESETS && global.PhaseG1.DYNASTY_AUTHORITY_PRESETS[G.dynasty]) {
      html += '<div class="vd-ov-row"><span class="vd-ov-label">朝代</span><span class="vd-ov-value" style="font-size:0.72rem;color:var(--txt-d);">' + _esc(G.dynasty) + '（参朝代预设表）</span></div>';
    }
    html += '</div></section>';

    // § 五段色条
    html += '<section class="vd-section">';
    html += '<div class="vd-section-title">五段谱 <span class="vd-badge">暴/威/常/衰/失</span></div>';
    html += '<div style="display:flex;height:16px;border-radius:3px;overflow:hidden;position:relative;">';
    html += '<div style="width:30%;background:var(--vermillion-400);"></div><div style="width:20%;background:var(--amber-400);"></div><div style="width:20%;background:var(--ink-500);"></div><div style="width:20%;background:#6aa88a;"></div><div style="width:10%;background:var(--vermillion-500);"></div>';
    html += '<div style="position:absolute;top:-2px;left:' + Math.max(0,Math.min(99,idx)) + '%;width:3px;height:20px;background:var(--gold);box-shadow:0 0 4px var(--gold);"></div>';
    html += '</div>';
    html += '<div style="display:flex;justify-content:space-between;font-size:0.66rem;color:var(--txt-d);margin-top:2px;"><span>失威</span><span>衰微</span><span>常望</span><span>威严</span><span>暴君</span></div>';
    html += '</section>';

    // § 四维
    if (w.subDims) {
      var sh = '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;">';
      var labels = {court:'朝廷',provincial:'藩屏',military:'军中',foreign:'外邦'};
      ['court','provincial','military','foreign'].forEach(function(k) {
        var v = (w.subDims[k] && w.subDims[k].value) || 0;
        var tr = (w.subDims[k] && w.subDims[k].trend) || '';
        var trs = tr==='rising'?' ↑':tr==='falling'?' ↓':'';
        var cc = v>=70?'#6aa88a':v>=50?'var(--gold)':v>=30?'var(--amber-400)':'var(--vermillion-400)';
        sh += '<div style="padding:6px;background:var(--bg-2);text-align:center;border-radius:3px;">' +
          '<div style="font-size:0.66rem;color:var(--txt-d);">' + labels[k] + '</div>' +
          '<div style="font-size:0.92rem;color:' + cc + ';font-weight:600;">' + Math.round(v) + trs + '</div>' +
        '</div>';
      });
      sh += '</div>';
      html += _sec('四维分项 · 天威所及', null, sh);
    }

    // § 14 上升源（带中文 label）
    if (w.sources) {
      var sh2 = '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:2px;">';
      Object.keys(HW_SRC_LABELS).forEach(function(k) {
        var v = w.sources[k] || 0;
        var sCol = v>5?'#6aa88a':v>1?'var(--gold)':'var(--txt-d)';
        sh2 += '<div style="display:flex;justify-content:space-between;font-size:0.7rem;padding:2px 4px;background:var(--bg-2);border-radius:2px;">' +
          '<span>' + HW_SRC_LABELS[k] + '</span><span style="color:' + sCol + ';">+' + v.toFixed(1) + '</span></div>';
      });
      sh2 += '</div>';
      html += _sec('十四源 · 威所由生', '累计', sh2);
    }
    // § 14 下降源
    if (w.drains) {
      var dh2 = '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:2px;">';
      Object.keys(HW_DRN_LABELS).forEach(function(k) {
        var v = w.drains[k] || 0;
        var dCol = v>5?'var(--vermillion-400)':v>1?'var(--amber-400)':'var(--txt-d)';
        dh2 += '<div style="display:flex;justify-content:space-between;font-size:0.7rem;padding:2px 4px;background:var(--bg-2);border-radius:2px;">' +
          '<span>' + HW_DRN_LABELS[k] + '</span><span style="color:' + dCol + ';">-' + v.toFixed(1) + '</span></div>';
      });
      dh2 += '</div>';
      html += _sec('十四降 · 威所由损', '累计', dh2);
    }

    // § 暴君综合症
    if (w.tyrantSyndrome && w.tyrantSyndrome.active) {
      var ts = w.tyrantSyndrome;
      var th = '<div style="padding:10px;background:rgba(192,64,48,0.08);border-left:3px solid var(--vermillion-500);border-radius:3px;font-size:0.76rem;">';
      th += '<div style="font-size:0.78rem;color:var(--vermillion-300);margin-bottom:4px;">📍 第 ' + (ts.activatedTurn||0) + ' 回合激活</div>';
      th += '<div>颂圣奏疏率 <b style="color:var(--vermillion-400);">' + ((ts.flatteryMemorialRatio||0)*100).toFixed(0) + '%</b></div>';
      th += '<div>过度执行记录 <b>' + (ts.overExecutionLog||[]).length + '</b> 条</div>';
      // 显示近 3 条过度执行
      if (ts.overExecutionLog && ts.overExecutionLog.length > 0) {
        ts.overExecutionLog.slice(-3).forEach(function(e) {
          th += '<div style="font-size:0.68rem;color:var(--txt-d);padding-left:10px;">· T' + e.turn + ' ' + _esc(e.id||e.plan||'某诏') + ' 放大×' + (e.overScale||1.3) + '</div>';
        });
      }
      var hd = ts.hiddenDamage || {};
      th += '<div style="margin-top:6px;color:var(--amber-400);">隐伤四累：</div>';
      th += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:3px;font-size:0.7rem;">';
      th += '<div>民心暗降：<b>' + Math.round(hd.unreportedMinxinDrop||0) + '</b></div>';
      th += '<div>腐败掩盖：<b>' + Math.round(hd.concealedCorruption||0) + '</b></div>';
      th += '<div>错判积累：<b>' + Math.round(hd.accumulatedMisjudgement||0) + '</b></div>';
      th += '<div>帑廪虚账：<b>' + _fmt(hd.fiscalBubble||0) + '</b></div>';
      th += '</div>';
      th += '<div style="margin-top:6px;font-size:0.7rem;color:var(--txt-d);font-style:italic;">诸隐伤将于觉醒时一次兑现（皇威 -25）</div>';
      // 5 觉醒触发
      var TRIG = (typeof global.PhaseD !== 'undefined' && global.PhaseD.TYRANT_AWAKENING_TRIGGERS) || [];
      if (TRIG.length > 0) {
        th += '<div style="margin-top:6px;font-size:0.7rem;color:var(--gold);">五觉醒触发：</div>';
        TRIG.forEach(function(t) {
          th += '<div style="font-size:0.66rem;color:var(--txt-d);padding-left:10px;">· ' + _esc(t.name) + '</div>';
        });
      }
      th += '</div>';
      html += '<section class="vd-section"><div class="vd-section-title" style="color:var(--vermillion-500);">⚠ 暴君综合症激活</div>' + th + '</section>';
    }

    // § 失威危机
    if (w.lostAuthorityCrisis && w.lostAuthorityCrisis.active) {
      var la = w.lostAuthorityCrisis;
      var lh = '<div style="padding:10px;background:rgba(140,40,30,0.12);border-left:3px solid var(--vermillion-500);border-radius:3px;font-size:0.76rem;">';
      lh += '<div style="font-size:0.78rem;color:var(--vermillion-300);margin-bottom:4px;">📍 第 ' + (la.activatedTurn||0) + ' 回合激活</div>';
      lh += '<div>抗疏倍频 <b style="color:var(--vermillion-400);">×' + (la.objectionFrequency||1).toFixed(1) + '</b>（失威段日甚）</div>';
      lh += '<div>地方观望 <b>' + (la.provincialWatching?'已是':'未现') + '</b>（执行速度 ×0.5）</div>';
      lh += '<div>外邦蠢动 <b>' + ((la.foreignEmboldened||0)*100).toFixed(0) + '%</b></div>';
      if (la._tributeStopped) lh += '<div style="color:var(--vermillion-400);">⚠ 朝贡已止</div>';
      lh += '</div>';
      html += '<section class="vd-section"><div class="vd-section-title" style="color:var(--vermillion-500);">⚠ 失威危机激活</div>' + lh + '</section>';
    }

    // § 史
    if (w.history) {
      var hi = w.history;
      var hasAny = (hi.tyrantPeriods && hi.tyrantPeriods.length) || (hi.crisisPeriods && hi.crisisPeriods.length) || (hi.pastHumiliations && hi.pastHumiliations.length);
      if (hasAny) {
        var hh = '<div style="font-size:0.74rem;">';
        if (hi.tyrantPeriods && hi.tyrantPeriods.length) hh += '<div style="color:var(--amber-400);padding:2px 0;">· 暴君期 <b>' + hi.tyrantPeriods.length + '</b> 度</div>';
        if (hi.crisisPeriods && hi.crisisPeriods.length) hh += '<div style="color:var(--amber-400);padding:2px 0;">· 失威期 <b>' + hi.crisisPeriods.length + '</b> 度</div>';
        if (hi.pastHumiliations && hi.pastHumiliations.length) {
          hh += '<div style="color:var(--vermillion-400);padding:2px 0;">· 耻辱史 <b>' + hi.pastHumiliations.length + '</b> 件</div>';
          hi.pastHumiliations.slice(-5).forEach(function(p) {
            hh += '<div style="font-size:0.68rem;color:var(--txt-d);padding-left:12px;">· ' + _esc(p.name||p.id||'耻辱') + '</div>';
          });
        }
        hh += '</div>';
        html += _sec('史 · 往日积压', null, hh);
      }
    }

    body.innerHTML = html;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  皇权抽屉 · 详尽版
  // ═══════════════════════════════════════════════════════════════════

  function renderHuangquanPanelRich() {
    var body = document.getElementById('huangquan-body');
    var subt = document.getElementById('huangquan-subtitle');
    if (!body) return;
    var G = global.GM || {}; var hq = G.huangquan || {};
    var idx = hq.index || 50;
    var phase = idx >= 70 ? 'absolute' : idx >= 35 ? 'balanced' : 'minister';
    var phaseName = HQ_PHASE_NAMES[phase];
    if (subt) subt.textContent = Math.round(idx) + ' / 100 · ' + phaseName;

    var html = '';
    // 先渲染 action slot（inline 操作面板）
    if (typeof global.__renderDrawerActionSlot === 'function') html += global.__renderDrawerActionSlot('huangquan');

    // § 总览
    html += '<section class="vd-section"><div class="vd-overview">';
    var col = phase==='absolute'?'var(--vermillion-300)':phase==='balanced'?'var(--gold)':'var(--amber-400)';
    html += '<div class="vd-ov-row"><span class="vd-ov-label">皇权指数</span><span class="vd-ov-value" style="color:' + col + ';font-size:1.05rem;font-weight:600;">' + Math.round(idx) + ' / 100</span></div>';
    html += '<div class="vd-ov-row"><span class="vd-ov-label">段位</span><span class="vd-ov-value" style="color:' + col + ';"><b>' + phaseName + '</b>段</span></div>';
    if (hq.executionRate) html += '<div class="vd-ov-row"><span class="vd-ov-label">诏令执行率</span><span class="vd-ov-value">' + (hq.executionRate*100).toFixed(0) + '%</span></div>';
    // 四象限
    if (typeof global.AuthorityComplete !== 'undefined' && global.AuthorityComplete.getAuthorityQuadrant) {
      var q = global.AuthorityComplete.getAuthorityQuadrant();
      html += '<div class="vd-ov-row"><span class="vd-ov-label">四象限</span><span class="vd-ov-value" style="color:#6aa88a;">' + _esc(q.name) + '</span></div>';
      if (q.description) html += '<div style="font-size:0.7rem;color:var(--txt-d);text-align:right;font-style:italic;">' + _esc(q.description) + '</div>';
    }
    // 进谏自由度
    if (hq.ministerFreedomToSpeak !== undefined) html += '<div class="vd-ov-row"><span class="vd-ov-label">进谏自由</span><span class="vd-ov-value">' + (hq.ministerFreedomToSpeak*100).toFixed(0) + '%</span></div>';
    if (hq.memorialQuality !== undefined) html += '<div class="vd-ov-row"><span class="vd-ov-label">奏疏质量</span><span class="vd-ov-value">' + (hq.memorialQuality*100).toFixed(0) + '%</span></div>';
    if (hq.reformDifficulty !== undefined) html += '<div class="vd-ov-row"><span class="vd-ov-label">改革难度</span><span class="vd-ov-value">×' + hq.reformDifficulty.toFixed(2) + '</span></div>';
    html += '</div></section>';

    // § 三段谱
    html += '<section class="vd-section">';
    html += '<div class="vd-section-title">三段谱 <span class="vd-badge">权臣/制衡/专制</span></div>';
    html += '<div style="display:flex;height:16px;border-radius:3px;overflow:hidden;position:relative;">';
    html += '<div style="width:35%;background:var(--amber-400);"></div><div style="width:35%;background:#6aa88a;"></div><div style="width:30%;background:var(--vermillion-300);"></div>';
    html += '<div style="position:absolute;top:-2px;left:' + Math.max(0,Math.min(99,idx)) + '%;width:3px;height:20px;background:var(--gold);box-shadow:0 0 4px var(--gold);"></div>';
    html += '</div>';
    html += '<div style="display:flex;justify-content:space-between;font-size:0.66rem;color:var(--txt-d);margin-top:2px;"><span>权臣</span><span>制衡</span><span>专制</span></div>';
    html += '</section>';

    // § 四维
    if (hq.subDims) {
      var sh = '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;">';
      var labels = {central:'中央',provincial:'地方',military:'军队',imperial:'内廷'};
      ['central','provincial','military','imperial'].forEach(function(k) {
        var v = (hq.subDims[k] && hq.subDims[k].value) || 0;
        var cc = v>=70?'#6aa88a':v>=50?'var(--gold)':v>=30?'var(--amber-400)':'var(--vermillion-400)';
        sh += '<div style="padding:6px;background:var(--bg-2);text-align:center;border-radius:3px;">' +
          '<div style="font-size:0.66rem;color:var(--txt-d);">' + labels[k] + '</div>' +
          '<div style="font-size:0.92rem;color:' + cc + ';font-weight:600;">' + Math.round(v) + '</div>' +
        '</div>';
      });
      sh += '</div>';
      html += _sec('四维 · 纲权所及', null, sh);
    }

    // § 8 上升源
    if (hq.sources) {
      var ssh = '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:2px;">';
      Object.keys(HQ_SRC_LABELS).forEach(function(k) {
        var v = hq.sources[k] || 0;
        var sCol = v>5?'#6aa88a':v>1?'var(--gold)':'var(--txt-d)';
        ssh += '<div style="display:flex;justify-content:space-between;font-size:0.7rem;padding:2px 4px;background:var(--bg-2);border-radius:2px;">' +
          '<span>' + HQ_SRC_LABELS[k] + '</span><span style="color:' + sCol + ';">+' + v.toFixed(1) + '</span></div>';
      });
      ssh += '</div>';
      html += _sec('八源 · 权所由立', '累计', ssh);
    }
    // § 8 下降源
    if (hq.drains) {
      var ddh = '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:2px;">';
      Object.keys(HQ_DRN_LABELS).forEach(function(k) {
        var v = hq.drains[k] || 0;
        var dCol = v>5?'var(--vermillion-400)':v>1?'var(--amber-400)':'var(--txt-d)';
        ddh += '<div style="display:flex;justify-content:space-between;font-size:0.7rem;padding:2px 4px;background:var(--bg-2);border-radius:2px;">' +
          '<span>' + HQ_DRN_LABELS[k] + '</span><span style="color:' + dCol + ';">-' + v.toFixed(1) + '</span></div>';
      });
      ddh += '</div>';
      html += _sec('八降 · 权所由夺', '累计', ddh);
    }

    // § 权臣（完整）+ 反击七策
    if (hq.powerMinister) {
      var pm = hq.powerMinister;
      var ph = '<div style="padding:10px;background:rgba(192,64,48,0.08);border-left:3px solid var(--vermillion-400);border-radius:3px;font-size:0.78rem;margin-bottom:6px;">';
      ph += '<div><b style="font-size:0.86rem;color:var(--vermillion-300);">' + _esc(pm.name) + '</b></div>';
      ph += '<div style="margin-top:3px;">控制度 <b>' + ((pm.controlLevel||0)*100).toFixed(0) + '%</b> · 党羽 ' + (pm.faction||[]).length + ' · 拦截 ' + (pm.interceptions||0) + ' · 自拟 ' + (pm.counterEdicts||0) + '</div>';
      if (pm.faction && pm.faction.length > 0) {
        ph += '<div style="margin-top:4px;font-size:0.72rem;color:var(--amber-400);">党羽：' + pm.faction.slice(0,8).map(function(n){return _esc(n);}).join('、') + '</div>';
      }
      ph += '</div>';
      ph += '<div style="font-size:0.7rem;color:var(--txt-d);margin-top:4px;font-style:italic;">反击诸策（密诏/分党/借兵/清议/等死 等）可通过【诏令】【奏疏朱批】【鸿雁传书】诸渠道进行。</div>';
      html += '<section class="vd-section"><div class="vd-section-title" style="color:var(--vermillion-400);">⚠ 权臣坐大</div>' + ph + '</section>';
    }

    // § 奏疏待朱批（纯展示，朱批在 gt-memorial 标签页）
    var pendM = (G._pendingMemorials||[]).filter(function(m){return m.status==='drafted';});
    if (pendM.length > 0) {
      var mh = '';
      pendM.slice(0, 6).forEach(function(mm) {
        mh += '<div style="padding:5px 8px;background:var(--bg-2);border-left:3px solid var(--gold);border-radius:3px;margin-bottom:3px;font-size:0.72rem;">';
        mh += '<div style="color:var(--gold);">' + _esc(mm.subject||mm.typeName) + ' · ' + _esc(mm.drafter||'某官') + '</div>';
        mh += '<div style="color:var(--txt-d);line-height:1.5;">' + _esc((mm.draftText||'').slice(0,80)) + '…</div>';
        mh += '</div>';
      });
      mh += '<div style="font-size:0.68rem;color:var(--txt-d);font-style:italic;">→ 朱批请切至【奏疏】标签页</div>';
      html += '<section class="vd-section"><div class="vd-section-title" style="color:var(--amber-400);">奏疏待朱批 <span class="vd-badge">' + pendM.length + ' 本</span></div>' + mh + '</section>';
    }

    // § 抗疏（纯展示）
    if (G._abductions && G._abductions.length > 0) {
      var recentAb = G._abductions.filter(function(a){return (G.turn||0) - a.turn < 6 && !a.status;});
      if (recentAb.length > 0) {
        var ah = '';
        recentAb.forEach(function(a) {
          ah += '<div style="padding:5px 8px;background:rgba(192,64,48,0.08);border-left:3px solid var(--vermillion-400);margin-bottom:3px;font-size:0.72rem;">';
          ah += '<b>' + _esc(a.objector||'某官') + '</b>：' + _esc((a.content||'').slice(0,80)) + '…';
          ah += '</div>';
        });
        ah += '<div style="font-size:0.68rem;color:var(--txt-d);font-style:italic;">→ 处置请切至【奏疏】标签页</div>';
        html += '<section class="vd-section"><div class="vd-section-title" style="color:var(--vermillion-400);">抗疏 <span class="vd-badge">' + recentAb.length + '</span></div>' + ah + '</section>';
      }
    }
    // 抗疏 12 典范
    var ABDUCTION_CASES = (typeof global.PhaseG3 !== 'undefined' && global.PhaseG3.ABDUCTION_12_CASES) || [];
    if (ABDUCTION_CASES.length > 0) {
      var ach = '<div style="max-height:100px;overflow-y:auto;background:var(--bg-2);padding:4px;font-size:0.68rem;">';
      ABDUCTION_CASES.forEach(function(c) {
        ach += '<div style="padding:1px 2px;">· <b>' + _esc(c.name) + '</b>（' + _esc(c.dynasty) + ' ' + c.year + '）→ ' + _esc(c.outcome||'') + '</div>';
      });
      ach += '</div>';
      html += _sec('十二抗疏典范', '历代', ach);
    }

    // § 侍臣问疑
    if (G._pendingClarifications) {
      var ac = G._pendingClarifications.filter(function(c){return c.status==='awaiting_answer';});
      if (ac.length > 0) {
        var ch = '';
        ac.forEach(function(c) {
          ch += '<div style="padding:6px 8px;background:var(--bg-2);margin-bottom:4px;font-size:0.74rem;border-left:3px solid var(--amber-400);">';
          ch += '<div>诏："' + _esc((c.originalText||'').slice(0,60)) + '…"</div>';
          ch += '<div style="color:var(--txt-d);margin:2px 0;">' + _esc((c.questions && c.questions[0]) || '') + '</div>';
          ch += '<div style="font-size:0.68rem;color:var(--txt-d);font-style:italic;margin-top:2px;">→ 答疑请切至【奏疏】或【问对】标签页</div>';
          ch += '</div>';
        });
        html += '<section class="vd-section"><div class="vd-section-title" style="color:var(--amber-400);">侍臣问疑 <span class="vd-badge">' + ac.length + '</span></div>' + ch + '</section>';
      }
    }

    // § 动态机构·制度志
    if (G.dynamicInstitutions && G.dynamicInstitutions.length > 0) {
      var dh = '';
      G.dynamicInstitutions.forEach(function(inst) {
        var stCol = inst.stage === 'abolished' ? 'var(--vermillion-400)' : inst.stage === 'running' ? '#6aa88a' : 'var(--gold)';
        dh += '<div style="padding:5px 8px;background:var(--bg-2);border-left:3px solid ' + stCol + ';margin-bottom:3px;font-size:0.74rem;">';
        dh += '<b style="color:' + stCol + ';">' + _esc(inst.name) + '</b> · 品 ' + inst.rank + ' · ' + _esc(inst.stage) + ' · 员额 ' + (inst.staffSize||0) + ' · 岁支 ' + _fmt(inst.annualBudget||0);
        if (inst.effectiveness !== undefined) dh += '<br><span style="font-size:0.66rem;color:var(--txt-d);">效率 ' + ((inst.effectiveness||0)*100).toFixed(0) + '% · 腐败 ' + Math.round(inst.corruption||0) + '</span>';
        if (inst.stage !== 'abolished') {
          // 废除走诏令
        }
        dh += '</div>';
      });
      html += _sec('动态机构 · 制度志', G.dynamicInstitutions.length + '', dh);
    }

    // § 永制
    if (G._permanentReforms && G._permanentReforms.length > 0) {
      var prh = '';
      G._permanentReforms.forEach(function(r) {
        prh += '<div style="font-size:0.74rem;padding:2px 0;">· <b>' + _esc(r.id) + '</b> 立于 ' + _esc(r.enactedDynasty||'某朝') + ' 第 ' + r.enactedTurn + ' 回合</div>';
        if (r.effects && r.effects.memorialBurdenMult) prh += '<div style="font-size:0.68rem;color:var(--txt-d);padding-left:14px;">奏疏负担 ×' + r.effects.memorialBurdenMult + '</div>';
      });
      html += _sec('永制 · 跨朝遗产', null, prh);
    }

    // § 历代权臣案例（供参考）
    var HC = (typeof global.PhaseG1 !== 'undefined' && global.PhaseG1.HISTORICAL_CASES) || {};
    if (HC.powerMinister && HC.powerMinister.length > 0) {
      var hch = '<div style="max-height:110px;overflow-y:auto;background:var(--bg-2);padding:4px;font-size:0.68rem;">';
      HC.powerMinister.slice(0, 10).forEach(function(c) {
        hch += '<div style="padding:1px 2px;">· <b>' + _esc(c.name) + '</b>（' + _esc(c.dynasty) + ' ' + c.year + '）控 ' + ((c.control||0)*100).toFixed(0) + '% → ' + _esc(c.ending||'') + '</div>';
      });
      hch += '</div>';
      html += _sec('历代权臣 · 鉴往知来', HC.powerMinister.length + '', hch);
    }

    body.innerHTML = html;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  民心抽屉 · 详尽版
  // ═══════════════════════════════════════════════════════════════════

  function renderMinxinPanelRich() {
    var body = document.getElementById('minxin-body');
    var subt = document.getElementById('minxin-subtitle');
    if (!body) return;
    var G = global.GM || {}; var m = G.minxin || {};
    var trueIdx = m.trueIndex || 60;
    var perc = m.perceivedIndex !== undefined ? m.perceivedIndex : trueIdx;
    var phase = m.phase || 'peaceful';
    if (subt) subt.textContent = '真 ' + Math.round(trueIdx) + ' · 视 ' + Math.round(perc) + ' · ' + (MX_PHASE_NAMES[phase]||phase);
    var html = '';
    // 先渲染 action slot（inline 操作面板）
    if (typeof global.__renderDrawerActionSlot === 'function') html += global.__renderDrawerActionSlot('minxin');

    // § 总览
    html += '<section class="vd-section"><div class="vd-overview">';
    var trueCol = trueIdx >= 60 ? '#6aa88a' : trueIdx >= 40 ? 'var(--gold)' : 'var(--vermillion-400)';
    html += '<div class="vd-ov-row"><span class="vd-ov-label">真实民心</span><span class="vd-ov-value" style="color:' + trueCol + ';font-size:1.05rem;font-weight:600;">' + Math.round(trueIdx) + ' / 100</span></div>';
    html += '<div class="vd-ov-row"><span class="vd-ov-label">朝廷视野</span><span class="vd-ov-value">' + Math.round(perc) + '（粉饰 ' + (perc-trueIdx>=0?'+':'') + Math.round(perc-trueIdx) + '）</span></div>';
    html += '<div class="vd-ov-row"><span class="vd-ov-label">段位</span><span class="vd-ov-value" style="color:' + trueCol + ';"><b>' + (MX_PHASE_NAMES[phase]||phase) + '</b></span></div>';
    // 后果传导
    if (G._taxEfficiencyMult !== undefined) html += '<div class="vd-ov-row"><span class="vd-ov-label">征税效率</span><span class="vd-ov-value">' + (G._taxEfficiencyMult*100).toFixed(0) + '%</span></div>';
    if (G._conscriptEffMult !== undefined) html += '<div class="vd-ov-row"><span class="vd-ov-label">征兵效率</span><span class="vd-ov-value">' + (G._conscriptEffMult*100).toFixed(0) + '%</span></div>';
    if (G._reformToleranceMult !== undefined) html += '<div class="vd-ov-row"><span class="vd-ov-label">改革容忍度</span><span class="vd-ov-value">×' + G._reformToleranceMult.toFixed(2) + '</span></div>';
    if (G._scholarRecruitmentMult !== undefined) html += '<div class="vd-ov-row"><span class="vd-ov-label">士人投效</span><span class="vd-ov-value">×' + G._scholarRecruitmentMult.toFixed(2) + '</span></div>';
    html += '</div></section>';

    // § 五级谱
    html += '<section class="vd-section">';
    html += '<div class="vd-section-title">五级谱 <span class="vd-badge">揭/窃/忍/安/颂</span></div>';
    html += '<div style="display:flex;height:16px;border-radius:3px;overflow:hidden;position:relative;">';
    html += '<div style="width:20%;background:var(--vermillion-500);"></div><div style="width:20%;background:var(--vermillion-400);"></div><div style="width:20%;background:var(--amber-400);"></div><div style="width:20%;background:#6aa88a;"></div><div style="width:20%;background:var(--gold);"></div>';
    html += '<div style="position:absolute;top:-2px;left:' + Math.max(0,Math.min(99,trueIdx)) + '%;width:3px;height:20px;background:#fff;box-shadow:0 0 4px #fff;"></div>';
    html += '</div>';
    html += '<div style="display:flex;justify-content:space-between;font-size:0.66rem;color:var(--txt-d);margin-top:2px;"><span>揭竿</span><span>窃盗</span><span>忍耐</span><span>安居</span><span>颂圣</span></div>';
    html += '</section>';

    // § 14 源累积
    if (m.sources) {
      var sh = '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:2px;">';
      Object.keys(MX_SRC_LABELS).forEach(function(k) {
        if (m.sources[k] === undefined) return;
        var v = m.sources[k] || 0;
        var col = v>2?'#6aa88a':v>0?'var(--gold)':v<-2?'var(--vermillion-400)':v<0?'var(--amber-400)':'var(--txt-d)';
        sh += '<div style="display:flex;justify-content:space-between;font-size:0.7rem;padding:2px 4px;background:var(--bg-2);border-radius:2px;">' +
          '<span>' + MX_SRC_LABELS[k] + '</span><span style="color:' + col + ';">' + (v>=0?'+':'') + v.toFixed(1) + '</span></div>';
      });
      sh += '</div>';
      html += _sec('十四源 · 民心所由', '累计', sh);
    }

    // § 分阶层
    if (m.byClass && Object.keys(m.byClass).length > 0) {
      var CLASS_NAMES = {imperial:'皇族',gentry_high:'门阀',gentry_mid:'中小士族',scholar:'寒士',merchant:'商贾',landlord:'地主',peasant_self:'自耕农',peasant_tenant:'佃农',craftsman:'工匠',debased:'贱民',clergy:'僧道',slave:'奴婢'};
      var ch = '';
      Object.keys(m.byClass).forEach(function(cl) {
        var cv = m.byClass[cl]; var col = cv.index >= 60 ? '#6aa88a' : cv.index >= 40 ? 'var(--gold)' : 'var(--vermillion-400)';
        ch += '<div style="display:grid;grid-template-columns:72px 1fr auto;gap:8px;align-items:center;padding:3px 0;font-size:0.74rem;">' +
          '<span style="color:var(--txt-d);">' + _esc(CLASS_NAMES[cl]||cl) + '</span>' +
          _meter(cv.index, 100, col) +
          '<span style="color:' + col + ';">' + Math.round(cv.index) + (cv.trend==='rising'?' ↑':cv.trend==='falling'?' ↓':'') + '</span>' +
        '</div>';
      });
      html += _sec('分阶层 · 阶层民心', Object.keys(m.byClass).length + ' 层', ch);
    }

    // § 分区热力
    if (m.byRegion && Object.keys(m.byRegion).length > 0) {
      var rh = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(85px,1fr));gap:3px;">';
      Object.keys(m.byRegion).slice(0, 40).forEach(function(rid) {
        var r = m.byRegion[rid]; var v = r.index || 60;
        var col = v >= 80 ? '#6aa88a' : v >= 60 ? '#8fbb9e' : v >= 40 ? 'var(--gold)' : v >= 20 ? 'var(--amber-400)' : 'var(--vermillion-400)';
        rh += '<div style="padding:4px 5px;background:' + col + ';border-radius:2px;color:#fff;font-size:0.68rem;">' + _esc(rid).slice(0,6) + ' ' + Math.round(v) + '</div>';
      });
      rh += '</div>';
      html += _sec('天下民情图', Object.keys(m.byRegion).length + ' 区', rh);
    }

    // § 民变 5 级升级链 + 4 干预
    var LEVELS = (typeof global.AuthorityComplete !== 'undefined' && global.AuthorityComplete.REVOLT_LEVELS) || [];
    if (LEVELS.length > 0) {
      var lh = '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:3px;margin-bottom:6px;">';
      LEVELS.forEach(function(lv) {
        var count = (m.revolts||[]).filter(function(r){return r.status==='ongoing' && r.level===lv.id;}).length;
        var act = count > 0 ? 'background:var(--vermillion-400);color:#fff;' : 'background:var(--bg-2);color:var(--txt-d);';
        lh += '<div style="padding:4px;text-align:center;border-radius:2px;font-size:0.66rem;' + act + '">' +
          '<div>' + _esc(lv.name) + '</div>' +
          '<div style="font-size:0.72rem;font-weight:600;">' + count + '</div>' +
        '</div>';
      });
      lh += '</div>';
      // 进行中民变详表 + 4 干预
      var ongoing = (m.revolts||[]).filter(function(r){return r.status==='ongoing';});
      if (ongoing.length > 0) {
        ongoing.forEach(function(r) {
          var lvDef = LEVELS[(r.level||1) - 1] || { name:'L'+r.level };
          lh += '<div style="padding:6px 8px;background:rgba(192,64,48,0.08);border-left:3px solid var(--vermillion-400);border-radius:3px;margin-bottom:4px;font-size:0.74rem;">';
          lh += '<div><b style="color:var(--vermillion-300);">[' + _esc(lvDef.name) + ']</b> ' + _esc(r.region||'某地') + ' · 众 ' + _fmt(r.scale||5000) + (r.cause?' · 因 '+_esc(r.cause):'') + '</div>';
          if (!r._suppressionOrder) {
            // 干预策由大臣奏疏献策，玩家朱批
          } else {
            lh += '<div style="color:var(--amber-400);margin-top:2px;">官军 ' + _fmt(r._suppressionOrder.strength) + ' 讨伐中</div>';
          }
          lh += '</div>';
        });
      }
      html += '<section class="vd-section"><div class="vd-section-title" style="color:var(--vermillion-400);">民变 · 五级升级链 <span class="vd-badge">流言→聚啸→暴动→起义→改朝</span></div>' + lh + '</section>';
    }

    // § 异象三库（天象/祥瑞/谶纬）
    if (G.heavenSigns && G.heavenSigns.length > 0) {
      var recent = G.heavenSigns.filter(function(s){return (G.turn||0) - s.turn < 12;});
      if (recent.length > 0) {
        var sh2 = '';
        recent.slice(-10).forEach(function(s) {
          var col = s.type==='good' ? '#6aa88a' : 'var(--vermillion-400)';
          sh2 += '<div style="font-size:0.72rem;color:' + col + ';padding:1px 0;">' + (s.type==='good'?'🌟':'⚠') + ' [T' + s.turn + '] ' + _esc(s.name) + '</div>';
        });
        html += _sec('近年天象·祥瑞', recent.length + '', sh2);
      }
    }
    // 谶纬库
    if (m.prophecy) {
      var pending = m.prophecy.pendingTriggers || [];
      if (pending.length > 0 || (m.prophecy.intensity||0) > 0.05) {
        var ph = '<div style="font-size:0.72rem;color:var(--txt-d);margin-bottom:3px;">流传强度 <b style="color:var(--amber-400);">' + ((m.prophecy.intensity||0)*100).toFixed(0) + '%</b></div>';
        pending.slice(-6).forEach(function(p) {
          ph += '<div style="font-size:0.72rem;color:var(--amber-400);padding:1px 0;">· "' + _esc(p.text) + '"（信度 ' + ((p.credibility||0.5)*100).toFixed(0) + '%）</div>';
        });
        html += _sec('谶纬·童谣', pending.length + '', ph);
      }
    }

    // § 粉饰文本示例
    var FLAT = (typeof global.PhaseD !== 'undefined' && global.PhaseD.FLATTERY_PHRASES) || [];
    if (G.huangwei && G.huangwei.tyrantSyndrome && G.huangwei.tyrantSyndrome.active && FLAT.length > 0) {
      var fh = '<div style="font-size:0.7rem;color:var(--txt-d);max-height:70px;overflow-y:auto;background:var(--bg-2);padding:4px;font-style:italic;">';
      FLAT.slice(0,5).forEach(function(p) { fh += '<div>· 「' + _esc(p) + '」</div>'; });
      fh += '</div>';
      html += _sec('粉饰辞藻 · 暴君段常见', null, fh);
    }

    // § 风闻录事
    if (G._fengwenRecord && G._fengwenRecord.length > 0) {
      var fh2 = '<div style="max-height:130px;overflow-y:auto;background:var(--bg-2);padding:6px;font-size:0.7rem;border-radius:3px;">';
      G._fengwenRecord.slice(-15).reverse().forEach(function(f) {
        fh2 += '<div style="padding:1px 0;">[' + _esc(f.type) + '·T' + f.turn + '] ' + _esc(f.text) + '</div>';
      });
      fh2 += '</div>';
      html += _sec('风闻录事', '近 15', fh2);
    }

    // § 历代民变案例
    var HC = (typeof global.PhaseG1 !== 'undefined' && global.PhaseG1.HISTORICAL_CASES) || {};
    if (HC.rebellion && HC.rebellion.length > 0) {
      var rch = '<div style="max-height:110px;overflow-y:auto;background:var(--bg-2);padding:4px;font-size:0.68rem;">';
      HC.rebellion.slice(0, 15).forEach(function(c) {
        var col = c.level >= 5 ? 'var(--vermillion-500)' : c.level >= 4 ? 'var(--vermillion-400)' : 'var(--amber-400)';
        rch += '<div style="padding:1px 2px;">· <b style="color:' + col + ';">[L' + c.level + ']</b> <b>' + _esc(c.name) + '</b>（' + _esc(c.dynasty) + ' ' + c.year + '）因 ' + _esc(c.cause||'') + ' → ' + _esc(c.result||'') + '</div>';
      });
      rch += '</div>';
      html += _sec('历代民变 · 鉴古', HC.rebellion.length + '', rch);
    }

    body.innerHTML = html;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  户口抽屉 · 详尽版（补三元、户等、朝代、迁徙、阶层）
  // ═══════════════════════════════════════════════════════════════════

  function renderHukouPanelRich() {
    // 只扩展原 renderHukouPanel 中缺的部分
    if (typeof global.__origRenderHukouPanel === 'function') {
      global.__origRenderHukouPanel();
    }
    // 在原基础上追加新 section（插入到圣裁之前）
    var body = document.getElementById('hukou-body');
    if (!body) return;
    var G = global.GM || {}; var P = G.population || {};
    if (!P.national) return;

    var extraHtml = '';

    // § 迁徙通道（若 PhaseB 有）
    var PATHS = (typeof global.PhaseB !== 'undefined' && global.PhaseB.MIGRATION_PATHWAYS) || {};
    if (Object.keys(PATHS).length > 0) {
      var ph = '';
      Object.keys(PATHS).forEach(function(k) {
        var p = PATHS[k];
        ph += '<div style="font-size:0.72rem;padding:2px 0;">· <b>' + _esc(p.name) + '</b>（' + p.from.join('/') + ' → ' + p.to.join('/') + '，耗×' + p.costFactor + '）</div>';
      });
      extraHtml += _sec('迁徙通道', Object.keys(PATHS).length + ' 道', ph);
    }

    // § 侨置事件
    var QZ = (typeof global.PhaseG2 !== 'undefined' && global.PhaseG2.QIAOZHI_EVENTS) || [];
    if (QZ.length > 0) {
      var qzh = '';
      QZ.forEach(function(q) {
        var done = G._qiaozhiDone && G._qiaozhiDone[q.id];
        qzh += '<div style="font-size:0.72rem;padding:2px 0;color:' + (done?'var(--txt-d)':'var(--gold)') + ';">' + (done?'✓':'○') + ' ' + _esc(q.name) + '（' + q.triggerYear + '，' + _fmt(q.scale) + ' 口）</div>';
      });
      extraHtml += _sec('侨置三大徙', null, qzh);
    }

    // § 疫病谱
    var DISEASES = (typeof global.PhaseB !== 'undefined' && global.PhaseB.DISEASE_PROFILES) || {};
    if (Object.keys(DISEASES).length > 0 && P.dynamics && P.dynamics.plagueEvents && P.dynamics.plagueEvents.length > 0) {
      var dph = '<div style="max-height:90px;overflow-y:auto;background:var(--bg-2);padding:4px;font-size:0.7rem;">';
      P.dynamics.plagueEvents.slice(-8).forEach(function(e) {
        var profile = DISEASES[e.disease] || {};
        var col = e.status === 'active' ? 'var(--vermillion-400)' : 'var(--txt-d)';
        dph += '<div style="color:' + col + ';padding:1px 0;">· ' + _esc(profile.name||e.disease) + ' · ' + _esc(e.region||'某地') + ' · 染 ' + _fmt(e.affected||0) + ' · 殁 ' + _fmt(e.deaths||0) + (e.status==='active'?' · 行中':'') + '</div>';
      });
      dph += '</div>';
      extraHtml += _sec('疫病谱', '五种', dph);
    }

    // § 税基流失四手法
    if (P.taxEvasion && P.taxEvasion.methods) {
      var eh = '<div style="font-size:0.72rem;color:var(--txt-d);margin-bottom:3px;">总逃避率 <b style="color:var(--vermillion-400);">' + ((P.taxEvasion.totalRate||0)*100).toFixed(1) + '%</b></div>';
      P.taxEvasion.methods.forEach(function(m) {
        eh += '<div style="font-size:0.7rem;padding:1px 0;">· ' + _esc(m.name) + '：' + ((m.rate||0)*100).toFixed(2) + '%</div>';
      });
      extraHtml += _sec('税基流失四手法', null, eh);
    }

    // § 婚育习俗
    if (P.marriageCulture) {
      var mc = P.marriageCulture;
      var mch = '<div style="font-size:0.72rem;">';
      mch += '<div>· 溺女率 <b>' + ((mc.femaleInfanticideRate||0)*100).toFixed(2) + '%</b></div>';
      mch += '<div>· 寡妇再嫁率 <b>' + ((mc.widowRemarriageRate||0)*100).toFixed(0) + '%</b></div>';
      mch += '<div>· 汉胡通婚 <b>' + ((mc.hanOtherIntermarriage||0)*100).toFixed(1) + '%</b></div>';
      mch += '</div>';
      extraHtml += _sec('婚育习俗', null, mch);
    }

    // § 少数民族动态
    if (P.ethnicDynamics) {
      var ed = P.ethnicDynamics;
      var eth = '<div style="font-size:0.72rem;">';
      eth += '<div>· 汉化速率 ' + ((ed.sinicizationRate||0)*100).toFixed(2) + '%/年</div>';
      eth += '<div>· 叛乱风险 <b style="color:' + ((ed.rebellionRisk||0)>0.08?'var(--vermillion-400)':'var(--txt)') + ';">' + ((ed.rebellionRisk||0)*100).toFixed(1) + '%</b></div>';
      eth += '<div>· 羁縻忠诚 ' + ((ed.jimiLoyalty||0.7)*100).toFixed(0) + '%</div>';
      eth += '</div>';
      extraHtml += _sec('少数民族动态', null, eth);
    }

    // § 路引制度
    if (P.travelDocs) {
      var td = P.travelDocs;
      extraHtml += _sec('路引制度', null, '<div style="font-size:0.72rem;">· 需要：' + (td.required?'是':'否') + ' · 严格度 <b>' + ((td.strictness||0)*100).toFixed(0) + '%</b> · 违者 ' + _fmt(td.violations||0) + '</div>');
    }

    // § 阶层流动路径
    var MOB = [];
    try { if (typeof global.HujiDeepFill !== 'undefined' && global.HujiDeepFill.CLASS_MOBILITY_PATHS) MOB = global.HujiDeepFill.CLASS_MOBILITY_PATHS; } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-var-drawers-ext');}catch(_){}}
    if (MOB.length > 0) {
      var mh2 = '';
      MOB.slice(0, 7).forEach(function(p) {
        mh2 += '<div style="font-size:0.7rem;padding:1px 0;">· ' + _esc(p.name||p.id) + (p.rate?'（' + (p.rate*100).toFixed(2) + '%/年）':'') + '</div>';
      });
      extraHtml += _sec('阶层流动七路径', null, mh2);
    }

    // § 户口衰落信号
    if (G._initialPopulation && G._initialPopulation.mouths) {
      var ratio = (P.national.mouths||0) / G._initialPopulation.mouths;
      var col = ratio < 0.5 ? 'var(--vermillion-500)' : ratio < 0.7 ? 'var(--amber-400)' : '#6aa88a';
      extraHtml += _sec('户口消长', null, '<div style="font-size:0.74rem;">· 较开局 <b style="color:' + col + ';">' + (ratio*100).toFixed(0) + '%</b>' + (ratio<0.5?' ⚠ 衰亡之兆':'') + '</div>');
    }

    // 把 extraHtml 追加进 body 的"圣裁"之前
    var curr = body.innerHTML;
    var idx = curr.lastIndexOf('<section class="vd-section"><div class="vd-section-title">圣裁');
    if (idx > 0 && extraHtml) {
      body.innerHTML = curr.slice(0, idx) + extraHtml + curr.slice(idx);
    } else if (extraHtml) {
      body.innerHTML = curr + extraHtml;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  挂载覆盖
  // ═══════════════════════════════════════════════════════════════════

  function _install() {
    if (typeof global.renderHukouPanel === 'function') {
      global.__origRenderHukouPanel = global.renderHukouPanel;
      global.renderHukouPanel = renderHukouPanelRich;
    }
    global.renderMinxinPanel = renderMinxinPanelRich;
    global.renderHuangquanPanel = renderHuangquanPanelRich;
    global.renderHuangweiPanel = renderHuangweiPanelRich;
  }

  // 立即安装（旧版 setTimeout 200ms 已移除 — 2026-04-24 · 加载顺序保证 v1 已定义基础 render）
  _install();

  global.VarDrawersExt = {
    install: _install,
    renderHuangweiPanelRich: renderHuangweiPanelRich,
    renderHuangquanPanelRich: renderHuangquanPanelRich,
    renderMinxinPanelRich: renderMinxinPanelRich,
    renderHukouPanelRich: renderHukouPanelRich,
    VERSION: 1
  };

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
