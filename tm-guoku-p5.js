// ═══════════════════════════════════════════════════════════════
// 帑廪 P5 最终 A 级补完
// 依赖：tm-guoku-engine.js + p2 + p4
//
// ⚠ 状态（R116c · 2026-04-24）：**ACCEPTED LAYERING · 暂不合并**
//    guoku p2/p4/p5/p6 是 R19 明确记录的 5 层叠加链（tick 依次覆盖 4 次）。
//    合并需为每层 tick 写行为快照测试，再按 R19 策略以 p6 为基础重建。
//    无测试合并 = 回归风险。保留分片是审慎决定。
//
// ⚠ 补丁分类（2026-04-24 R19 评估）：LAYERED（5 层叠加链第 4 层）
//   · APPEND：LOAN_SOURCES/takeLoanBySource/calcCaoyunLossRate/aiFiscalAdvisor/isAIAvailable
//   · OVERRIDE：GuokuEngine.tick（覆盖 p4 的 tick，让位给 p6 终版）
//   覆盖链：engine.tick v1 → p2.tick v2 → p4.tick v3 → p5.tick v4 → p6.tick v5（最终）
//
// 实现：
//   - 补充 J 漕运细化（损耗率/漕弊事件/漕帮党联动）
//   - 补充 L 借贷 3 来源（盐商/钱商/外邦）
//   - 补充 O AI 财政参议
// ═══════════════════════════════════════════════════════════════

