// ═══════════════════════════════════════════════════════════════
// 帑廪 P1 补完模块
// 依赖：tm-guoku-engine.js + tm-guoku-p2.js
// 实现：
//   - 补充 M 改革作为游戏内动作（两税法/方田均税/一条鞭/摊丁入亩）
//   - 决策 C 税种勾选 + 自定义
//   - 决策 B 单位读剧本
//   - 补充 I 物价浮动（粮价/物价 → 军饷成本）
//   - 决策 D AI 诏令金额（紧急措施自然语言输入）
//   - 补充 H 铸币细化（减重/私铸禁/通宝新铸）
// ═══════════════════════════════════════════════════════════════

(function(global) {
  'use strict';

  if (typeof GuokuEngine === 'undefined') {
    console.warn('[guoku-p4] GuokuEngine 未加载');
    return;
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function safe(v, d) { return (v === undefined || v === null) ? (d || 0) : v; }

  // ═════════════════════════════════════════════════════════════
  // 补充 M · 四大历史改革
  // ═════════════════════════════════════════════════════════════

  var FISCAL_REFORMS = {
    twoTax: {
      id: 'twoTax',
      name: '两税法',
      historical: '唐德宗建中元年（780）杨炎',
      desc: '合并租庸调为夏秋两征，以资产为本，赋税制度化。',
      prerequisites: { huangquan: 45, huangwei: 50, minxin: 40 },
      durationMonths: 12,
      effects: {
        sourceMultipliers: { tianfu: 1.3, dingshui: 0 },  // 丁税并入田赋
        corruptionDelta: { fiscal: -5, provincial: -3 },
        minxinDelta: 3,
        huangweiDelta: 5,
        note: '赋税制度化，暗中豪强抵制'
      }
    },
    fieldEquity: {
      id: 'fieldEquity',
      name: '方田均税法',
      historical: '宋神宗熙宁五年（1072）王安石',
      desc: '丈量田亩、均摊赋税、清隐田。',
      prerequisites: { huangquan: 55, huangwei: 60, minxin: 35 },
      durationMonths: 18,
      effects: {
        sourceMultipliers: { tianfu: 1.15 },
        corruptionDelta: { provincial: -8 },
        hiddenHouseholdDelta: -0.2,  // 减 20% 隐户
        minxinDelta: -3,              // 豪强怨望
        huangweiDelta: 3,
        note: '清查田亩，豪强隐瞒之弊减，但豪强心离'
      }
    },
    oneWhip: {
      id: 'oneWhip',
      name: '一条鞭法',
      historical: '明万历九年（1581）张居正',
      desc: '合并田赋丁役杂派，一切征银。',
      prerequisites: { huangquan: 60, huangwei: 60, minxin: 45 },
      durationMonths: 24,
      effects: {
        sourceMultipliers: { tianfu: 1.2, dingshui: 0 },
        corruptionDelta: { fiscal: -5, provincial: -3 },
        minxinDelta: 5,
        huangweiDelta: 8,
        requiresSilver: true,
        note: '赋役合并征银，简化财政，促进货币经济'
      }
    },
    tanDingRuMu: {
      id: 'tanDingRuMu',
      name: '摊丁入亩',
      historical: '清康熙末至雍正初',
      desc: '废除千年丁税，全摊田亩。',
      prerequisites: { huangquan: 65, huangwei: 70 },
      durationMonths: 36,
      effects: {
        sourceMultipliers: { tianfu: 1.35, dingshui: 0 },
        corruptionDelta: { fiscal: -3 },
        populationGrowthBonus: 0.1,  // 10% 户口增速（无丁税避丁之忧）
        minxinDelta: 8,
        huangweiDelta: 10,
        note: '人地分离，废千年丁税，利户口登记'
      }
    }
  };

  function canEnactReform(reformId) {
    var r = FISCAL_REFORMS[reformId];
    if (!r) return { can: false, reason: '未知改革' };
    // 已施行？
    var ongoing = (GM.guoku && GM.guoku.ongoingReforms) || [];
    if (ongoing.some(function(o) { return o.id === reformId; })) {
      return { can: false, reason: '已在施行或已完成' };
    }
    var completed = (GM.guoku && GM.guoku.completedReforms) || [];
    if (completed.indexOf(reformId) !== -1) {
      return { can: false, reason: '已完成' };
    }
    // 前提
    var pre = r.prerequisites || {};
    var fails = [];
    if (pre.huangquan !== undefined && GM.huangquan && GM.huangquan.index < pre.huangquan)
      fails.push('皇权 ' + Math.round(GM.huangquan.index) + '/' + pre.huangquan);
    if (pre.huangwei !== undefined && GM.huangwei && GM.huangwei.index < pre.huangwei)
      fails.push('皇威 ' + Math.round(GM.huangwei.index) + '/' + pre.huangwei);
    if (pre.minxin !== undefined && GM.minxin && GM.minxin.trueIndex < pre.minxin)
      fails.push('民心 ' + Math.round(GM.minxin.trueIndex) + '/' + pre.minxin);
    if (fails.length > 0) return { can: false, reason: '前提不足：' + fails.join('、') };
    return { can: true };
  }

  function enactReform(reformId) {
    var check = canEnactReform(reformId);
    if (!check.can) return { success: false, reason: check.reason };
    var r = FISCAL_REFORMS[reformId];
    GuokuEngine.ensureModel();
    if (!GM.guoku.ongoingReforms) GM.guoku.ongoingReforms = [];
    if (!GM.guoku.completedReforms) GM.guoku.completedReforms = [];

    GM.guoku.ongoingReforms.push({
      id: reformId,
      startTurn: GM.turn,
      endTurn: GM.turn + ((typeof turnsForMonths === 'function')
               ? turnsForMonths(r.durationMonths) : r.durationMonths)
    });

    // 施行期财政扰动（每月支出 +15% 管理费用）
    if (typeof addEB === 'function') {
      addEB('朝代', '颁行' + r.name + '——' + r.desc, { credibility: 'high' });
    }
    return { success: true, reform: r };
  }

  function tickReforms(context) {
    var mr = (context && context._monthRatio) ||
             (typeof GuokuEngine.getMonthRatio === 'function' ? GuokuEngine.getMonthRatio() : 1);
    var ongoing = (GM.guoku && GM.guoku.ongoingReforms) || [];
    if (ongoing.length === 0) return;
    var remaining = [];
    ongoing.forEach(function(o) {
      if (GM.turn >= o.endTurn) {
        // 完成，应用永久效果
        var r = FISCAL_REFORMS[o.id];
        if (!r) return;
        var eff = r.effects || {};

        // 源乘数（永久）
        if (!GM.guoku.sourceMultipliers) GM.guoku.sourceMultipliers = {};
        if (eff.sourceMultipliers) {
          for (var k in eff.sourceMultipliers) {
            GM.guoku.sourceMultipliers[k] = eff.sourceMultipliers[k];
          }
        }
        // 腐败扣减
        if (eff.corruptionDelta && GM.corruption && GM.corruption.subDepts) {
          for (var d in eff.corruptionDelta) {
            if (GM.corruption.subDepts[d]) {
              GM.corruption.subDepts[d].true = Math.max(0,
                GM.corruption.subDepts[d].true + eff.corruptionDelta[d]);
            }
          }
        }
        // 隐户减少
        if (eff.hiddenHouseholdDelta && GM.hukou) {
          GM.hukou.estimatedHidden = Math.max(0,
            (GM.hukou.estimatedHidden || 0) * (1 + eff.hiddenHouseholdDelta));
          // 部分"隐户"显形 → 在籍户口 +
          var found = -(GM.hukou.estimatedHidden || 0) * eff.hiddenHouseholdDelta;
          GM.hukou.registeredTotal += Math.floor(found);
        }
        // 人口增速（长期效果，留 hook）
        if (eff.populationGrowthBonus && GM.hukou) {
          GM.hukou.growthBonus = (GM.hukou.growthBonus || 0) + eff.populationGrowthBonus;
        }
        // 民心/皇威
        if (eff.minxinDelta && GM.minxin) {
          GM.minxin.trueIndex = clamp(GM.minxin.trueIndex + eff.minxinDelta, 0, 100);
        }
        if (eff.huangweiDelta && GM.huangwei) {
          GM.huangwei.index = clamp(GM.huangwei.index + eff.huangweiDelta, 0, 100);
        }
        GM.guoku.completedReforms.push(o.id);
        if (typeof addEB === 'function') {
          addEB('朝代', r.name + ' 施行既毕，' + eff.note, { credibility: 'high' });
        }
      } else {
        // 施行期每月扰动：帑廪月支增 8%（行政成本）
        if (GM.guoku) GM.guoku.balance -= (GM.guoku.monthlyIncome || 0) * 0.08 * mr;
        remaining.push(o);
      }
    });
    GM.guoku.ongoingReforms = remaining;
  }

  // ═════════════════════════════════════════════════════════════
  // 决策 C 税种勾选（扩展 Sources）
  // ═════════════════════════════════════════════════════════════

  // 包装 GuokuEngine.Sources — 若 scenario 禁用某税则返回 0
  var _origSources = GuokuEngine.Sources;
  var _wrappedSources = {};
  Object.keys(_origSources).forEach(function(key) {
    _wrappedSources[key] = function() {
      // 剧本可配：scriptData.fiscalConfig.taxesEnabled.<key>
      var cfg = ((typeof P !== 'undefined' && P.fiscalConfig) || (GM.fiscalConfig) || {}).taxesEnabled;
      if (cfg && cfg[key] === false) return 0;
      // 改革源乘数
      var val = _origSources[key]() || 0;
      var mults = (GM.guoku && GM.guoku.sourceMultipliers) || {};
      if (mults[key] !== undefined) val *= mults[key];
      return val;
    };
  });
  GuokuEngine.Sources = _wrappedSources;

  // ═════════════════════════════════════════════════════════════
  // 决策 B 单位读剧本
  // ═════════════════════════════════════════════════════════════

  var _origInit = GuokuEngine.initFromDynasty;
  GuokuEngine.initFromDynasty = function(dynasty, phase, scenarioOverride) {
    var r = _origInit.call(this, dynasty, phase, scenarioOverride);
    // 读取单位
    var fc = (scenarioOverride && scenarioOverride.fiscalConfig) || null;
    if (fc && fc.unit) {
      if (fc.unit.money) GM.guoku.unit.money = fc.unit.money;
      if (fc.unit.grain) GM.guoku.unit.grain = fc.unit.grain;
      if (fc.unit.cloth) GM.guoku.unit.cloth = fc.unit.cloth;
    }
    return r;
  };

  // ═════════════════════════════════════════════════════════════
  // 补充 I 物价浮动
  // ═════════════════════════════════════════════════════════════

  function updatePriceIndex(mr) {
    if (!GM.prices) GM.prices = { grain:1.0, cloth:1.0, general:1.0 };

    // 粮价 = f(库存 vs 需求 + 通胀)
    var g = GM.guoku;
    var grainStock = (g.ledgers.grain && g.ledgers.grain.stock) || 0;
    var annualNeed = ((GM.hukou || {}).registeredTotal || 1e7) * 0.6;  // 人均 0.6 石/年
    var stockRatio = grainStock / Math.max(1, annualNeed);
    // 库存低 → 粮价涨
    var stockFactor = stockRatio < 0.3 ? 1.8 :
                      stockRatio < 0.6 ? 1.3 :
                      stockRatio < 1.0 ? 1.0 : 0.9;

    // 通胀因素
    var inflationFactor = 1.0;
    if (GM.currency && GM.currency.inflationPressure) {
      inflationFactor = 1 + GM.currency.inflationPressure * 0.2;
    }
    // 灾情期间
    if (GM.activeDisasters && GM.activeDisasters.length > 0) {
      stockFactor *= (1 + GM.activeDisasters.length * 0.15);
    }

    var targetGrain = stockFactor * inflationFactor;
    // 平滑
    GM.prices.grain = GM.prices.grain * 0.8 + targetGrain * 0.2;
    GM.prices.cloth = GM.prices.cloth * 0.9 + inflationFactor * 0.1;
    GM.prices.general = (GM.prices.grain + GM.prices.cloth) / 2;

    // 军饷成本因粮价变化
    if (GM.prices.grain > 1.5 && GM.guoku.expenses) {
      // 粮价高 → 军饷实际成本高
      GM.guoku._militaryCostMultiplier = GM.prices.grain;
    } else {
      GM.guoku._militaryCostMultiplier = 1;
    }

    // 粮价飞涨时民心跌
    if (GM.prices.grain > 2.0 && GM.minxin) {
      var impact = -(GM.prices.grain - 2.0) * 3 * mr;
      GM.minxin.trueIndex = Math.max(0, GM.minxin.trueIndex + impact);
      if (Math.random() < 0.1 * mr && typeof addEB === 'function') {
        addEB('事件', '粮价涨至 ' + GM.prices.grain.toFixed(2) + ' 倍，民生艰难',
              { credibility: 'high' });
      }
    }
  }

  // ═════════════════════════════════════════════════════════════
  // 决策 D AI 诏令金额（紧急措施自然语言输入）
  // ═════════════════════════════════════════════════════════════

  async function aiParseFiscalDecree(decreeText, actionType) {
    var isAvail = (typeof callAI === 'function') && P && P.ai && P.ai.key;
    if (!isAvail) return null;

    var hint = {
      extraTax:   '判断加派税率（0.0-1.0，如 0.3 表示三成）',
      openGranary:'判断赈济规模（county/regional/national）',
      takeLoan:   '判断借贷金额（以两为单位）与月限',
      cutOfficials:'判断裁员比例（0.0-1.0）',
      reduceTax:  '判断减赋比例（0.0-1.0）',
      issuePaperCurrency: '判断发钞金额（以两为单位）'
    }[actionType] || '判断合理参数';

    var prompt = '你是财政辅政大臣。玩家颁下诏令："' + decreeText + '"。' +
      '请' + hint + '。以 JSON 回复：' +
      '{"amount":数值, "reason":"短解释"}。只输出 JSON。';

    try {
      var resp = await callAI(prompt, 200);
      var m = (resp || '').match(/\{[\s\S]*\}/);
      if (!m) return null;
      return JSON.parse(m[0]);
    } catch(e) {
      console.warn('[guoku-p4] aiParseFiscalDecree:', e.message);
      return null;
    }
  }

  // ═════════════════════════════════════════════════════════════
  // 补充 H 铸币细化
  // ═════════════════════════════════════════════════════════════

  var MintingActions = {
    // 减重改铸（提升铸币利润但伤民信）
    lightCoining: function(reduction) {
      reduction = reduction || 0.2;  // 默认减重 20%
      var g = GM.guoku;
      // 一次性铸币收入
      var boost = (g.monthlyIncome || 0) * 3 * reduction;
      g.balance += boost;
      // 通胀压力
      if (!GM.currency) GM.currency = {};
      GM.currency.inflationPressure = (GM.currency.inflationPressure || 0) + reduction * 0.5;
      if (GM.huangwei) GM.huangwei.index = Math.max(0, GM.huangwei.index - reduction * 15);
      if (GM.minxin) GM.minxin.trueIndex = Math.max(0, GM.minxin.trueIndex - reduction * 8);
      if (typeof addEB === 'function')
        addEB('朝代', '减重改铸：新钱成色降 ' + Math.round(reduction*100) + '%，市面疑虑',
              { credibility: 'high' });
      return { success: true, revenue: boost };
    },

    // 严禁私铸
    banPrivateMint: function() {
      if (!GM.currency) GM.currency = {};
      GM.currency.privateCastBanned = true;
      // 私铸严禁 → 腐败增（监察压力+寻租空间）
      if (GM.corruption && GM.corruption.subDepts.fiscal) {
        GM.corruption.subDepts.fiscal.true = Math.min(100,
          GM.corruption.subDepts.fiscal.true + 3);
      }
      if (typeof addEB === 'function')
        addEB('朝代', '严禁私铸——私钱匠徒法严诛',
              { credibility: 'high' });
      return { success: true };
    },

    // 新铸通宝（改善货币信用）
    newCoining: function(name) {
      name = name || '通宝';
      if (!GM.currency) GM.currency = {};
      GM.currency.inflationPressure = Math.max(0, (GM.currency.inflationPressure || 0) - 0.3);
      GM.currency.latestCoin = name;
      var cost = 100000;
      if (GM.guoku) GM.guoku.balance -= cost;
      if (GM.huangwei) GM.huangwei.index = Math.min(100, GM.huangwei.index + 5);
      if (typeof addEB === 'function')
        addEB('朝代', '新铸"' + name + '"钱，成色精良，民信渐复',
              { credibility: 'high' });
      return { success: true, cost: cost };
    }
  };

  // ═════════════════════════════════════════════════════════════
  // 接入 tick
  // ═════════════════════════════════════════════════════════════

  var _origTick = GuokuEngine.tick;
  GuokuEngine.tick = function(context) {
    _origTick.call(this, context);
    try { tickReforms(context); } catch(e) { console.error('[guoku-p4] tickReforms:', e); }
    try { updatePriceIndex((context && context._monthRatio) || 1); } catch(e) { console.error('[guoku-p4] prices:', e); }
  };

  // ═════════════════════════════════════════════════════════════
  // 军饷乘粮价（A 级补完）
  // 粮价高时军饷实际支出按 _militaryCostMultiplier 乘算
  // ═════════════════════════════════════════════════════════════

  var _origJunxiang = GuokuEngine.Expenses.junxiang;
  GuokuEngine.Expenses.junxiang = function() {
    var base = _origJunxiang() || 0;
    var mult = (GM.guoku && GM.guoku._militaryCostMultiplier) || 1;
    return base * mult;
  };

  // ═════════════════════════════════════════════════════════════
  // 年度决算增强：加入地域分账快照（决策 G）
  // ═════════════════════════════════════════════════════════════

  var _origYearlySettle = GuokuEngine.yearlySettle;
  GuokuEngine.yearlySettle = function() {
    var archive = _origYearlySettle.call(this);
    if (archive && GM.guoku.byRegion) {
      archive.byRegion = {};
      Object.keys(GM.guoku.byRegion).forEach(function(rid) {
        var r = GM.guoku.byRegion[rid];
        archive.byRegion[rid] = {
          name: r.name,
          stock: r.stock,
          cumIn: r.cumIn,
          cumOut: r.cumOut,
          net: (r.cumIn || 0) - (r.cumOut || 0)
        };
        // 重置累计（新年开始）
        r.cumIn = 0;
        r.cumOut = 0;
      });
    }
    return archive;
  };

  // 导出
  GuokuEngine.FISCAL_REFORMS = FISCAL_REFORMS;
  GuokuEngine.canEnactReform = canEnactReform;
  GuokuEngine.enactReform = enactReform;
  GuokuEngine.tickReforms = tickReforms;
  GuokuEngine.updatePriceIndex = updatePriceIndex;
  GuokuEngine.aiParseFiscalDecree = aiParseFiscalDecree;
  GuokuEngine.MintingActions = MintingActions;

  console.log('[guoku-p4] 加载：4 大改革 + 税种勾选 + 单位读剧本 + 物价浮动 + AI 诏令 + 铸币');

})(typeof window !== 'undefined' ? window : this);
