/**
 * tm-var-drawers-final.js — 抽屉最终补齐
 *
 * 为 7 个抽屉 renderXxxPanel 追加所有方案应展示但尚缺的内容。
 * 保证"C:\\Users\\37814\\Desktop\\工作方案"下每一份设计方案的可展示/可操作
 * 内容都落在某个抽屉内。
 *
 * 覆盖方式：wrap 原 render，在其完成后 append 额外 section 到 body。
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
  function _appendToBody(bodyId, html) {
    var body = document.getElementById(bodyId);
    if (!body || !html) return;
    // 插到圣裁/紧急措施之前
    var curr = body.innerHTML;
    var idx = curr.search(/<section class="vd-section"><div class="vd-section-title">(?:圣裁|紧急措施|铸币之政|财政改革)/);
    if (idx > 0) body.innerHTML = curr.slice(0, idx) + html + curr.slice(idx);
    else body.innerHTML = curr + html;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  帑廪补齐：纸币25/监察/破产7步/漏损三角/封建5类/19税种
  // ═══════════════════════════════════════════════════════════════════

  function _extraForGuoku() {
    var G = global.GM || {}; var g = G.guoku || {}; var html = '';

    // § 19 原子税种（补 11 新）
    if (G.fiscalConfig && G.fiscalConfig.taxes) {
      var taxes = G.fiscalConfig.taxes;
      var extras = ['shangshui','chashui','jiushui','tieshui','tongshui','yongshou','diaoshou','suanmin','imperialEstate','shuimoShui','zajuan'];
      var active = extras.filter(function(k){return taxes[k] && taxes[k].enabled;});
      if (active.length > 0) {
        var th = '';
        active.forEach(function(k) {
          var t = taxes[k];
          th += '<div style="font-size:0.72rem;padding:1px 0;">· <b>' + _esc(t.name) + '</b>（' + _esc(t.base||'') + '，率 ' + ((t.rate||0)*100).toFixed(1) + '%）</div>';
        });
        html += _sec('十九原子税种 · 补启', active.length + ' 启', th);
      }
    }

    // § 纸币 25 预设状态
    if (G.currency && G.currency.coins && G.currency.coins.paper) {
      var pp = G.currency.coins.paper;
      if (pp.enabled) {
        var PRESETS = (typeof global.PhaseH !== 'undefined' && global.PhaseH.PAPER_DATA_25) || [];
        var current = PRESETS.find(function(p){return p.id === pp.activePreset;});
        var ph = '<div style="padding:6px 8px;background:var(--bg-2);border-left:3px solid var(--gold);border-radius:3px;font-size:0.76rem;">';
        if (current) {
          ph += '<div><b>' + _esc(current.name) + '</b>（' + current.dynasty + ' ' + current.startYear + '-' + current.endYear + '）</div>';
        }
        var stCol = pp.state==='collapse'?'var(--vermillion-500)':pp.state==='depreciate'?'var(--amber-400)':'#6aa88a';
        ph += '<div>状态 <span style="color:' + stCol + ';">' + _esc(pp.state||'—') + '</span> · 信用 ' + ((pp.trust||1)*100).toFixed(0) + '%</div>';
        if (pp.cumulativeInflation !== undefined) ph += '<div>累积通胀 <span style="color:var(--amber-400);">' + ((pp.cumulativeInflation||0)*100).toFixed(0) + '%</span></div>';
        if (pp.issuedAmount !== undefined) ph += '<div>发行量 ' + _fmt(pp.issuedAmount) + ' · 储备率 ' + ((pp.reserveRatio||0.3)*100).toFixed(0) + '%</div>';
        ph += '</div>';
        // 25 预设名录
        if (PRESETS.length > 0) {
          ph += '<details style="margin-top:4px;font-size:0.7rem;"><summary style="cursor:pointer;color:var(--txt-d);">25 条历代纸币预设</summary><div style="background:var(--bg-2);padding:4px;max-height:120px;overflow-y:auto;">';
          PRESETS.forEach(function(p) {
            var active = p.id === pp.activePreset;
            ph += '<div style="padding:1px 0;' + (active?'color:var(--gold);font-weight:600;':'color:var(--txt-d);') + '">· ' + _esc(p.name) + '（' + p.dynasty + ' ' + p.startYear + '-' + p.endYear + ' · ' + p.state + '）</div>';
          });
          ph += '</div></details>';
        }
        html += _sec('纸币·六态生命周期', null, ph);
      }
    }

    // § 海外银流（完整）
    if (G.currency && G.currency.foreignFlow && ((G.currency.foreignFlow.annualInflow||0)>0 || (G.currency.foreignFlow.annualOutflow||0)>0)) {
      var ff = G.currency.foreignFlow;
      var fh = '<div style="font-size:0.74rem;">';
      fh += '<div>· 年度流入 <span style="color:#6aa88a;">' + _fmt(ff.annualInflow||0) + '</span> 两</div>';
      fh += '<div>· 年度流出 <span style="color:var(--vermillion-400);">' + _fmt(ff.annualOutflow||0) + '</span> 两</div>';
      if (ff.sources) { fh += '<div style="color:var(--txt-d);margin-top:3px;">源：'; Object.keys(ff.sources).forEach(function(k){fh += _esc(k)+' '+_fmt(ff.sources[k])+' · ';}); fh += '</div>'; }
      if (ff.sinks) { fh += '<div style="color:var(--txt-d);">汇：'; Object.keys(ff.sinks).forEach(function(k){fh += _esc(k)+' '+_fmt(ff.sinks[k])+' · ';}); fh += '</div>'; }
      fh += '</div>';
      html += _sec('海外银流', ff.tradeMode||'', fh);
    }

    // § 央地分账 3 模式
    var preset = G.fiscalConfig && G.fiscalConfig.centralLocalRules && G.fiscalConfig.centralLocalRules.preset;
    if (G.fiscal && G.fiscal.regions) {
      var rids = Object.keys(G.fiscal.regions);
      var clh = '<div style="font-size:0.74rem;">';
      clh += '<div>· 当前预设：<b>' + _esc(preset||'qiyun_cunliu') + '</b></div>';
      var modeName = {tang_three:'唐三分（州留/道留/中央）',qiyun_cunliu:'明清起运存留',song_cash:'宋钱入中央',custom:'自定'}[preset||'qiyun_cunliu'];
      clh += '<div style="color:var(--txt-d);">' + _esc(modeName||'') + '</div>';
      // 表头
      clh += '<table style="width:100%;margin-top:4px;font-size:0.68rem;"><tr style="color:var(--gold-500);"><td>省</td><td>名义</td><td>实征</td><td>留存</td><td>起运</td><td>合规</td></tr>';
      rids.slice(0, 15).forEach(function(rid) {
        var r = G.fiscal.regions[rid];
        clh += '<tr><td>' + _esc(rid) + '</td>';
        clh += '<td>' + _fmt(r.claimedRevenue||0) + '</td>';
        clh += '<td>' + _fmt(r.actualRevenue||0) + '</td>';
        clh += '<td>' + _fmt(r.retainedBudget||0) + '</td>';
        clh += '<td>' + _fmt(r.remittedToCenter||0) + '</td>';
        clh += '<td>' + ((r.compliance||0.7)*100).toFixed(0) + '%</td></tr>';
      });
      clh += '</table>';
      clh += '</div>';
      html += _sec('央地分账', rids.length + ' 区', clh);
    }

    // § 五封建财政
    if (G.feudalHoldings && G.feudalHoldings.length > 0) {
      var fth = '';
      var TYPES = (typeof global.PhaseH !== 'undefined' && global.PhaseH.FEUDAL_HOLDING_TYPES) || {};
      G.feudalHoldings.forEach(function(fh2) {
        var rule = TYPES[fh2.type] || {};
        var col = fh2.loyalty < 0.3 ? 'var(--vermillion-400)' : fh2.loyalty < 0.6 ? 'var(--amber-400)' : '#6aa88a';
        fth += '<div style="padding:4px 6px;background:var(--bg-2);border-left:3px solid ' + col + ';margin-bottom:3px;font-size:0.72rem;">';
        fth += '<b>' + _esc(fh2.name) + '</b>（' + _esc(fh2.type) + ' · ' + _esc(rule.description||'') + '）· 忠 ' + ((fh2.loyalty||0.5)*100).toFixed(0) + '%';
        if (fh2.tribute && fh2.tribute.annual) fth += ' · 年贡 ' + _fmt(fh2.tribute.annual);
        fth += '</div>';
      });
      html += _sec('五类封建', G.feudalHoldings.length + ' 处', fth);
    }

    // § 破产 7 步
    if (G._bankruptcyState && G._bankruptcyState.activatedStep > 0) {
      var BS = (typeof global.PhaseF2 !== 'undefined' && global.PhaseF2.BANKRUPTCY_STEPS) || [];
      var bh = '<div style="font-size:0.74rem;">';
      BS.forEach(function(step, i) {
        var done = (i+1) <= G._bankruptcyState.activatedStep;
        var col = done ? 'var(--vermillion-400)' : 'var(--txt-d)';
        bh += '<div style="padding:2px 4px;color:' + col + ';">' + (done?'▣':'☐') + ' ' + step.id + '. ' + _esc(step.name) + '</div>';
      });
      bh += '</div>';
      html += _sec('破产七步', '阶段 ' + G._bankruptcyState.activatedStep + '/7', bh);
    }

    // § 漏损三角
    if (G._leakageState && G._leakageState.loss > 0) {
      var lh = '<div style="padding:6px 8px;background:rgba(192,64,48,0.08);border-left:3px solid var(--vermillion-400);border-radius:3px;font-size:0.74rem;">';
      lh += '<div>段位：<b>' + _esc(G._leakageState.phase) + '</b></div>';
      var phaseDesc = G._leakageState.phase==='majesty'?'威严段抑腐（低漏）':G._leakageState.phase==='tyrant'?'暴君段隐账（虚高账面）':G._leakageState.phase==='lost'?'失威段公开漏':G._leakageState.phase==='decline'?'衰微段贪漏':'常望段中漏';
      lh += '<div style="color:var(--txt-d);font-size:0.7rem;">' + phaseDesc + '</div>';
      lh += '<div>漏损率 <b style="color:var(--vermillion-400);">' + ((G._leakageState.rate||0)*100).toFixed(2) + '%</b></div>';
      lh += '<div>本月漏 <b style="color:var(--vermillion-400);">' + _fmt(G._leakageState.loss) + '</b> 钱</div>';
      lh += '</div>';
      html += _sec('漏损三角 · 腐败×皇威×帑廪', null, lh);
    }

    // § 监察预算+覆盖率
    if (G.auditSystem) {
      var ash = '<div style="font-size:0.74rem;">';
      ash += '<div>· 御史可用 ' + (G.auditSystem.inspectorsAvailable||0) + ' / 已查 ' + (G.auditSystem.totalAuditsCompleted||0) + ' 次</div>';
      ash += '<div>· 监察强度 <b>' + ((G.auditSystem.strength||0)*100).toFixed(0) + '%</b></div>';
      if (G.auditSystem.annualBudget) ash += '<div>· 年度预算 ' + _fmt(G.auditSystem.annualBudget) + ' · 已用 ' + _fmt(G.auditSystem.consumed||0) + '</div>';
      if (G.auditSystem.coverage) ash += '<div>· 覆盖率 ' + ((G.auditSystem.coverage||0)*100).toFixed(0) + '%（预算/需求）</div>';
      ash += '</div>';
      html += _sec('监察预算·覆盖', null, ash);
    }

    // § 事件钩子近触
    var recentEvents = [];
    if (G.guoku && G.guoku.money < 0) recentEvents.push('帑廪告罄');
    if (G._bankruptcyState && G._bankruptcyState.activatedStep > 0) recentEvents.push('破产触发');
    if (G.currency && G.currency.market && Math.abs(G.currency.market.inflation||0) > 0.15) recentEvents.push('通胀猛涨');
    if (G.fiscal && G.fiscal.regions) {
      var def = Object.keys(G.fiscal.regions).filter(function(rid){return G.fiscal.regions[rid].compliance < 0.3;}).length;
      if (def > 0) recentEvents.push('藩镇抗命 ' + def + ' 处');
    }
    if (G.landAnnexation && G.landAnnexation.concentration > 0.7) recentEvents.push('兼并危机');
    if (recentEvents.length > 0) {
      html += _sec('事件钩子 · 近触', recentEvents.length + '', '<div style="font-size:0.72rem;color:var(--amber-400);">' + recentEvents.map(function(e){return '· '+e;}).join('<br>') + '</div>');
    }

    _appendToBody('guoku-body', html);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  内帑补齐
  // ═══════════════════════════════════════════════════════════════════

  function _extraForNeitang() {
    var G = global.GM || {}; var n = G.neitang || {}; var html = '';
    // 宗室压力
    if (n.rules && n.rules.royalClanPressure) {
      var rcp = n.rules.royalClanPressure;
      html += _sec('宗室压力', null, '<div style="font-size:0.74rem;">' +
        '<div>· 宗室人数 ' + _fmt(rcp.clanSize||0) + '</div>' +
        '<div>· 月供 ' + _fmt(n.clanMonthlyCost||0) + ' 两</div>' +
      '</div>');
    }
    // 皇威×内帑大典
    if (n.recentCeremonies && n.recentCeremonies.length > 0) {
      var ch = '';
      n.recentCeremonies.slice(-5).forEach(function(c) {
        ch += '<div style="font-size:0.72rem;">· ' + _esc(c.name||'大典') + '（T' + (c.turn||0) + '）费 ' + _fmt(c.cost||0) + '</div>';
      });
      html += _sec('近岁大典', n.recentCeremonies.length + '', ch);
    }
    // 内帑×皇威联动提示
    if (G.huangwei) {
      html += _sec('内帑×皇威联动', null, '<div style="font-size:0.72rem;color:var(--txt-d);">· 大典由内帑出资，皇威 +20（礼）/+10（祭）/+5（宴）<br>· 奢侈消费过度 → 民心降 · 皇威加速消耗</div>');
    }
    // 内帑×皇权
    if (G.huangquan) {
      var hq = G.huangquan.index || 55;
      var note = hq < 35 ? '权臣段：外戚/宦官侵占 +30%' : hq > 70 ? '专制段：内帑独立性强' : '制衡段：正常';
      html += _sec('内帑×皇权联动', null, '<div style="font-size:0.72rem;color:var(--txt-d);">' + note + '</div>');
    }
    _appendToBody('neitang-body', html);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  户口补齐：五字段/10徭役/25预设/军种/将领/边防/年龄层/男女比/京畿虹吸
  // ═══════════════════════════════════════════════════════════════════

  function _extraForHukou() {
    var G = global.GM || {}; var P = G.population || {}; var html = '';
    if (!P.national) { _appendToBody('hukou-body', ''); return; }

    // § region 五字段（挑一个具代表性的 region）
    if (P.byRegion && Object.keys(P.byRegion).length > 0) {
      var firstRid = Object.keys(P.byRegion)[0];
      var r = P.byRegion[firstRid];
      if (r && r.bySettlement) {
        var rh = '<div style="font-size:0.72rem;color:var(--txt-d);margin-bottom:4px;">示：' + _esc(firstRid) + '</div>';
        // bySettlement
        rh += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:3px;margin-bottom:4px;font-size:0.7rem;">';
        ['fang','shi','zhen','cun'].forEach(function(k) {
          var s = r.bySettlement[k];
          if (s) rh += '<div style="padding:3px;background:var(--bg-2);text-align:center;">' + ({fang:'坊',shi:'市',zhen:'镇',cun:'村'}[k]) + ' ' + _fmt(s.mouths||0) + '</div>';
        });
        rh += '</div>';
        // byGender
        if (r.byGender) rh += '<div style="font-size:0.7rem;">· 男女比 ' + (r.byGender.sexRatio||1.04).toFixed(2) + '（男 ' + _fmt(r.byGender.male||0) + ' / 女 ' + _fmt(r.byGender.female||0) + '）</div>';
        // byAge.decade
        if (r.byAge && r.byAge.decade) {
          rh += '<div style="font-size:0.7rem;margin-top:3px;color:var(--txt-d);">年龄金字塔：</div>';
          rh += '<div style="display:grid;grid-template-columns:repeat(9,1fr);gap:2px;font-size:0.66rem;">';
          ['0-9','10-19','20-29','30-39','40-49','50-59','60-69','70-79','80+'].forEach(function(k) {
            rh += '<div style="padding:2px;background:var(--bg-2);text-align:center;">' + k + '<br>' + _fmt(r.byAge.decade[k]||0) + '</div>';
          });
          rh += '</div>';
        }
        // byEthnicity
        if (r.byEthnicity) {
          var eh = '<div style="font-size:0.7rem;margin-top:3px;">族群：';
          Object.keys(r.byEthnicity).forEach(function(k){ eh += _esc(k) + ' ' + ((r.byEthnicity[k]||0)*100).toFixed(0) + '% · '; });
          eh += '</div>';
          rh += eh;
        }
        // byFaith
        if (r.byFaith) {
          var fh = '<div style="font-size:0.7rem;">信仰：';
          Object.keys(r.byFaith).forEach(function(k){ if ((r.byFaith[k]||0)>0.01) fh += _esc(k) + ' ' + ((r.byFaith[k]||0)*100).toFixed(0) + '% · '; });
          fh += '</div>';
          rh += fh;
        }
        html += _sec('region 五字段（示一区）', null, rh);
      }
    }

    // § 10 类徭役详表
    var CV = [];
    try { if (typeof global.HujiEngine !== 'undefined' && global.HujiEngine.CORVEE_TYPES) CV = Object.keys(global.HujiEngine.CORVEE_TYPES).map(function(k){var t=global.HujiEngine.CORVEE_TYPES[k];t.key=k;return t;}); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-var-drawers-final');}catch(_){}}
    if (CV.length === 0) {
      // 尝试从 GM 读
      if (P.corvee && P.corvee.byType) CV = Object.keys(P.corvee.byType).map(function(k){return Object.assign({key:k},P.corvee.byType[k]);});
    }
    if (CV.length > 0) {
      var ch = '<div style="max-height:140px;overflow-y:auto;background:var(--bg-2);padding:4px;font-size:0.7rem;">';
      CV.slice(0, 10).forEach(function(t) {
        ch += '<div style="padding:1px 2px;">· <b>' + _esc(t.name||t.key) + '</b>' + (t.daysPerDing?'（丁年 ' + t.daysPerDing + ' 日）':'') + (t.deathRate?'，殁率 ' + ((t.deathRate||0)*100).toFixed(1) + '%':'') + '</div>';
      });
      ch += '</div>';
      html += _sec('十徭役分类', CV.length + '', ch);
    }

    // § 25 大徭役预设
    var GC = [];
    try {
      if (typeof global.HistoricalPresets !== 'undefined') {
        GC = (typeof global.HistoricalPresets.getGreatCorveeProjects === 'function')
          ? global.HistoricalPresets.getGreatCorveeProjects()
          : (global.HistoricalPresets.GREAT_CORVEE_PROJECTS || []);
      }
    } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-var-drawers-final');}catch(_){}}
    if (GC.length > 0) {
      var gch = '<details><summary style="cursor:pointer;font-size:0.72rem;color:var(--gold);">展 ' + GC.length + ' 大徭役历代预设</summary><div style="max-height:150px;overflow-y:auto;background:var(--bg-2);padding:4px;font-size:0.68rem;margin-top:4px;">';
      GC.forEach(function(p) {
        gch += '<div style="padding:1px 2px;">· <b>' + _esc(p.name||p.id) + '</b>（' + _esc(p.dynasty||'') + (p.year?' '+p.year:'') + '）' + (p.labor?' 丁 ' + _fmt(p.labor):'') + (p.deathRate?' 殁 ' + ((p.deathRate||0)*100).toFixed(0) + '%':'') + '</div>';
      });
      gch += '</div></details>';
      html += _sec('历代大徭役预设', GC.length + '', gch);
    }

    // § 6 军种详表
    var BRANCHES = (typeof global.PhaseB !== 'undefined' && global.PhaseB.MILITARY_BRANCHES) || {};
    if (Object.keys(BRANCHES).length > 0) {
      var bh = '';
      Object.keys(BRANCHES).forEach(function(k) {
        var b = BRANCHES[k];
        bh += '<div style="font-size:0.7rem;padding:1px 0;">· <b>' + _esc(b.name) + '</b>：基费 ' + b.baseCost + ' · 粮 ' + b.grainPerSoldier + '/卒 · 战力 ×' + b.effectivenessCoef + (b.requiresHorses?' · 需马':'') + '</div>';
      });
      html += _sec('军种 · 六分', Object.keys(BRANCHES).length + '', bh);
    }

    // § 3 军粮供应
    var SUPPLY = (typeof global.PhaseG2 !== 'undefined' && global.PhaseG2.SUPPLY_MODES) || (typeof global.PhaseB !== 'undefined' && global.PhaseB.MILITARY_SUPPLY_MODES) || {};
    if (Object.keys(SUPPLY).length > 0) {
      var sh = '';
      Object.keys(SUPPLY).forEach(function(k) {
        var s = SUPPLY[k];
        sh += '<div style="font-size:0.7rem;padding:1px 0;">· <b>' + _esc(s.name) + '</b> 自给 ' + ((s.selfRatio||0)*100).toFixed(0) + '% · 国家 ' + ((s.stateLoad||0)*100).toFixed(0) + '%' + (s.description?' ('+_esc(s.description)+')':'') + '</div>';
      });
      html += _sec('军粮·三供', null, sh);
    }

    // § 4 将领出身
    var LB = (typeof global.PhaseG2 !== 'undefined' && global.PhaseG2.LEADER_BACKGROUND_BONUSES) || {};
    if (Object.keys(LB).length > 0) {
      var lh = '';
      Object.keys(LB).forEach(function(k) {
        var l = LB[k];
        lh += '<div style="font-size:0.7rem;padding:1px 0;">· <b>' + _esc(l.description) + '</b>：统兵 ' + (l.commandBonus>=0?'+':'') + l.commandBonus + ' · 忠 ' + (l.loyaltyToEmperor>=0?'+':'') + l.loyaltyToEmperor + ' · 野心 ' + (l.ambitionTendency>=0?'+':'') + l.ambitionTendency + '</div>';
      });
      html += _sec('将领·四出身', null, lh);
    }

    // § 5 边防区
    var FZ = (typeof global.PhaseG2 !== 'undefined' && global.PhaseG2.FRONTIER_ZONES) || {};
    if (Object.keys(FZ).length > 0) {
      var fzh = '';
      Object.keys(FZ).forEach(function(k) {
        var z = FZ[k];
        fzh += '<div style="font-size:0.7rem;padding:1px 0;">· <b>' + _esc({north:'北疆',northeast:'东北',northwest:'西北',southwest:'西南',southeast:'东南'}[k]||k) + '</b>：' + _esc(z.description||'') + '（主 ' + _esc(z.focus||'') + '）</div>';
      });
      html += _sec('边防·五大区', null, fzh);
    }

    // § 阶层流动 7 路径
    var CMP = [];
    try { if (typeof global.HujiDeepFill !== 'undefined' && global.HujiDeepFill.CLASS_MOBILITY_PATHS) CMP = global.HujiDeepFill.CLASS_MOBILITY_PATHS; } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-var-drawers-final');}catch(_){}}
    if (CMP.length > 0) {
      var ph = '';
      CMP.forEach(function(p) {
        ph += '<div style="font-size:0.7rem;padding:1px 0;">· <b>' + _esc(p.name||p.id) + '</b>' + (p.from?'：' + _esc(p.from) + ' → ' + _esc(p.to||''):'') + (p.rate?' · ' + (p.rate*100).toFixed(2) + '%/年':'') + '</div>';
      });
      html += _sec('阶层流动 · 七路', CMP.length + '', ph);
    }

    // § 京畿虹吸四因子
    if (G._capital && typeof global.PhaseB !== 'undefined' && global.PhaseB.computeCapitalSiphon) {
      var si = global.PhaseB.computeCapitalSiphon(G);
      if (si.total > 0) {
        var sih = '<div style="font-size:0.72rem;">';
        sih += '<div>· 科举汲引 <b>' + _fmt(si.keju||0) + '</b></div>';
        sih += '<div>· 贵族消费 <b>' + _fmt(si.nobility||0) + '</b></div>';
        sih += '<div>· 商业辐射 <b>' + _fmt(si.commerce||0) + '</b></div>';
        sih += '<div>· 官员员额 <b>' + _fmt(si.officials||0) + '</b></div>';
        sih += '<div style="margin-top:3px;">合计年吸 <b style="color:var(--gold);">' + _fmt(si.total) + '</b> 口 → ' + _esc(G._capital) + '</div>';
        sih += '</div>';
        html += _sec('京畿虹吸 · 四因子', null, sih);
      }
    }

    // § 120 色职业户籍（简略）
    if (P.byCategory) {
      var cats = Object.keys(P.byCategory);
      if (cats.length > 15) {
        html += _sec('扩展色目户籍', cats.length + ' 色', '<div style="font-size:0.7rem;color:var(--txt-d);">职业户籍扩展至 ' + cats.length + ' 色（含灶户/驿户/匠户/乐户等）</div>');
      }
    }

    _appendToBody('hukou-body', html);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  吏治补齐：9源详细/腐败集团/三模式
  // ═══════════════════════════════════════════════════════════════════

  function _extraForLizhi() {
    var G = global.GM || {}; var c = G.corruption || {}; var html = '';

    // § 9 源累积（完整 label）
    var SRC_LBL = {
      lowSalary:'俸薄',laxSupervision:'监弛',emergencyLevy:'急征',
      officeSelling:'鬻官',nepotism:'荐幸',innerCircle:'宠信',
      redundancy:'冗员',institutional:'制弊',lumpSumSpending:'巨支'
    };
    if (c.sources) {
      var sh = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:2px;">';
      Object.keys(SRC_LBL).forEach(function(k) {
        var v = c.sources[k] || 0;
        var col = v>5?'var(--vermillion-400)':v>1?'var(--amber-400)':'var(--txt-d)';
        sh += '<div style="padding:3px 5px;background:var(--bg-2);font-size:0.7rem;">' +
          '<div>' + SRC_LBL[k] + '</div>' +
          '<div style="color:' + col + ';font-weight:600;">' + v.toFixed(1) + '</div>' +
        '</div>';
      });
      sh += '</div>';
      html += _sec('九源 · 腐浊所由', null, sh);
    }

    // § 腐败集团凝聚
    if (G._corruptionCartel && G._corruptionCartel.formed) {
      var cch = '<div style="padding:8px;background:rgba(192,64,48,0.08);border-left:3px solid var(--vermillion-500);border-radius:3px;font-size:0.76rem;">';
      cch += '<div>立于 T' + (G._corruptionCartel.formedTurn||0) + ' · 凝聚度 <b>' + ((G._corruptionCartel.cohesion||0)*100).toFixed(0) + '%</b></div>';
      cch += '<div>成员 ' + (G._corruptionCartel.members||[]).length + ' · 反腐抗性 <b>' + ((G._corruptionCartel.resistance||0)*100).toFixed(0) + '%</b></div>';
      if (G._corruptionCartel.members && G._corruptionCartel.members.length > 0) {
        cch += '<div style="color:var(--txt-d);font-size:0.7rem;margin-top:3px;">核心：' + G._corruptionCartel.members.slice(0, 6).map(function(n){return _esc(n);}).join('、') + '</div>';
      }
      cch += '</div>';
      html += _sec('官僚集团 · 凝聚', '腐败>70 触发', cch);
    }

    // § 巨额预警
    if (G._lumpSumWarnings && G._lumpSumWarnings.length > 0) {
      var pending = G._lumpSumWarnings.filter(function(w){return w.status==='pending';});
      if (pending.length > 0) {
        var wh = '';
        pending.slice(-5).forEach(function(w) {
          var col = w.level === 'critical' ? 'var(--vermillion-400)' : 'var(--amber-400)';
          wh += '<div style="padding:5px 8px;background:var(--bg-2);border-left:3px solid ' + col + ';margin-bottom:3px;font-size:0.72rem;">';
          wh += '<div style="color:' + col + ';">' + _esc(w.drafter||'户部') + ' · T' + (w.turn||0) + '</div>';
          wh += '<div>' + _esc(w.content||'') + '</div>';
          wh += '</div>';
        });
        html += _sec('户部劝谏 · 巨额支出', pending.length + '', wh);
      }
    }

    // § 三模式（演义/史实/严格）
    var MODE = (typeof global.PhaseF4 !== 'undefined' && global.PhaseF4.getCurrentCorruptionMode) ? global.PhaseF4.getCurrentCorruptionMode() : null;
    if (MODE) {
      var mh = '<div style="padding:6px 8px;background:var(--bg-2);border-radius:3px;font-size:0.74rem;">';
      mh += '<div>当前模式：<b>' + _esc(MODE.name) + '</b></div>';
      mh += '<div style="color:var(--txt-d);">' + _esc(MODE.description||'') + '</div>';
      mh += '<div style="margin-top:3px;">贪腐可见 <b>' + ((MODE.corruptionVisibility||0)*100).toFixed(0) + '%</b> · 标注 ' + (MODE.memorialFlaggingEnabled?'启':'关') + '</div>';
      mh += '</div>';
      html += _sec('游戏模式 · 贪腐提示', null, mh);
    }

    // § 监察活动列表
    if (G.auditSystem && G.auditSystem.activeAudits) {
      var active = G.auditSystem.activeAudits.filter(function(a){return a.status==='in_progress';});
      var completed = G.auditSystem.activeAudits.filter(function(a){return a.status==='completed' && a.found;});
      if (active.length + completed.length > 0) {
        var ah = '';
        active.forEach(function(a) {
          ah += '<div style="font-size:0.72rem;padding:2px 0;color:var(--amber-400);">▶ ' + _esc(a.region) + '（' + _esc(a.intensity) + '）· 归 T' + a.expectedReturnTurn + '</div>';
        });
        completed.slice(-5).forEach(function(a) {
          ah += '<div style="font-size:0.72rem;padding:2px 0;color:var(--vermillion-300);">⚠ ' + _esc(a.region) + ' · 查实舞弊</div>';
        });
        html += _sec('监察中/已曝', (active.length + completed.length) + '', ah);
      }
    }

    _appendToBody('lizhi-body', html);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  民心补齐：9 旧分类映射 / 异象三库按类
  // ═══════════════════════════════════════════════════════════════════

  function _extraForMinxin() {
    var G = global.GM || {}; var m = G.minxin || {}; var html = '';

    // § 9 旧分类映射
    var MAP = (typeof global.PhaseF4 !== 'undefined' && global.PhaseF4.OLD_TO_NEW_CLASS_MAP) || {};
    if (Object.keys(MAP).length > 0 && m.byClass && typeof global.PhaseF4 !== 'undefined' && global.PhaseF4.getMinxinByOldClass) {
      var mh = '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:3px;font-size:0.7rem;">';
      var labels = {shi:'士', nong:'农', gong:'工', shang:'商', bing:'兵', seng:'僧', xu:'胥', yi:'役', haoqiang:'豪强', liumin:'流民'};
      Object.keys(labels).forEach(function(k) {
        var v = global.PhaseF4.getMinxinByOldClass(k);
        var col = v >= 60 ? '#6aa88a' : v >= 40 ? 'var(--gold)' : 'var(--vermillion-400)';
        mh += '<div style="padding:3px 5px;background:var(--bg-2);"><span style="color:var(--txt-d);">' + labels[k] + '</span> <span style="color:' + col + ';float:right;">' + Math.round(v) + '</span></div>';
      });
      mh += '</div>';
      html += _sec('九旧分类映射', '士农工商兵僧胥役豪流', mh);
    }

    // § 异象三库按类
    var AC = (typeof global.AuthorityComplete !== 'undefined') ? global.AuthorityComplete : null;
    if (AC && AC.HEAVEN_SIGNS && AC.AUSPICIOUS_SIGNS) {
      var lih = '<div style="font-size:0.7rem;">';
      lih += '<div style="color:var(--vermillion-400);margin-bottom:2px;">天象库（' + AC.HEAVEN_SIGNS.length + '）：</div>';
      AC.HEAVEN_SIGNS.forEach(function(s) {
        lih += '<span style="padding:1px 5px;margin:1px;background:rgba(192,64,48,0.1);border-radius:2px;display:inline-block;">' + _esc(s.name) + '</span>';
      });
      lih += '<div style="color:#6aa88a;margin:4px 0 2px;">祥瑞库（' + AC.AUSPICIOUS_SIGNS.length + '）：</div>';
      AC.AUSPICIOUS_SIGNS.forEach(function(s) {
        lih += '<span style="padding:1px 5px;margin:1px;background:rgba(106,168,138,0.1);border-radius:2px;display:inline-block;">' + _esc(s.name) + '</span>';
      });
      var PL = (typeof global.PhaseD !== 'undefined' && global.PhaseD.PROPHECY_LIBRARY) || [];
      if (PL.length > 0) {
        lih += '<div style="color:var(--amber-400);margin:4px 0 2px;">谶纬库（' + PL.length + '）：</div>';
        PL.forEach(function(p) {
          lih += '<span style="padding:1px 5px;margin:1px;background:rgba(184,140,60,0.1);border-radius:2px;display:inline-block;">' + _esc(p.text) + '</span>';
        });
      }
      lih += '</div>';
      html += _sec('异象三库', '天7·瑞6·谶12', lih);
    }

    // § 天人感应状态
    if (G._recentHeavenSign !== undefined) {
      html += _sec('天人感应', null, '<div style="font-size:0.72rem;">近期 ' + (G._recentHeavenSign?'有天示':'无') + '</div>');
    }

    _appendToBody('minxin-body', html);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  皇权补齐：诏书五要素 / 执行率公式
  // ═══════════════════════════════════════════════════════════════════

  function _extraForHuangquan() {
    var G = global.GM || {}; var hq = G.huangquan || {}; var html = '';

    // § 执行率公式
    if (typeof global.AuthorityComplete !== 'undefined' && global.AuthorityComplete.computeEdictExecutionRate) {
      var execRate = global.AuthorityComplete.computeEdictExecutionRate(0.6);  // 假设 60% 完整度
      var hw = G.huangwei || {};
      var hqBase = hq ? (0.5 + hq.index / 200) : 0.75;
      var hwMult = hw.phase === 'tyrant'?1.3:hw.phase==='majesty'?1.1:hw.phase==='decline'?0.7:hw.phase==='lost'?0.35:1.0;
      var eh = '<div style="font-size:0.72rem;padding:6px 8px;background:var(--bg-2);border-radius:3px;">';
      eh += '<div>执行率 = <b>皇权基 × 皇威乘 × 诏详</b></div>';
      eh += '<div style="color:var(--txt-d);margin-top:2px;">= ' + (hqBase*100).toFixed(0) + '% × ' + hwMult.toFixed(2) + ' × 0.5~1.0</div>';
      eh += '<div style="margin-top:2px;">当前（假设完整度 60%）：<b style="color:var(--gold);">' + (execRate*100).toFixed(0) + '%</b></div>';
      eh += '</div>';
      html += _sec('执行率公式', null, eh);
    }

    // § 诏书五要素
    var fh = '<div style="font-size:0.72rem;color:var(--txt-d);">专制段（皇权 >= 70）时诏书须五要素齐备：</div>';
    fh += '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:3px;margin-top:4px;">';
    ['时日','地点','执行人','经费','考核'].forEach(function(e) {
      fh += '<div style="padding:4px;background:var(--bg-2);text-align:center;font-size:0.7rem;">' + e + '</div>';
    });
    fh += '</div>';
    if (hq.index >= 70) fh += '<div style="font-size:0.68rem;color:var(--amber-400);margin-top:3px;">⚠ 当前专制段，缺要素将被侍臣请圣裁</div>';
    html += _sec('诏书·五要素', '专制段硬检', fh);

    // § 四象限原型
    var QP = (typeof global.AuthorityComplete !== 'undefined' && global.AuthorityComplete.getAuthorityQuadrant) ? global.AuthorityComplete.getAuthorityQuadrant() : null;
    // 还要显示所有象限原型
    var ALL_Q = {
      tyrant_peak: { name:'暴君顶点', desc:'朱元璋末/隋炀帝' },
      lonely_do: { name:'事必躬亲无人听', desc:'崇祯末' },
      revered_puppet: { name:'受敬傀儡', desc:'罕见' },
      puppet: { name:'汉献帝式傀儡', desc:'汉献帝' },
      optimal: { name:'制衡威严', desc:'唐太宗/康熙中期' }
    };
    var qh = '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:3px;">';
    Object.keys(ALL_Q).forEach(function(k) {
      var p = ALL_Q[k]; var active = QP && QP.id === k;
      var col = active ? 'var(--gold)' : 'var(--txt-d)';
      qh += '<div style="padding:4px 6px;background:var(--bg-2);border-left:3px solid ' + col + ';font-size:0.7rem;">' +
        '<div style="color:' + col + ';">' + (active?'► ':'') + _esc(p.name) + '</div>' +
        '<div style="font-size:0.66rem;color:var(--txt-d);">' + _esc(p.desc) + '</div>' +
      '</div>';
    });
    qh += '</div>';
    html += _sec('四象限原型', '当前+5 原型', qh);

    _appendToBody('huangquan-body', html);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  皇威补齐：地方粉饰五段表 / 执行度乘数表 / 朝代预设参考
  // ═══════════════════════════════════════════════════════════════════

  function _extraForHuangwei() {
    var G = global.GM || {}; var w = G.huangwei || {}; var html = '';

    // § 粉饰公式五段表
    var idx = w.index || 50;
    var corr = (G.corruption && typeof G.corruption === 'object' ? G.corruption.overall : 0) || 0;
    var corrMult = 1 + corr / 200;
    var powder = [
      { seg:'暴君（≥90）', add:8, note:'奏疏 90% 颂圣，perceived 高估' },
      { seg:'威严（70-89）', add:2, note:'基本真实，轻微粉饰' },
      { seg:'常望（50-69）', add:3, note:'中等粉饰，低风险' },
      { seg:'衰微（30-49）', add:6, note:'粉饰愈急，地方抬值' },
      { seg:'失威（<30）', add:4, note:'抗疏公然，粉饰无力' }
    ];
    var ph = '<table style="width:100%;font-size:0.7rem;"><tr style="color:var(--gold-500);"><td>段位</td><td>基加</td><td>×腐败</td><td>说明</td></tr>';
    powder.forEach(function(p) {
      var curr = (idx >= 90 && p.seg.indexOf('暴君')===0) || (idx >= 70 && idx < 90 && p.seg.indexOf('威严')===0) || (idx >= 50 && idx < 70 && p.seg.indexOf('常望')===0) || (idx >= 30 && idx < 50 && p.seg.indexOf('衰微')===0) || (idx < 30 && p.seg.indexOf('失威')===0);
      var col = curr ? 'var(--gold)' : 'var(--txt-d)';
      ph += '<tr style="color:' + col + ';">' +
        '<td>' + (curr?'► ':'') + _esc(p.seg) + '</td>' +
        '<td>+' + p.add + '</td>' +
        '<td>×' + (curr?corrMult.toFixed(2):'?.??') + '</td>' +
        '<td style="font-size:0.66rem;">' + _esc(p.note) + '</td></tr>';
    });
    ph += '</table>';
    html += _sec('粉饰公式 · 五段', '地方视野修饰', ph);

    // § 执行度乘数表
    var emh = '<table style="width:100%;font-size:0.7rem;"><tr style="color:var(--gold-500);"><td>段位</td><td>乘数</td><td>含义</td></tr>';
    [
      { seg:'暴君', m:1.3, desc:'令出必行，过度执行' },
      { seg:'威严', m:1.0, desc:'诏命畅达' },
      { seg:'常望', m:0.85, desc:'略有阻' },
      { seg:'衰微', m:0.65, desc:'诏行有阻' },
      { seg:'失威', m:0.35, desc:'诏不出京' }
    ].forEach(function(e) {
      var wphase = w.phase === 'tyrant'?'暴君':w.phase==='majesty'?'威严':w.phase==='normal'?'常望':w.phase==='decline'?'衰微':'失威';
      var curr = e.seg === wphase;
      var col = curr ? 'var(--gold)' : 'var(--txt-d)';
      emh += '<tr style="color:' + col + ';">' +
        '<td>' + (curr?'► ':'') + e.seg + '</td>' +
        '<td>×' + e.m.toFixed(2) + '</td>' +
        '<td style="font-size:0.66rem;">' + e.desc + '</td></tr>';
    });
    emh += '</table>';
    html += _sec('执行度乘数表 · 五段', null, emh);

    // § 朝代预设参考
    var DAP = (typeof global.PhaseG1 !== 'undefined' && global.PhaseG1.DYNASTY_AUTHORITY_PRESETS) || {};
    if (G.dynasty && DAP[G.dynasty]) {
      var preset = DAP[G.dynasty];
      var dh = '<div style="font-size:0.7rem;">朝代 <b>' + _esc(G.dynasty) + '</b>：</div>';
      dh += '<table style="width:100%;font-size:0.68rem;margin-top:3px;"><tr style="color:var(--gold-500);"><td>阶段</td><td>皇威</td><td>皇权</td><td>民心</td><td>腐败</td><td>典故</td></tr>';
      ['founding','peak','decline','collapse'].forEach(function(k) {
        var p = preset[k]; if (!p) return;
        dh += '<tr><td>' + ({founding:'开国',peak:'盛世',decline:'衰世',collapse:'末世'}[k]) + '</td>';
        dh += '<td>' + p.hw + '</td><td>' + p.hq + '</td><td>' + p.mx + '</td><td>' + p.corr + '</td>';
        dh += '<td style="font-size:0.64rem;">' + _esc(p.name||'') + '</td></tr>';
      });
      dh += '</table>';
      html += _sec('朝代预设 · 参考', _esc(G.dynasty), dh);
    }

    _appendToBody('huangwei-body', html);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Wrap 原 render 函数
  // ═══════════════════════════════════════════════════════════════════

  function _wrap(fnName, extraFn) {
    var orig = global[fnName];
    if (typeof orig !== 'function') return;
    global[fnName] = function() {
      orig.apply(this, arguments);
      try { extraFn(); } catch(e) { console.error('[drawer-final]', fnName, e); }
    };
  }

  function _installFinal() {
    _wrap('renderGuokuPanel', _extraForGuoku);
    _wrap('renderNeitangPanel', _extraForNeitang);
    _wrap('renderHukouPanel', _extraForHukou);
    _wrap('renderCorruptionPanel', _extraForLizhi);
    _wrap('renderMinxinPanel', _extraForMinxin);
    _wrap('renderHuangquanPanel', _extraForHuangquan);
    _wrap('renderHuangweiPanel', _extraForHuangwei);
  }

  // 立即安装（旧版 setTimeout 400ms 已移除 — 2026-04-24 · ext 已同步完成 Rich 替换）
  _installFinal();

  global.VarDrawersFinal = { install: _installFinal, VERSION: 1 };

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
