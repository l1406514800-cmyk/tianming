// ═══════════════════════════════════════════════════════════════
// 内帑（皇室私库）系统 · 核心引擎
// 设计方案：设计方案-财政系统.md 决策 F（内帑规则可配）
//
// 与帑廪平行实施：
//   - 6 源（皇庄田租/皇产/特别税/抄家/朝贡/帑廪转运）
//   - 5 支（宫廷用度/大典/赏赐/后宫陵寝/接济帑廪）
//   - 三列账本（钱/粮/布）
//   - 双向转运（帑廪 ↔ 内帑）
//   - 宫廷危机（内帑空竭 → 内廷腐败暴涨）
//   - 与腐败系统的 imperial 分项联动（侵吞）
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

  function ensureNeitangModel() {
    if (!GM.neitang) GM.neitang = {};
    var n = GM.neitang;
    if (n.balance === undefined) n.balance = 200000;
    if (n.monthlyIncome === undefined) n.monthlyIncome = 15000;
    if (n.monthlyExpense === undefined) n.monthlyExpense = 12000;
    if (n.lastDelta === undefined) n.lastDelta = 0;
    if (n.trend === undefined) n.trend = 'stable';

    if (!n.ledgers) n.ledgers = {};
    ['money','grain','cloth'].forEach(function(k) {
      if (!n.ledgers[k]) n.ledgers[k] = { stock:0, lastTurnIn:0, lastTurnOut:0, sources:{}, sinks:{}, history:[] };
      if (n.ledgers[k].history === undefined) n.ledgers[k].history = [];
    });
    if (n.ledgers.money.stock === 0 && n.balance !== 0) n.ledgers.money.stock = n.balance;

    if (!n.unit) n.unit = { money:'两', grain:'石', cloth:'匹' };
    if (!n.sources) n.sources = {
      huangzhuang:0, huangchan:0, specialTax:0, confiscation:0, tribute:0, guokuTransfer:0
    };
    if (!n.expenses) n.expenses = {
      gongting:0, dadian:0, shangci:0, houGongLingQin:0, guokuRescue:0
    };
    if (!n.crisis) n.crisis = { active:false, consecutiveMonths:0, severity:0 };
    if (!n.history) n.history = { monthly:[], yearly:[], events:[] };
  }

  // ═════════════════════════════════════════════════════════════
  // 6 类收入
  // ═════════════════════════════════════════════════════════════

  var Sources = {
    // 皇庄田租（直属皇家田地）
    huangzhuang: function() {
      var acres = safe((GM.neitang || {}).huangzhuangAcres, 100000);  // 默认 10 万亩
      return acres * 0.5;  // 每亩 0.5 两/年
    },
    // 皇产经营（矿山/盐场/瓷窑/织造局）
    huangchan: function() {
      return safe((GM.neitang || {}).huangchanMonthly, 8000) * 12;  // 月 0.8 万
    },
    // 特别税（矿税/市舶部分 / 织造等——帝王专属）
    specialTax: function() {
      if (!GM.neitang || !GM.neitang.specialTaxActive) return 0;
      return safe((GM.neitang.specialTaxMonthly), 5000) * 12;
    },
    // 抄家入帑（腐败/叛乱后抄没）
    confiscation: function() {
      // 由 events 推入，这里读取近期累计
      return safe((GM.neitang || {})._recentConfiscation, 0);
    },
    // 朝贡（各国使节进献）
    tribute: function() {
      var count = ((GM.activeTributes || []).length) || 1;
      return count * 20000;
    },
    // 帑廪转运（常规补贴）
    guokuTransfer: function() {
      // 读取 GM.guoku.expenses.neiting（帑廪已计算的转运）
      return safe((GM.guoku && GM.guoku.expenses && GM.guoku.expenses.neiting), 0);
    }
  };

  // ═════════════════════════════════════════════════════════════
  // 5 类支出
  // ═════════════════════════════════════════════════════════════

  var Expenses = {
    // 宫廷用度（日常饮食/衣着/供应）
    gongting: function() {
      var baseMonthly = 3000;
      // 嫔妃数、宦官数影响
      var concubines = safe((GM.harem || {}).count, 30);
      var eunuchs = safe((GM.eunuchs || {}).count, 100);
      return (baseMonthly + concubines * 100 + eunuchs * 50) * 12;
    },
    // 大典（按当年举办的大典累计）
    dadian: function() {
      return safe((GM.neitang || {})._thisYearCeremonyBudget, 0);
    },
    // 赏赐
    shangci: function() {
      return safe((GM.neitang || {})._recentRewards, 20000);
    },
    // 后宫/陵寝
    houGongLingQin: function() {
      var base = 40000;
      if (GM.emperor && GM.emperor.buildingTomb) base += 200000;
      return base;
    },
    // 接济帑廪（内帑赈国）
    guokuRescue: function() {
      return safe((GM.neitang || {})._annualRescueAmount, 0);
    }
  };

  // ═════════════════════════════════════════════════════════════
  // 月度结算
  // ═════════════════════════════════════════════════════════════

  function monthlySettle(mr) {
    mr = mr || getMonthRatio();
    ensureNeitangModel();
    var n = GM.neitang;

    // 计算 6 源年度总
    var totalIncome = 0;
    var srcBreakdown = {};
    for (var k in Sources) {
      var v = 0;
      try { v = Sources[k]() || 0; } catch(e) { v = 0; }
      srcBreakdown[k] = v;
      totalIncome += v;
    }
    n.monthlyIncome = Math.round(totalIncome / 12);
    n.sources = srcBreakdown;

    // 计算 5 类支出
    var totalExpense = 0;
    var expBreakdown = {};
    for (var e in Expenses) {
      var ev = 0;
      try { ev = Expenses[e]() || 0; } catch(err) { ev = 0; }
      expBreakdown[e] = ev;
      totalExpense += ev;
    }
    n.monthlyExpense = Math.round(totalExpense / 12);
    n.expenses = expBreakdown;

    // 入账
    var periodIn = n.monthlyIncome * mr;
    var periodOut = n.monthlyExpense * mr;
    var oldBalance = n.balance;
    n.balance = oldBalance + periodIn - periodOut;
    n.lastDelta = periodIn - periodOut;

    // 趋势
    var threshold = (totalIncome / 12) * 0.1;
    n.trend = n.lastDelta > threshold ? 'up' :
              n.lastDelta < -threshold ? 'down' : 'stable';

    // 腐败侵吞（§3.7 calcInnerTreasuryLeak）——已在 corruption 中扣，这里确保同步
    // (由 corruption engine 直接修改 n.balance)

    // 同步 ledger
    n.ledgers.money.stock = n.balance;
    n.ledgers.money.lastTurnIn = periodIn;
    n.ledgers.money.lastTurnOut = periodOut;
    n.ledgers.money.sources = {
      皇庄:srcBreakdown.huangzhuang, 皇产:srcBreakdown.huangchan,
      特别税:srcBreakdown.specialTax, 抄家:srcBreakdown.confiscation,
      朝贡:srcBreakdown.tribute, 帑廪转运:srcBreakdown.guokuTransfer
    };
    n.ledgers.money.sinks = {
      宫廷:expBreakdown.gongting, 大典:expBreakdown.dadian,
      赏赐:expBreakdown.shangci, 后宫陵寝:expBreakdown.houGongLingQin,
      接济帑廪:expBreakdown.guokuRescue
    };

    // 历史快照
    n.history.monthly.push({
      turn: GM.turn, balance: n.balance,
      income: n.monthlyIncome, expense: n.monthlyExpense, delta: n.lastDelta
    });
    if (n.history.monthly.length > 120) n.history.monthly = n.history.monthly.slice(-120);

    // 粮布流水（简化）
    updateGrainClothFlow(mr);

    // 危机检查
    checkCrisis(mr);

    // 消费性缓存重置（如 recentConfiscation / recentRewards 等）
    n._recentConfiscation = 0;
  }

  function updateGrainClothFlow(mr) {
    var n = GM.neitang;
    // 内帑粮：朝贡/皇庄的粮食部分
    var grain = n.ledgers.grain;
    var grainIn = (n.sources.huangzhuang * 0.2 + n.sources.tribute * 0.1) / 10 * mr / 12;
    var grainOut = (n.expenses.gongting * 0.3 + n.expenses.shangci * 0.2) / 10 * mr / 12;
    grain.lastTurnIn = Math.round(grainIn);
    grain.lastTurnOut = Math.round(grainOut);
    grain.stock = Math.max(0, (grain.stock || 0) + grainIn - grainOut);

    // 内帑布：织造局、朝贡布帛
    var cloth = n.ledgers.cloth;
    var clothIn = (n.sources.huangchan * 0.15 + n.sources.tribute * 0.2) / 5 * mr / 12;
    var clothOut = (n.expenses.shangci * 0.4 + n.expenses.gongting * 0.1) / 5 * mr / 12;
    cloth.lastTurnIn = Math.round(clothIn);
    cloth.lastTurnOut = Math.round(clothOut);
    cloth.stock = Math.max(0, (cloth.stock || 0) + clothIn - clothOut);
  }

  function checkCrisis(mr) {
    var n = GM.neitang;
    var monthlyReq = n.monthlyExpense;

    if (n.balance < -monthlyReq * 3) {
      // 内帑空竭 3 月支出
      n.crisis.consecutiveMonths = (n.crisis.consecutiveMonths || 0) + mr;
      if (!n.crisis.active) {
        n.crisis.active = true;
        triggerCrisisEvent();
      }
      // 持续空竭 → 宫廷动荡
      if (n.crisis.consecutiveMonths > 3) {
        n.crisis.severity += 0.05 * mr;
        // 内廷腐败暴涨（太监贪污/宫人盗窃）
        if (GM.corruption && GM.corruption.subDepts.imperial) {
          GM.corruption.subDepts.imperial.true = Math.min(100,
            GM.corruption.subDepts.imperial.true + 0.5 * mr);
        }
        if (Math.random() < 0.05 * mr && typeof addEB === 'function') {
          addEB('朝代', '内帑空竭，宫人盗窃成风', { credibility: 'high' });
        }
      }
    } else {
      if (n.crisis.active) {
        n.crisis.consecutiveMonths = Math.max(0, n.crisis.consecutiveMonths - mr);
        if (n.crisis.consecutiveMonths < 1) {
          n.crisis.active = false;
          if (typeof addEB === 'function') addEB('朝代', '内帑渐丰，宫廷复宁', { credibility: 'high' });
        }
      }
    }
  }

  function triggerCrisisEvent() {
    if (typeof addEB === 'function') {
      addEB('朝代', '内帑不足以赡宫廷，皇家体面难维', { credibility: 'high' });
    }
    // 连锁：皇威下降 + 皇家地位减损
    if (GM.huangwei) GM.huangwei.index = Math.max(0, GM.huangwei.index - 5);
    if (GM.huangquan && GM.huangquan.subDims && GM.huangquan.subDims.imperial) {
      GM.huangquan.subDims.imperial.value = Math.max(0, GM.huangquan.subDims.imperial.value - 8);
    }
    GM.neitang.history.events.push({
      turn: GM.turn, type: 'crisis', severity: GM.neitang.crisis.severity
    });
  }

  // ═════════════════════════════════════════════════════════════
  // 动作（Actions）
  // ═════════════════════════════════════════════════════════════

  var Actions = {
    // 帑廪→内帑 转运
    transferFromGuoku: function(amount) {
      ensureNeitangModel();
      amount = amount || 100000;
      if (!GM.guoku) return { success: false, reason: '帑廪未就绪' };
      if (GM.guoku.balance < amount) return { success: false, reason: '帑廪不足' };
      GM.guoku.balance -= amount;
      GM.neitang.balance += amount;
      if (typeof addEB === 'function') addEB('朝代', '帑廪调拨 ' + Math.round(amount/10000) + ' 万两入内帑', { credibility: 'high' });
      return { success: true };
    },

    // 内帑→帑廪 接济
    rescueGuoku: function(amount) {
      ensureNeitangModel();
      amount = amount || 100000;
      if (GM.neitang.balance < amount) return { success: false, reason: '内帑不足' };
      if (!GM.guoku) return { success: false, reason: '帑廪未就绪' };
      GM.neitang.balance -= amount;
      GM.guoku.balance += amount;
      GM.neitang._annualRescueAmount = (GM.neitang._annualRescueAmount || 0) + amount;
      // 皇家德政 → 皇威+ 民心+
      if (GM.huangwei) GM.huangwei.index = Math.min(100, GM.huangwei.index + 3);
      if (GM.minxin) GM.minxin.trueIndex = Math.min(100, GM.minxin.trueIndex + 2);
      if (typeof addEB === 'function') addEB('朝代', '陛下罄内帑 ' + Math.round(amount/10000) + ' 万两济国用，群臣感泣', { credibility: 'high' });
      return { success: true };
    },

    // 启用特别税
    enableSpecialTax: function(type, monthly) {
      ensureNeitangModel();
      type = type || '矿税';
      monthly = monthly || 5000;
      GM.neitang.specialTaxActive = true;
      GM.neitang.specialTaxType = type;
      GM.neitang.specialTaxMonthly = monthly;
      // 民心损（历史上矿税害民）
      if (GM.minxin) GM.minxin.trueIndex = Math.max(0, GM.minxin.trueIndex - 5);
      if (GM.huangwei) GM.huangwei.index = Math.max(0, GM.huangwei.index - 3);
      if (typeof addEB === 'function') addEB('朝代', '开' + type + '，月收 ' + Math.round(monthly/1000) + ' 千两入内帑', { credibility: 'high' });
      return { success: true };
    },

    // 废特别税
    disableSpecialTax: function() {
      ensureNeitangModel();
      if (!GM.neitang.specialTaxActive) return { success: false, reason: '未开启' };
      GM.neitang.specialTaxActive = false;
      if (GM.minxin) GM.minxin.trueIndex = Math.min(100, GM.minxin.trueIndex + 3);
      if (GM.huangwei) GM.huangwei.index = Math.min(100, GM.huangwei.index + 2);
      if (typeof addEB === 'function') addEB('朝代', '罢' + (GM.neitang.specialTaxType || '特别税') + '，民感圣德', { credibility: 'high' });
      return { success: true };
    },

    // 举行大典（用内帑）
    holdCeremony: function(type) {
      ensureNeitangModel();
      type = type || 'zhongshou';  // 中等规模
      var costs = {
        major: 500000,   // 封禅/万寿
        middle: 150000,  // 千叟宴/大飨
        minor: 50000     // 郊祀/常礼
      };
      var gains = { major: 15, middle: 8, minor: 3 };
      var cost = costs[type] || 150000;
      if (GM.neitang.balance < cost) return { success: false, reason: '内帑不足' };
      GM.neitang.balance -= cost;
      GM.neitang._thisYearCeremonyBudget = (GM.neitang._thisYearCeremonyBudget || 0) + cost;
      if (GM.huangwei) GM.huangwei.index = Math.min(100, GM.huangwei.index + (gains[type] || 8));
      if (typeof addEB === 'function') addEB('朝代', '行大典，费内帑 ' + Math.round(cost/10000) + ' 万两', { credibility: 'high' });
      return { success: true };
    },

    // 抄家入内帑（由别处触发，此处记账）
    recordConfiscation: function(amount) {
      ensureNeitangModel();
      amount = amount || 100000;
      GM.neitang._recentConfiscation = (GM.neitang._recentConfiscation || 0) + amount;
      GM.neitang.balance += amount;
      if (typeof addEB === 'function') addEB('朝代', '抄没家产 ' + Math.round(amount/10000) + ' 万两入内帑', { credibility: 'high' });
      return { success: true };
    }
  };

  // ═════════════════════════════════════════════════════════════
  // 年度决算
  // ═════════════════════════════════════════════════════════════

  function yearlySettle() {
    ensureNeitangModel();
    var n = GM.neitang;
    var year = (typeof getCurrentYear === 'function') ? getCurrentYear() : GM.turn;
    var recent = n.history.monthly.slice(-12);
    var totalIn = 0, totalOut = 0;
    recent.forEach(function(m) { totalIn += m.income || 0; totalOut += m.expense || 0; });

    var archive = {
      year: year,
      totalIncome: totalIn,
      totalExpense: totalOut,
      netChange: totalIn - totalOut,
      finalBalance: n.balance,
      sources: Object.assign({}, n.sources),
      expenses: Object.assign({}, n.expenses),
      crisisMonths: n.crisis.consecutiveMonths || 0
    };
    n.history.yearly.push(archive);
    if (n.history.yearly.length > 40) n.history.yearly = n.history.yearly.slice(-40);

    // 清空年度临时累计
    n._thisYearCeremonyBudget = 0;
    n._annualRescueAmount = 0;

    return archive;
  }

  // ═════════════════════════════════════════════════════════════
  // 朝代预设
  // ═════════════════════════════════════════════════════════════

  var DYNASTY_PRESETS = {
    // 相对帑廪的比例
    '秦':   { ratio: 0.15 },
    '汉':   { ratio: 0.12 },
    '魏晋': { ratio: 0.10 },
    '唐':   { ratio: 0.15 },
    '五代': { ratio: 0.08 },
    '北宋': { ratio: 0.10 },
    '南宋': { ratio: 0.10 },
    '元':   { ratio: 0.20 },
    '明':   { ratio: 0.15 },
    '清':   { ratio: 0.25 },  // 清代内帑占比显著（和珅案可见）
    '上古': { ratio: 0.05 },
    '民国': { ratio: 0.08 }
  };

  function initFromDynasty(dynasty, phase, scenarioOverride) {
    ensureNeitangModel();
    var preset = DYNASTY_PRESETS[dynasty];
    if (!preset) {
      for (var k in DYNASTY_PRESETS) {
        if (dynasty && dynasty.indexOf(k) !== -1) { preset = DYNASTY_PRESETS[k]; break; }
      }
    }
    if (!preset) preset = { ratio: 0.12 };

    var guokuBalance = (GM.guoku && GM.guoku.balance) || 1000000;
    var monthlyInc = (GM.guoku && GM.guoku.monthlyIncome) || 80000;

    GM.neitang.balance = Math.round(guokuBalance * preset.ratio);
    GM.neitang.monthlyIncome = Math.round(monthlyInc * preset.ratio);
    GM.neitang.monthlyExpense = Math.round(monthlyInc * preset.ratio * 0.9);
    GM.neitang.ledgers.money.stock = GM.neitang.balance;
    GM.neitang.huangzhuangAcres = Math.round(((GM.hukou || {}).registeredTotal || 1e7) * 0.002);

    // 剧本覆盖
    if (scenarioOverride && scenarioOverride.neitang) {
      var no = scenarioOverride.neitang;
      // 新字段：initialMoney/initialGrain/initialCloth（三列分账）
      if (no.initialMoney !== undefined) {
        GM.neitang.balance = no.initialMoney;
        GM.neitang.ledgers.money.stock = no.initialMoney;
      }
      if (no.initialGrain !== undefined) {
        GM.neitang.ledgers.grain.stock = no.initialGrain;
        GM.neitang.grain = no.initialGrain;
      }
      if (no.initialCloth !== undefined) {
        GM.neitang.ledgers.cloth.stock = no.initialCloth;
        GM.neitang.cloth = no.initialCloth;
      }
      // 月均估计
      if (no.monthlyIncomeEstimate) {
        if (no.monthlyIncomeEstimate.money != null) GM.neitang.monthlyIncome = no.monthlyIncomeEstimate.money;
        if (no.monthlyIncomeEstimate.grain != null) GM.neitang.monthlyGrainIncome = no.monthlyIncomeEstimate.grain;
        if (no.monthlyIncomeEstimate.cloth != null) GM.neitang.monthlyClothIncome = no.monthlyIncomeEstimate.cloth;
      }
      if (no.monthlyExpenseEstimate) {
        if (no.monthlyExpenseEstimate.money != null) GM.neitang.monthlyExpense = no.monthlyExpenseEstimate.money;
        if (no.monthlyExpenseEstimate.grain != null) GM.neitang.monthlyGrainExpense = no.monthlyExpenseEstimate.grain;
        if (no.monthlyExpenseEstimate.cloth != null) GM.neitang.monthlyClothExpense = no.monthlyExpenseEstimate.cloth;
      }
      // 兼容旧字段
      if (no.balance !== undefined) { GM.neitang.balance = no.balance; GM.neitang.ledgers.money.stock = no.balance; }
      if (no.monthlyIncome !== undefined) GM.neitang.monthlyIncome = no.monthlyIncome;
      if (no.huangzhuangAcres !== undefined) GM.neitang.huangzhuangAcres = no.huangzhuangAcres;
      if (no.specialTaxActive !== undefined) GM.neitang.specialTaxActive = no.specialTaxActive;
    }

    return { dynasty: dynasty, ratio: preset.ratio, balance: GM.neitang.balance };
  }

  // ═════════════════════════════════════════════════════════════
  // 主 tick
  // ═════════════════════════════════════════════════════════════

  function tick(context) {
    ensureNeitangModel();
    var mr = (context && context._monthRatio) || getMonthRatio();

    try { monthlySettle(mr); } catch(e) { console.error('[neitang] monthlySettle:', e); }

    // 年末决算
    var dpt = (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 30;
    var curY = Math.floor(GM.turn * dpt / 360);
    var prevY = Math.floor((GM.turn - 1) * dpt / 360);
    if (curY > prevY) {
      try { yearlySettle(); } catch(e) { console.error('[neitang] yearlySettle:', e); }
    }
  }

  // ═════════════════════════════════════════════════════════════
  // 导出
  // ═════════════════════════════════════════════════════════════

  global.NeitangEngine = {
    tick: tick,
    ensureModel: ensureNeitangModel,
    getMonthRatio: getMonthRatio,
    Sources: Sources,
    Expenses: Expenses,
    Actions: Actions,
    monthlySettle: monthlySettle,
    yearlySettle: yearlySettle,
    checkCrisis: checkCrisis,
    initFromDynasty: initFromDynasty,
    DYNASTY_PRESETS: DYNASTY_PRESETS
  };

  console.log('[neitang] 引擎已加载：6 源 + 5 支 + 双向转运 + 大典 + 危机链');

})(typeof window !== 'undefined' ? window : this);
