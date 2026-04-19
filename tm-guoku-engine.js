// ═══════════════════════════════════════════════════════════════
// 帑廪（国库）系统 · 核心引擎
// 设计方案：设计方案-财政系统.md（决策 A-G + 补充 H-P）
//
// 本文件实现：
//   - 八类收入计算（田赋/丁税/漕粮/专卖/市舶/榷税/捐纳/其他）
//   - 八类支出计算（俸禄/军饷/赈济/工程/祭祀/赏赐/内廷/其他）
//   - 与腐败的实征率联动（三数对照）
//   - 年度决算 + 历史归档
//   - 破产事件 + 紧急措施（加派/借贷）
//   - 时间刻度适配（daysPerTurn）
// ═══════════════════════════════════════════════════════════════

(function(global) {
  'use strict';

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function safe(v, d) { return (v === undefined || v === null) ? (d || 0) : v; }

  function getMonthRatio() {
    if (typeof _getDaysPerTurn === 'function') return _getDaysPerTurn() / 30;
    return 1;
  }

  // ═════════════════════════════════════════════════════════════
  // 数据模型保障
  // ═════════════════════════════════════════════════════════════

  function ensureGuokuModel() {
    if (!GM.guoku) GM.guoku = {};
    var g = GM.guoku;
    if (g.balance === undefined) g.balance = 1000000;
    if (g.monthlyIncome === undefined) g.monthlyIncome = 80000;
    if (g.monthlyExpense === undefined) g.monthlyExpense = 75000;
    if (g.annualIncome === undefined) g.annualIncome = g.monthlyIncome * 12;
    if (g.lastDelta === undefined) g.lastDelta = 0;
    if (g.trend === undefined) g.trend = 'stable';
    if (g.actualTaxRate === undefined) g.actualTaxRate = 1.0;

    if (!g.ledgers) g.ledgers = {};
    ['money','grain','cloth'].forEach(function(k) {
      if (!g.ledgers[k]) {
        g.ledgers[k] = { stock:0, lastTurnIn:0, lastTurnOut:0,
                         sources:{}, sinks:{}, history:[] };
      }
      if (g.ledgers[k].history === undefined) g.ledgers[k].history = [];
    });
    // 同步 money.stock 与 balance
    if (g.ledgers.money.stock === 0 && g.balance !== 0) g.ledgers.money.stock = g.balance;

    if (!g.unit) g.unit = { money:'两', grain:'石', cloth:'匹' };
    if (!g.sources) g.sources = { tianfu:0, dingshui:0, caoliang:0, yanlizhuan:0,
                                  shipaiShui:0, quanShui:0, juanNa:0, qita:0 };
    if (!g.expenses) g.expenses = { fenglu:0, junxiang:0, zhenzi:0, gongcheng:0,
                                    jisi:0, shangci:0, neiting:0, qita:0 };
    if (!g.bankruptcy) g.bankruptcy = { active:false, consecutiveMonths:0, severity:0 };
    if (!g.emergency) g.emergency = { extraTax:{active:false,rate:0},
                                       loan:{active:false,amount:0,monthsLeft:0} };
    if (!g.history) g.history = { monthly:[], yearly:[], events:[] };
  }

  // ═════════════════════════════════════════════════════════════
  // 八类收入计算
  // ═════════════════════════════════════════════════════════════

  var Sources = {
    // 田赋（农业税）—— 取决于在籍户口 + 农业政策
    tianfu: function() {
      var hukou = GM.hukou || {};
      var regTotal = safe(hukou.registeredTotal, 10000000);
      // 人均年田赋 ~ 0.08 两
      var perCapita = 0.08 * (hukou.taxRateMultiplier || 1);
      return regTotal * perCapita;
    },
    // 丁税（人头税）
    dingshui: function() {
      var hukou = GM.hukou || {};
      var regTotal = safe(hukou.registeredTotal, 10000000);
      // 成年男丁比例 ~ 25%，丁税 ~ 0.03 两/丁·年
      return regTotal * 0.25 * 0.03;
    },
    // 漕粮（运输+仓储）
    caoliang: function() {
      // 北方粮仓依赖漕运，年度值与户口相关
      var regTotal = safe((GM.hukou || {}).registeredTotal, 10000000);
      return regTotal * 0.02;  // 粗略
    },
    // 盐铁茶酒专卖
    yanlizhuan: function() {
      var monopolyActive = (GM.policies || {}).monopolyActive !== false;
      if (!monopolyActive) return 0;
      var regTotal = safe((GM.hukou || {}).registeredTotal, 10000000);
      return regTotal * 0.025;  // 人均 0.025 两·年
    },
    // 市舶（港口海关）
    shipaiShui: function() {
      if (!GM.hasMaritimePort) return 0;
      return safe(GM.maritimeTradeVolume, 0) * 0.08;
    },
    // 榷税（关税，内关）
    quanShui: function() {
      var regTotal = safe((GM.hukou || {}).registeredTotal, 10000000);
      return regTotal * 0.01 * (GM.commerceVolume || 1);
    },
    // 捐纳（卖官）
    juanNa: function() {
      if (!GM.juanna || !GM.juanna.active) return 0;
      return (GM.juanna.monthlyIncome || 0) * 12;
    },
    // 其他（各类杂项）
    qita: function() {
      return safe((GM.guoku || {}).otherIncome, 0);
    }
  };

  // ═════════════════════════════════════════════════════════════
  // 八类支出计算
  // ═════════════════════════════════════════════════════════════

  var Expenses = {
    // 俸禄
    fenglu: function() {
      var officialCount = safe(GM.totalOfficials, (GM.chars || []).length * 3);
      var avgSalary = safe((GM.officialSalary || {}).avg, 80);
      // 若有养廉银/俸禄改革
      var reformMult = 1;
      if (GM.corruption && GM.corruption.countermeasures &&
          GM.corruption.countermeasures.salaryReform > 0) {
        reformMult = 1 + GM.corruption.countermeasures.salaryReform * 0.5;
      }
      return officialCount * avgSalary * 12 * reformMult;
    },
    // 军饷
    junxiang: function() {
      var totalSoldiers = 0;
      (GM.armies || []).forEach(function(a) { totalSoldiers += (a.size || 0); });
      if (totalSoldiers === 0) {
        var hukou = GM.hukou || {};
        totalSoldiers = safe(hukou.registeredTotal, 10000000) * 0.01;  // 默认 1% 兵
      }
      return totalSoldiers * 15;  // 人年 15 两
    },
    // 赈济
    zhenzi: function() {
      var disasters = (GM.activeDisasters || []).length;
      return disasters * 80000;  // 每灾 8 万两
    },
    // 工程（含 lumpSumIncidents 的月度拨付）
    gongcheng: function() {
      var total = 0;
      var lsi = (GM.corruption && GM.corruption.lumpSumIncidents) || [];
      lsi.forEach(function(inc) {
        if (inc.status === 'active' && inc.amount && inc.expectedDuration) {
          total += inc.amount / inc.expectedDuration * 12;  // 年化
        }
      });
      return total;
    },
    // 祭祀（大典）
    jisi: function() {
      return 30000;  // 常规年 3 万两
    },
    // 赏赐
    shangci: function() {
      return safe((GM.guoku || {}).rewardBudget, 50000);
    },
    // 内廷转运（帑廪→内帑）
    neiting: function() {
      if (!GM.neitang) return 0;
      // 默认帑廪每月补贴内帑 1/100
      return safe((GM.guoku || {}).neicangTransferRate, 0.01) * 12 * safe((GM.guoku || {}).monthlyIncome, 80000);
    },
    // 其他
    qita: function() {
      return safe((GM.guoku || {}).otherExpense, 0);
    }
  };

  // ═════════════════════════════════════════════════════════════
  // 三数对照（与腐败联动）
  // ═════════════════════════════════════════════════════════════

  function computeTaxFlow(annualNominal) {
    // 腐败漏损率
    var leakageRate = 0;
    var overCollectRate = 0;
    if (GM.corruption && typeof CorruptionEngine !== 'undefined' && CorruptionEngine.Consequences) {
      var rate = CorruptionEngine.Consequences.calcActualTaxRate();  // 实征率
      leakageRate = 1 - rate;
      var fc = (GM.corruption.subDepts.fiscal || {}).true || 0;
      var pc = (GM.corruption.subDepts.provincial || {}).true || 0;
      overCollectRate = (fc + pc) / 200 * 0.5;
    }
    // 养廉银 → 浮收率减
    if (GM.corruption && GM.corruption.countermeasures && GM.corruption.countermeasures.salaryReform > 0) {
      overCollectRate *= (1 - GM.corruption.countermeasures.salaryReform * 0.4);
    }

    return {
      nominal: annualNominal,
      actualReceived: annualNominal * (1 - leakageRate),
      peasantPaid: annualNominal * (1 + overCollectRate),
      leakageRate: leakageRate,
      overCollectRate: overCollectRate
    };
  }

  // ═════════════════════════════════════════════════════════════
  // 月度结算
  // ═════════════════════════════════════════════════════════════

  function monthlySettle(mr) {
    mr = mr || getMonthRatio();
    ensureGuokuModel();
    var g = GM.guoku;

    // 计算八源年度名义收入
    var totalIncomeAnnual = 0;
    var sourceBreakdown = {};
    for (var k in Sources) {
      var v = 0;
      try { v = Sources[k]() || 0; } catch(e) { v = 0; }
      sourceBreakdown[k] = v;
      totalIncomeAnnual += v;
    }

    // 腐败漏损
    var flow = computeTaxFlow(totalIncomeAnnual);
    g.actualTaxRate = 1 - flow.leakageRate;
    g.annualIncome = Math.round(flow.actualReceived);
    g.monthlyIncome = Math.round(g.annualIncome / 12);

    // 计算八类支出
    var totalExpenseAnnual = 0;
    var expBreakdown = {};
    for (var e in Expenses) {
      var ev = 0;
      try { ev = Expenses[e]() || 0; } catch(err) { ev = 0; }
      expBreakdown[e] = ev;
      totalExpenseAnnual += ev;
    }
    g.monthlyExpense = Math.round(totalExpenseAnnual / 12);

    // 入账（按月数累计）
    var periodIn = g.monthlyIncome * mr;
    var periodOut = g.monthlyExpense * mr;
    var oldBalance = g.balance || 0;
    g.balance = oldBalance + periodIn - periodOut;
    g.lastDelta = periodIn - periodOut;

    // 趋势
    var threshold = g.annualIncome * 0.01;
    g.trend = g.lastDelta > threshold ? 'up' :
              g.lastDelta < -threshold ? 'down' : 'stable';

    // 更新分项（存储本回合的细项）
    g.sources = sourceBreakdown;
    g.expenses = expBreakdown;

    // 同步 ledgers.money
    g.ledgers.money.stock = g.balance;
    g.ledgers.money.lastTurnIn = periodIn;
    g.ledgers.money.lastTurnOut = periodOut;
    g.ledgers.money.sources = {
      田赋:sourceBreakdown.tianfu,丁税:sourceBreakdown.dingshui,
      漕粮:sourceBreakdown.caoliang,专卖:sourceBreakdown.yanlizhuan,
      市舶:sourceBreakdown.shipaiShui,榷税:sourceBreakdown.quanShui,
      捐纳:sourceBreakdown.juanNa,其他:sourceBreakdown.qita
    };
    g.ledgers.money.sinks = {
      俸禄:expBreakdown.fenglu,军饷:expBreakdown.junxiang,
      赈济:expBreakdown.zhenzi,工程:expBreakdown.gongcheng,
      祭祀:expBreakdown.jisi,赏赐:expBreakdown.shangci,
      内廷:expBreakdown.neiting,其他:expBreakdown.qita
    };

    // 历史快照
    g.history.monthly.push({
      turn: GM.turn, balance: g.balance,
      income: g.monthlyIncome, expense: g.monthlyExpense, delta: g.lastDelta
    });
    if (g.history.monthly.length > 120) g.history.monthly = g.history.monthly.slice(-120);

    // 破产检查
    checkBankruptcy(mr);

    // 借款月付
    if (g.emergency.loan.active && g.emergency.loan.monthsLeft > 0) {
      var payment = (g.emergency.loan.amount || 0) * 0.02 * mr;  // 本息 2%/月
      g.balance -= payment;
      g.emergency.loan.monthsLeft -= mr;
      if (g.emergency.loan.monthsLeft <= 0) {
        g.emergency.loan.active = false;
        g.emergency.loan.amount = 0;
        if (typeof addEB === 'function') addEB('朝代', '借贷已还清', { credibility: 'high' });
      }
    }
  }

  // ═════════════════════════════════════════════════════════════
  // 破产检查
  // ═════════════════════════════════════════════════════════════

  function checkBankruptcy(mr) {
    var g = GM.guoku;
    var half = g.annualIncome * 0.5;

    if (g.balance < -half) {
      g.bankruptcy.consecutiveMonths = (g.bankruptcy.consecutiveMonths || 0) + mr;
      if (!g.bankruptcy.active) {
        g.bankruptcy.active = true;
        g.bankruptcy.severity = Math.abs(g.balance) / g.annualIncome;
        triggerBankruptcyEvent();
      }
      // 持续破产加剧
      if (g.bankruptcy.consecutiveMonths > 6) {
        g.bankruptcy.severity += 0.1 * mr;
        if (Math.random() < 0.05 * mr) {
          triggerMutinyOrFamine();
        }
      }
    } else {
      if (g.bankruptcy.active) {
        g.bankruptcy.consecutiveMonths = Math.max(0, g.bankruptcy.consecutiveMonths - mr);
        if (g.bankruptcy.consecutiveMonths < 1) {
          g.bankruptcy.active = false;
          if (typeof addEB === 'function') addEB('朝代', '帑廪渐充，财政危机解除', { credibility: 'high' });
        }
      }
    }
  }

  function triggerBankruptcyEvent() {
    if (typeof addEB === 'function') {
      addEB('朝代', '帑廪亏空，岁入不敷所出，财政危机!', { credibility: 'high' });
    }
    // 七连锁反应（见 设计方案-财政系统.md §21.10）
    if (GM.huangquan) GM.huangquan.index = Math.max(0, GM.huangquan.index - 10);
    if (GM.huangwei)  GM.huangwei.index = Math.max(0, GM.huangwei.index - 15);
    if (GM.corruption && GM.corruption.sources) {
      GM.corruption.sources.lowSalary = (GM.corruption.sources.lowSalary || 0) + 15;
    }
    if (GM.huangwei && GM.huangwei.subDims && GM.huangwei.subDims.foreign) {
      GM.huangwei.subDims.foreign.value = Math.max(0, GM.huangwei.subDims.foreign.value - 15);
    }
    GM.guoku.history.events.push({
      turn: GM.turn, type: 'bankruptcy', severity: GM.guoku.bankruptcy.severity
    });
  }

  function triggerMutinyOrFamine() {
    if (GM.activeWars && GM.activeWars.length > 0) {
      if (typeof addEB === 'function') addEB('军事', '军饷断绝，兵变四起', { credibility: 'high' });
      if (GM.minxin) GM.minxin.trueIndex = Math.max(0, GM.minxin.trueIndex - 10);
    }
    if (GM.activeDisasters && GM.activeDisasters.length > 0) {
      if (typeof addEB === 'function') addEB('朝代', '赈济不继，饥民暴起', { credibility: 'high' });
      if (GM.minxin) GM.minxin.trueIndex = Math.max(0, GM.minxin.trueIndex - 15);
    }
  }

  // ═════════════════════════════════════════════════════════════
  // 紧急措施（加派/借贷/开仓）
  // ═════════════════════════════════════════════════════════════

  var Actions = {
    // 加派（临时提高税率）
    extraTax: function(rate) {
      ensureGuokuModel();
      var g = GM.guoku;
      rate = clamp(rate || 0.3, 0, 1.0);
      g.emergency.extraTax.active = true;
      g.emergency.extraTax.rate = rate;
      // 立即效果：腐败+（地方乘机浮收）
      if (GM.corruption) {
        GM.corruption.sources.emergencyLevy = (GM.corruption.sources.emergencyLevy || 0) + rate * 10;
      }
      // 民心大损
      if (GM.minxin) GM.minxin.trueIndex = Math.max(0, GM.minxin.trueIndex - rate * 15);
      if (typeof addEB === 'function') addEB('朝代', '加派' + Math.round(rate*100) + '%，民怨骤起', { credibility: 'high' });
      return { success: true };
    },

    // 开仓放粮（紧急赈济）
    openGranary: function(scale) {
      ensureGuokuModel();
      var g = GM.guoku;
      scale = scale || 'regional';
      var cost = scale === 'national' ? 500000 :
                 scale === 'regional' ? 150000 : 50000;
      if (g.balance < cost) return { success: false, reason: '帑廪不足' };
      g.balance -= cost;
      // 民心回升
      var minxinGain = scale === 'national' ? 15 :
                       scale === 'regional' ? 8 : 3;
      if (GM.minxin) GM.minxin.trueIndex = Math.min(100, GM.minxin.trueIndex + minxinGain);
      if (typeof addEB === 'function') addEB('朝代', '开仓赈济（' + scale + '）', { credibility: 'high' });
      return { success: true };
    },

    // 借贷（盐商/钱商/外国）
    takeLoan: function(amount, term) {
      ensureGuokuModel();
      var g = GM.guoku;
      amount = amount || 200000;
      term = term || 12;  // 默认12月
      g.balance += amount;
      g.emergency.loan.active = true;
      g.emergency.loan.amount = amount;
      g.emergency.loan.monthsLeft = term;
      // 皇威代价
      if (GM.huangwei) GM.huangwei.index = Math.max(0, GM.huangwei.index - 3);
      if (typeof addEB === 'function') addEB('朝代', '借银 ' + Math.round(amount/10000) + ' 万两，限 ' + term + ' 月归还', { credibility: 'high' });
      return { success: true };
    },

    // 裁冗员（节流）
    cutOfficials: function(percent) {
      ensureGuokuModel();
      percent = percent || 0.1;  // 默认裁 10%
      if (!GM.totalOfficials) GM.totalOfficials = 500;
      var cut = Math.floor(GM.totalOfficials * percent);
      GM.totalOfficials -= cut;
      // 皇权代价（官员离心）
      if (GM.huangquan) GM.huangquan.index = Math.max(0, GM.huangquan.index - percent * 20);
      // 民心微升（节俭）
      if (GM.minxin) GM.minxin.trueIndex = Math.min(100, GM.minxin.trueIndex + 2);
      if (typeof addEB === 'function') addEB('朝代', '裁冗员 ' + cut + ' 名，省俸禄', { credibility: 'high' });
      return { success: true };
    },

    // 减赋（长线惠民）
    reduceTax: function(percent) {
      ensureGuokuModel();
      percent = percent || 0.2;
      // 通过调整 taxRateMultiplier
      if (!GM.hukou) GM.hukou = {};
      GM.hukou.taxRateMultiplier = (GM.hukou.taxRateMultiplier || 1) * (1 - percent);
      if (GM.minxin) GM.minxin.trueIndex = Math.min(100, GM.minxin.trueIndex + percent * 30);
      if (GM.huangwei) GM.huangwei.index = Math.min(100, GM.huangwei.index + percent * 8);
      if (typeof addEB === 'function') addEB('朝代', '减赋 ' + Math.round(percent*100) + '%，民感圣恩', { credibility: 'high' });
      return { success: true };
    },

    // 发行纸币（历代险招）
    issuePaperCurrency: function(amount) {
      ensureGuokuModel();
      amount = amount || 500000;
      GM.guoku.balance += amount;
      // 立即后果：通胀、皇威损
      if (GM.huangwei) GM.huangwei.index = Math.max(0, GM.huangwei.index - 8);
      if (GM.minxin) GM.minxin.trueIndex = Math.max(0, GM.minxin.trueIndex - 5);
      // 粮价/物价浮动留 hook 给货币系统
      if (GM.currency) GM.currency.inflationPressure = (GM.currency.inflationPressure || 0) + amount / 1000000;
      if (typeof addEB === 'function') addEB('朝代', '发行纸钞 ' + Math.round(amount/10000) + ' 万，市面疑虑', { credibility: 'high' });
      return { success: true };
    }
  };

  // ═════════════════════════════════════════════════════════════
  // 年度决算
  // ═════════════════════════════════════════════════════════════

  function yearlySettle() {
    ensureGuokuModel();
    var g = GM.guoku;
    var year = (typeof getCurrentYear === 'function') ? getCurrentYear() : GM.turn;

    // 提取最近 12 月数据汇总
    var recent = g.history.monthly.slice(-12);
    var totalIn = 0, totalOut = 0;
    recent.forEach(function(m) { totalIn += m.income || 0; totalOut += m.expense || 0; });

    var archive = {
      year: year,
      totalIncome: totalIn,
      totalExpense: totalOut,
      netChange: totalIn - totalOut,
      finalBalance: g.balance,
      sources: Object.assign({}, g.sources),
      expenses: Object.assign({}, g.expenses),
      bankruptcyMonths: g.bankruptcy.consecutiveMonths,
      ledgers: {
        money: g.ledgers.money.stock,
        grain: g.ledgers.grain.stock,
        cloth: g.ledgers.cloth.stock
      }
    };
    g.history.yearly.push(archive);
    if (g.history.yearly.length > 40) g.history.yearly = g.history.yearly.slice(-40);
    if (typeof addEB === 'function') {
      var status = archive.netChange >= 0 ? '岁有余' : '岁亏';
      addEB('朝代', year + '年度决算：' + status + Math.round(Math.abs(archive.netChange)/10000) + '万两', {
        credibility: 'high'
      });
    }
    return archive;
  }

  // ═════════════════════════════════════════════════════════════
  // 朝代预设
  // ═════════════════════════════════════════════════════════════

  var DYNASTY_PRESETS = {
    '秦':   { founding:0.9, peak:1.3, decline:0.6, collapse:0.2 },
    '汉':   { founding:0.5, peak:1.6, decline:0.9, collapse:0.3 },
    '魏晋': { founding:0.8, peak:1.0, decline:0.6, collapse:0.2 },
    '唐':   { founding:1.2, peak:2.0, decline:1.0, collapse:0.3 },
    '五代': { founding:0.6, peak:0.7, decline:0.5, collapse:0.3 },
    '北宋': { founding:1.3, peak:2.2, decline:1.4, collapse:0.6 },
    '南宋': { founding:0.9, peak:1.5, decline:0.9, collapse:0.4 },
    '元':   { founding:1.1, peak:1.8, decline:0.8, collapse:0.3 },
    '明':   { founding:1.0, peak:1.8, decline:0.9, collapse:0.4 },
    '清':   { founding:1.2, peak:2.5, decline:1.3, collapse:0.5 },
    '上古': { founding:0.3, peak:0.5, decline:0.3, collapse:0.1 },
    '民国': { founding:0.8, peak:1.0, decline:0.6, collapse:0.3 }
  };

  var PHASE_INDEX = {
    founding:0, peak:1, decline:2, collapse:3,
    '开国':0, '全盛':1, '守成':1, '中衰':2, '末世':3, '衰落':2
  };

  function initFromDynasty(dynasty, phase, scenarioOverride) {
    ensureGuokuModel();
    var preset = DYNASTY_PRESETS[dynasty];
    if (!preset) {
      for (var k in DYNASTY_PRESETS) {
        if (dynasty && dynasty.indexOf(k) !== -1) { preset = DYNASTY_PRESETS[k]; break; }
      }
    }
    if (!preset) preset = { founding:0.5, peak:1.0, decline:0.6, collapse:0.3 };
    var phases = [preset.founding, preset.peak, preset.decline, preset.collapse];
    var pi = PHASE_INDEX[phase] !== undefined ? PHASE_INDEX[phase] : 1;
    var mult = phases[pi];

    // 基准：月入 8 万 × 乘数
    var baseIncome = 80000 * mult;
    GM.guoku.monthlyIncome = Math.round(baseIncome);
    GM.guoku.annualIncome = Math.round(baseIncome * 12);
    GM.guoku.monthlyExpense = Math.round(baseIncome * 0.95);  // 开销略低
    // 起始余额 = 6 月收入
    GM.guoku.balance = Math.round(baseIncome * 6);
    GM.guoku.ledgers.money.stock = GM.guoku.balance;

    // 剧本覆盖
    if (scenarioOverride && scenarioOverride.guoku) {
      var go = scenarioOverride.guoku;
      // 新字段：initialMoney/initialGrain/initialCloth（三列分账）
      if (go.initialMoney !== undefined) {
        GM.guoku.balance = go.initialMoney;
        GM.guoku.ledgers.money.stock = go.initialMoney;
      }
      if (go.initialGrain !== undefined) {
        GM.guoku.ledgers.grain.stock = go.initialGrain;
        GM.guoku.grain = go.initialGrain;
      }
      if (go.initialCloth !== undefined) {
        GM.guoku.ledgers.cloth.stock = go.initialCloth;
        GM.guoku.cloth = go.initialCloth;
      }
      // 配额
      if (go.quotaMoney !== undefined) GM.guoku.ledgers.money.quota = go.quotaMoney;
      if (go.quotaGrain !== undefined) GM.guoku.ledgers.grain.quota = go.quotaGrain;
      if (go.quotaCloth !== undefined) GM.guoku.ledgers.cloth.quota = go.quotaCloth;
      // 月均估计
      if (go.monthlyIncomeEstimate) {
        if (go.monthlyIncomeEstimate.money != null) GM.guoku.monthlyIncome = go.monthlyIncomeEstimate.money;
        if (go.monthlyIncomeEstimate.grain != null) GM.guoku.monthlyGrainIncome = go.monthlyIncomeEstimate.grain;
        if (go.monthlyIncomeEstimate.cloth != null) GM.guoku.monthlyClothIncome = go.monthlyIncomeEstimate.cloth;
      }
      if (go.monthlyExpenseEstimate) {
        if (go.monthlyExpenseEstimate.money != null) GM.guoku.monthlyExpense = go.monthlyExpenseEstimate.money;
        if (go.monthlyExpenseEstimate.grain != null) GM.guoku.monthlyGrainExpense = go.monthlyExpenseEstimate.grain;
        if (go.monthlyExpenseEstimate.cloth != null) GM.guoku.monthlyClothExpense = go.monthlyExpenseEstimate.cloth;
      }
      // 兼容旧字段（balance/monthlyIncome 直接给）
      if (go.balance !== undefined)       { GM.guoku.balance = go.balance; GM.guoku.ledgers.money.stock = go.balance; }
      if (go.monthlyIncome !== undefined) GM.guoku.monthlyIncome = go.monthlyIncome;
      if (go.monthlyExpense !== undefined) GM.guoku.monthlyExpense = go.monthlyExpense;
      if (go.annualIncome !== undefined)  GM.guoku.annualIncome = go.annualIncome;
    }
    return { dynasty: dynasty, phase: phase, multiplier: mult };
  }

  // ═════════════════════════════════════════════════════════════
  // 主 tick
  // ═════════════════════════════════════════════════════════════

  function tick(context) {
    ensureGuokuModel();
    var mr = (context && context._monthRatio) || getMonthRatio();
    if (context) context._guokuMonthRatio = mr;

    try { monthlySettle(mr); } catch(e) { console.error('[guoku] monthlySettle:', e); }

    // 年末决算（每年一次，简化：若当前 turn 跨越年）
    var dpt = (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 30;
    var daysPerYear = 360;
    var currentDay = GM.turn * dpt;
    var currentYear = Math.floor(currentDay / daysPerYear);
    var prevYear = Math.floor((GM.turn - 1) * dpt / daysPerYear);
    if (currentYear > prevYear) {
      try { yearlySettle(); } catch(e) { console.error('[guoku] yearlySettle:', e); }
    }
  }

  // ═════════════════════════════════════════════════════════════
  // 导出
  // ═════════════════════════════════════════════════════════════

  global.GuokuEngine = {
    tick: tick,
    ensureModel: ensureGuokuModel,
    getMonthRatio: getMonthRatio,
    Sources: Sources,
    Expenses: Expenses,
    Actions: Actions,
    computeTaxFlow: computeTaxFlow,
    monthlySettle: monthlySettle,
    yearlySettle: yearlySettle,
    checkBankruptcy: checkBankruptcy,
    initFromDynasty: initFromDynasty,
    DYNASTY_PRESETS: DYNASTY_PRESETS
  };

  console.log('[guoku] 引擎已加载：8 收入源 + 8 支出类 + 破产链 + 6 紧急措施 + 朝代预设');

})(typeof window !== 'undefined' ? window : this);