(function(global) {
  'use strict';

  if (typeof GuokuEngine === 'undefined') {
    console.warn('[guoku-p5] GuokuEngine 未加载');
    return;
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function safe(v, d) { return (v === undefined || v === null) ? (d || 0) : v; }

  // ═════════════════════════════════════════════════════════════
  // 补充 J · 漕运细化
  // ═════════════════════════════════════════════════════════════

  // 漕运损耗率 = f(税司腐败, 地方腐败, 漕帮党)
  function calcCaoyunLossRate() {
    if (!GM.corruption) return 0.05;  // 基准 5%
    var fc = safe((GM.corruption.subDepts.fiscal || {}).true, 0);
    var pc = safe((GM.corruption.subDepts.provincial || {}).true, 0);
    // 腐败贡献：每点腐败 +0.3% 损耗
    var lossRate = 0.05 + (fc + pc) / 200 * 0.3;
    // 漕帮党存在则额外 +5%
    var factions = (GM.corruption.entrenchedFactions || []);
    var hasCaoyunCabal = factions.some(function(f) {
      return f.name === '漕运党' || (f.name || '').indexOf('漕') !== -1;
    });
    if (hasCaoyunCabal) lossRate += 0.05;
    return clamp(lossRate, 0.02, 0.6);
  }

  // 包装 Sources.caoliang，扣除损耗并追踪
  var _origCaoliang = GuokuEngine.Sources.caoliang;
  GuokuEngine.Sources.caoliang = function() {
    var nominal = _origCaoliang() || 0;
    var lossRate = calcCaoyunLossRate();
    var actual = nominal * (1 - lossRate);
    // 记录到 GM.guoku._caoyunLoss 供 UI 展示
    if (!GM.guoku._caoyunStats) GM.guoku._caoyunStats = {};
    GM.guoku._caoyunStats.nominal = nominal;
    GM.guoku._caoyunStats.lossRate = lossRate;
    GM.guoku._caoyunStats.actual = actual;
    GM.guoku._caoyunStats.lossAmount = nominal - actual;
    return actual;
  };

  // 漕弊事件：月概率 = 损耗率 × 0.05
  function maybeTriggerCaoyunIncident(mr) {
    var lossRate = calcCaoyunLossRate();
    if (lossRate < 0.25) return;
    var prob = (lossRate - 0.25) * 0.1 * mr;
    if (Math.random() > prob) return;

    // 漕弊事件
    var events = [
      '漕船沉没于淮上，损粮数万石',
      '漕丁哗变，截留粮米充私',
      '漕船晚至京师，京营断炊',
      '沿河官吏讹索，漕船停滞',
      '漕帮把持河道，新船不得行'
    ];
    var txt = events[Math.floor(Math.random() * events.length)];
    if (typeof addEB === 'function') {
      addEB('事件', '漕弊：' + txt, { credibility: 'high' });
    }
    // 立即后果
    if (GM.minxin) GM.minxin.trueIndex = Math.max(0, GM.minxin.trueIndex - 2);
    if (GM.guoku && GM.guoku.ledgers && GM.guoku.ledgers.grain) {
      GM.guoku.ledgers.grain.stock = Math.max(0, GM.guoku.ledgers.grain.stock * 0.95);
    }
    // 记录事件
    if (GM.guoku && GM.guoku.history) {
      GM.guoku.history.events.push({
        turn: GM.turn, type: 'caoyun_incident', text: txt
      });
    }
  }

  // ═════════════════════════════════════════════════════════════
  // 补充 L · 借贷 3 来源
  // ═════════════════════════════════════════════════════════════

  var LOAN_SOURCES = {
    saltMerchant: {
      id: 'saltMerchant', name: '两淮盐商',
      interest: 0.015,  // 1.5%/月
      maxAmount: 300000,
      historical: '清代盐商多向朝廷借贷，以盐引为质',
      requires: function() {
        // 需盐铁专卖启用
        var cfg = (typeof P !== 'undefined' && P.fiscalConfig) || {};
        var tx = cfg.taxesEnabled;
        return !tx || tx.yanlizhuan !== false;
      },
      sideEffects: { huangquan: -1, fiscalCorruption: +2 }  // 盐商党可能壮大
    },
    moneyMerchant: {
      id: 'moneyMerchant', name: '山陕钱商（票号）',
      interest: 0.02,
      maxAmount: 500000,
      historical: '明清山西票号、陕西钱庄',
      sideEffects: {}  // 中性
    },
    foreignLoan: {
      id: 'foreignLoan', name: '外邦借银',
      interest: 0.03,
      maxAmount: 1000000,
      historical: '清末向列强举债，开局末世',
      sideEffects: { huangwei: -5, foreign: -10, minxin: -3 }
    }
  };

  function takeLoanBySource(sourceId, amount, termMonths) {
    var src = LOAN_SOURCES[sourceId];
    if (!src) return { success: false, reason: '未知借贷来源' };
    if (src.requires && !src.requires()) return { success: false, reason: '条件不备' };
    amount = Math.min(amount || src.maxAmount * 0.3, src.maxAmount);
    termMonths = termMonths || 12;

    GuokuEngine.ensureModel();
    GM.guoku.balance += amount;

    // 多笔并存
    if (!GM.guoku.emergency.loans) GM.guoku.emergency.loans = [];
    GM.guoku.emergency.loans.push({
      source: sourceId, sourceName: src.name,
      principal: amount,
      interestRate: src.interest,
      monthsLeft: termMonths,
      totalTerm: termMonths
    });

    // 标准 loan 标记（兼容原单笔逻辑）
    GM.guoku.emergency.loan.active = true;
    GM.guoku.emergency.loan.amount = (GM.guoku.emergency.loan.amount || 0) + amount;
    GM.guoku.emergency.loan.monthsLeft = Math.max(GM.guoku.emergency.loan.monthsLeft || 0, termMonths);

    // 副作用
    var se = src.sideEffects || {};
    if (se.huangquan && GM.huangquan) GM.huangquan.index = clamp(GM.huangquan.index + se.huangquan, 0, 100);
    if (se.huangwei && GM.huangwei) GM.huangwei.index = clamp(GM.huangwei.index + se.huangwei, 0, 100);
    if (se.minxin && GM.minxin) GM.minxin.trueIndex = clamp(GM.minxin.trueIndex + se.minxin, 0, 100);
    if (se.foreign && GM.huangwei && GM.huangwei.subDims && GM.huangwei.subDims.foreign) {
      GM.huangwei.subDims.foreign.value = clamp(GM.huangwei.subDims.foreign.value + se.foreign, 0, 100);
    }
    if (se.fiscalCorruption && GM.corruption && GM.corruption.subDepts.fiscal) {
      GM.corruption.subDepts.fiscal.true = clamp(GM.corruption.subDepts.fiscal.true + se.fiscalCorruption, 0, 100);
    }

    if (typeof addEB === 'function') {
      addEB('朝代', '借银 ' + Math.round(amount/10000) + ' 万两于' + src.name +
        '，利率 ' + (src.interest * 100).toFixed(1) + '%/月，限 ' + termMonths + ' 月',
        { credibility: 'high' });
    }
    return { success: true, loan: src };
  }

  // 多笔借贷的月付处理
  function processLoansMonthly(mr) {
    if (!GM.guoku || !GM.guoku.emergency || !GM.guoku.emergency.loans) return;
    var loans = GM.guoku.emergency.loans;
    var remaining = [];
    loans.forEach(function(L) {
      // 每月本息 = 本金 × (1/term + interest)
      var payment = L.principal * (1 / L.totalTerm + L.interestRate) * mr;
      GM.guoku.balance -= payment;
      L.monthsLeft -= mr;
      if (L.monthsLeft > 0) {
        remaining.push(L);
      } else {
        if (typeof addEB === 'function') {
          addEB('朝代', L.sourceName + '借银已还清', { credibility: 'high' });
        }
      }
    });
    GM.guoku.emergency.loans = remaining;
    // 若无未结清借款，清除总标志
    if (remaining.length === 0) {
      GM.guoku.emergency.loan.active = false;
      GM.guoku.emergency.loan.amount = 0;
      GM.guoku.emergency.loan.monthsLeft = 0;
    }
  }

  // 替换原简易 takeLoan（包装为指向默认 moneyMerchant）
  var _origTakeLoan = GuokuEngine.Actions.takeLoan;
  GuokuEngine.Actions.takeLoan = function(amount, term) {
    return takeLoanBySource('moneyMerchant', amount, term);
  };
  GuokuEngine.Actions.takeLoanBySource = takeLoanBySource;

  // ═════════════════════════════════════════════════════════════
  // 补充 O · AI 财政参议
  // ═════════════════════════════════════════════════════════════

  function isAIAvailable() {
    return (typeof callAI === 'function') && (typeof P !== 'undefined') && P.ai && P.ai.key;
  }

  async function aiFiscalAdvisor() {
    if (!isAIAvailable()) {
      return { available: false, analysis: _ruleBasedFiscalAdvisor() };
    }
    var g = GM.guoku || {};
    var n = GM.neitang || {};
    var reform = (g.ongoingReforms || []).map(function(o) {
      return (GuokuEngine.FISCAL_REFORMS[o.id] || {}).name;
    }).join('、') || '无';
    var completed = (g.completedReforms || []).map(function(id) {
      return (GuokuEngine.FISCAL_REFORMS[id] || {}).name;
    }).join('、') || '无';
    var cabal = ((GM.corruption || {}).entrenchedFactions || [])
      .map(function(f) { return f.name; }).join('、') || '无';

    var prompt = '你扮演户部尚书，为陛下参议财政大计。' +
      '以奏疏体（200 字内，文言雅训），分析三项：' +
      '1) 帑廪现况断言（岁有余/岁亏/危殆）' +
      '2) 当务之急：加派/开仓/借贷/减赋/裁员/发钞/改革，择一二。' +
      '3) 副作用预警。\n\n当前时局：' +
      '\n- 帑廪 ' + Math.round(g.balance || 0) + ' 两（年入 ' + Math.round(g.annualIncome || 0) + '）' +
      '\n- 月入 ' + Math.round(g.monthlyIncome || 0) + '，月支 ' + Math.round(g.monthlyExpense || 0) +
      '\n- 实征率 ' + Math.round((g.actualTaxRate || 1) * 100) + '%' +
      '\n- 内帑 ' + Math.round(n.balance || 0) + ' 两' +
      '\n- 皇权 ' + Math.round((GM.huangquan || {}).index || 50) + '，皇威 ' + Math.round((GM.huangwei || {}).index || 50) +
      '\n- 民心 ' + Math.round((GM.minxin || {}).trueIndex || 50) +
      '\n- 粮价 ' + (((GM.prices || {}).grain) || 1).toFixed(2) + ' ×' +
      '\n- 施行中改革：' + reform + '；已完成：' + completed +
      '\n- 腐败集团：' + cabal +
      '\n- 破产：' + (g.bankruptcy && g.bankruptcy.active ? '已连续 ' + Math.round(g.bankruptcy.consecutiveMonths || 0) + ' 月' : '否') +
      '\n\n直接输出奏疏（"臣户部尚书某某谨奏……"），不含解释。';

    try {
      var text = await callAI(prompt, 600);
      return { available: true, analysis: (text || '').trim() };
    } catch(e) {
      console.warn('[guoku-p5] aiFiscalAdvisor:', e.message);
      return { available: false, analysis: _ruleBasedFiscalAdvisor(), error: e.message };
    }
  }

  function _ruleBasedFiscalAdvisor() {
    var g = GM.guoku || {};
    var balance = g.balance || 0;
    var annual = g.annualIncome || 1;
    var monthly = g.monthlyIncome || 1;
    var h = (GM.huangquan || {}).index || 50;
    var m = (GM.minxin || {}).trueIndex || 50;
    var grainPrice = ((GM.prices || {}).grain) || 1;

    var lines = [];
    // 断言
    if (g.bankruptcy && g.bankruptcy.active) {
      lines.push('【断言】帑廪已破，' + Math.round(g.bankruptcy.consecutiveMonths || 0) + ' 月连亏，危殆。');
    } else if (balance < annual * 0.2) {
      lines.push('【断言】帑廪不足年入二成，近于危境。');
    } else if (balance < 0) {
      lines.push('【断言】帑廪初亏，不可不慎。');
    } else if (balance > annual * 3) {
      lines.push('【断言】岁有余帑三年之积。');
    } else {
      lines.push('【断言】岁有小余，中平之局。');
    }

    // 建议
    var actions = [];
    if (balance < 0 && h > 50 && m > 40) {
      actions.push('加派赋税以济目前');
    }
    if (balance < annual * 0.3 && m > 50) {
      actions.push('向盐商/钱商借银十至三十万');
    }
    if ((g.ongoingReforms || []).length === 0 && balance > annual * 0.5 && h > 55) {
      actions.push('推大改革（如一条鞭法/摊丁入亩）以立长治');
    }
    if (balance > annual * 2 && m > 60) {
      actions.push('减赋两成以惠百姓');
    }
    if (grainPrice > 1.5) {
      actions.push('开仓赈济，平抑粮价');
    }
    if (actions.length > 0) {
      lines.push('【臣请】' + actions.join('；'));
    } else {
      lines.push('【臣请】维持现状，徐图之。');
    }

    // 副作用
    var warnings = [];
    var fCabal = (GM.corruption && GM.corruption.entrenchedFactions) || [];
    if (fCabal.some(function(f) { return f.dept === 'fiscal'; })) {
      warnings.push('税司腐败集团盘踞，改革必激反噬');
    }
    if (h < 45) warnings.push('皇权不足，大改恐推行不力');
    if (m < 40) warnings.push('民心不稳，加派激民变');
    if (warnings.length > 0) lines.push('【副作用】' + warnings.join('；'));

    return lines.join('\n\n');
  }

  // ═════════════════════════════════════════════════════════════
  // 接入 tick
  // ═════════════════════════════════════════════════════════════

  var _origTick = GuokuEngine.tick;
  GuokuEngine.tick = function(context) {
    _origTick.call(this, context);
    var mr = (context && context._monthRatio) ||
             (typeof GuokuEngine.getMonthRatio === 'function' ? GuokuEngine.getMonthRatio() : 1);
    try { maybeTriggerCaoyunIncident(mr); } catch(e) { console.error('[guoku-p5] caoyun:', e); }
    try { processLoansMonthly(mr); }        catch(e) { console.error('[guoku-p5] loans:', e); }
  };

  // 导出
  GuokuEngine.LOAN_SOURCES = LOAN_SOURCES;
  GuokuEngine.takeLoanBySource = takeLoanBySource;
  GuokuEngine.calcCaoyunLossRate = calcCaoyunLossRate;
  GuokuEngine.aiFiscalAdvisor = aiFiscalAdvisor;
  GuokuEngine.isAIAvailable = isAIAvailable;

  console.log('[guoku-p5] 加载：漕运损耗 + 漕弊事件 + 3 借贷来源 + AI 财政参议');

})(typeof window !== 'undefined' ? window : this);
