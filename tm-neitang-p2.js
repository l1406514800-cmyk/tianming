// ═══════════════════════════════════════════════════════════════
// 内帑 P2 补完：S 级 + A 级
// 依赖：tm-neitang-engine.js
// 实现：
//   - S1: 5 类 incidentalSources（进奉/议罪银/关税盈余/盐政献纳/贡物变价）
//   - S2: 15 条历史预设（秦汉少府 → 清末反向救济）
//   - S3: royalClanPressure（明代宗室俸禄崩溃）
//   - A1: neicangRules scenario 完整读取
//   - A2: taxDestinationOverrides（盐课等归内帑）
//   - A3: transferResistance（调拨阻力 + 廷议）
// ═══════════════════════════════════════════════════════════════

(function(global) {
  'use strict';

  if (typeof NeitangEngine === 'undefined') {
    console.warn('[neitang-p2] NeitangEngine 未加载');
    return;
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function safe(v, d) { return (v === undefined || v === null) ? (d || 0) : v; }
  function rng(min, max) { return min + Math.random() * (max - min); }

  // ═════════════════════════════════════════════════════════════
  // S1: 5 类 incidentalSources
  // ═════════════════════════════════════════════════════════════

  var INCIDENTAL_TEMPLATES = {
    regional_tribute: {
      id: 'regional_tribute', name: '诸道进奉',
      historical: '唐德宗建中后，节度使以"羡余"进奉大盈库',
      defaultMode: 'random_monthly',
      defaultRange: [50000, 500000],
      // 每月检查，概率 30%
      monthlyProb: 0.3,
      side: { huangquan: -0.2, minxin: -0.3 }  // 地方借进奉坐大，民心负
    },
    yizui_yin: {
      id: 'yizui_yin', name: '议罪银',
      historical: '乾隆朝官员"议罪"缴银赎罪入内帑',
      defaultMode: 'event_driven',
      defaultRange: [30000, 300000],
      monthlyProb: 0.15,
      side: { corruption_imperial: +0.5, minxin: -0.2 }  // 法制松动，腐败升
    },
    guanshui_yingyu: {
      id: 'guanshui_yingyu', name: '关税盈余',
      historical: '粤海关盈余解内务府（清中期）',
      defaultMode: 'percent_over_quota',
      defaultPercent: 0.20,
      quarterlyProb: 0.8
    },
    yanzheng_gongxian: {
      id: 'yanzheng_gongxian', name: '盐政献纳',
      historical: '两淮盐商年献额银，明清皆有',
      defaultMode: 'fixed_annual',
      defaultAmount: 300000,
      side: { corruption_fiscal: +1 }  // 盐商捐输长期化催生腐败集团
    },
    gongpin_bianjia: {
      id: 'gongpin_bianjia', name: '外国贡物变价',
      historical: '四夷朝贡物品变卖银入内帑',
      defaultMode: 'random_annual',
      defaultRange: [20000, 200000]
    }
  };

  function processIncidentalSources(mr) {
    if (!GM.neitang) return;
    var rules = GM.neitang.neicangRules || {};
    var active = rules.incidentalSources || [];
    if (active.length === 0) return;

    active.forEach(function(src) {
      var tpl = INCIDENTAL_TEMPLATES[src.id];
      if (!tpl) return;
      var mode = src.mode || tpl.defaultMode;
      var income = 0;
      var tickProb = (tpl.monthlyProb || 0.3) * mr;

      if (mode === 'random_monthly') {
        if (Math.random() < tickProb) {
          var range = src.amountRange || tpl.defaultRange;
          income = Math.round(rng(range[0], range[1]));
        }
      } else if (mode === 'random_annual') {
        // 年度一次（近似：每月 1/12 概率）
        if (Math.random() < (1/12) * mr) {
          var range2 = src.amountRange || tpl.defaultRange;
          income = Math.round(rng(range2[0], range2[1]));
        }
      } else if (mode === 'fixed_annual') {
        // 按月均摊
        income = Math.round((src.amount || tpl.defaultAmount) * mr / 12);
      } else if (mode === 'percent_over_quota') {
        // 取关税盈余的 X%（需有"超额"机制，简化：读 customs 超额）
        var customsOverage = safe(GM.fiscal && GM.fiscal.customsOverage, 0);
        if (customsOverage > 0 && Math.random() < 0.25 * mr) {
          income = Math.round(customsOverage * (src.percent || tpl.defaultPercent));
          GM.fiscal.customsOverage = 0;  // 清零
        }
      } else if (mode === 'event_driven') {
        // 由事件触发，这里只做小概率被动触发（简化）
        if (Math.random() < tickProb * 0.5) {
          var range3 = src.amountRange || tpl.defaultRange;
          income = Math.round(rng(range3[0], range3[1]));
        }
      }

      if (income > 0) {
        GM.neitang.balance += income;
        GM.neitang._recentIncidental = (GM.neitang._recentIncidental || 0) + income;
        // 副作用
        var side = src.side || tpl.side || {};
        if (side.huangquan && GM.huangquan) GM.huangquan.index = clamp(GM.huangquan.index + side.huangquan * mr, 0, 100);
        if (side.minxin && GM.minxin) GM.minxin.trueIndex = clamp(GM.minxin.trueIndex + side.minxin * mr, 0, 100);
        if (side.corruption_imperial && GM.corruption && GM.corruption.subDepts.imperial) {
          GM.corruption.subDepts.imperial.true = clamp(GM.corruption.subDepts.imperial.true + side.corruption_imperial * mr, 0, 100);
        }
        if (side.corruption_fiscal && GM.corruption && GM.corruption.subDepts.fiscal) {
          GM.corruption.subDepts.fiscal.true = clamp(GM.corruption.subDepts.fiscal.true + side.corruption_fiscal * mr, 0, 100);
        }
        if (typeof addEB === 'function') {
          addEB('朝代', tpl.name + '入内帑 ' + Math.round(income/10000) + ' 万两', {
            credibility: 'high'
          });
        }
      }
    });
  }

  // ═════════════════════════════════════════════════════════════
  // S2: 15 条历史预设
  // ═════════════════════════════════════════════════════════════

  var DETAILED_PRESETS = {
    'shaofu_qinhan': {
      name: '秦汉初·少府制',
      historical: '山海池泽归少府（内帑）；算赋田租归国库',
      ratio: 0.22,
      rules: {
        taxDestinationOverrides: { salt: 'neicang', iron: 'neicang', mining: 'neicang' },
        transferResistance: { guokuToNeicang: 0.5, neicangToGuoku: 0.3 }
      }
    },
    'hanwu_yantie': {
      name: '汉武帝·盐铁国有',
      historical: '盐铁酒收归国库；贡献抄没仍归内帑',
      ratio: 0.12,
      rules: {
        taxDestinationOverrides: { salt: 'guoku', iron: 'guoku', wine: 'guoku' },
        transferResistance: { guokuToNeicang: 0.3 }
      }
    },
    'tang_early_clear': {
      name: '唐初·内外分明',
      historical: '租庸调全入国库；皇庄/矿冶入内帑',
      ratio: 0.10,
      rules: {
        transferResistance: { guokuToNeicang: 0.4, neicangToGuoku: 0.2 }
      }
    },
    'tang_late_xianyu': {
      name: '唐后期·羡余泛滥',
      historical: '诸道进奉大盈库；宦官掌内库；中央权威衰',
      ratio: 0.25,
      rules: {
        incidentalSources: [
          { id: 'regional_tribute', mode: 'random_monthly', amountRange: [80000, 600000] }
        ],
        transferResistance: { guokuToNeicang: 0.8, neicangToGuoku: 0.7 }  // 宦官把持
      }
    },
    'song_feng_zhuang': {
      name: '宋·封桩上供',
      historical: '内藏库定额上供；封桩济边成制度',
      ratio: 0.15,
      rules: {
        autoTransfers: [
          { from: 'guoku.money', to: 'neicang.money', mode: 'fixed', amount: 60000, cadence: 'monthly', reason: '上供内藏' }
        ],
        transferResistance: { guokuToNeicang: 0.3, neicangToGuoku: 0.2 }
      }
    },
    'yuan_tuoxia': {
      name: '元·投下分地',
      historical: '税粮入户部；五户丝入诸王；抄没入内帑',
      ratio: 0.18,
      rules: {
        taxDestinationOverrides: { wusihou: 'neicang' }
      }
    },
    'ming_jinhua': {
      name: '明初·金花银制',
      historical: '正统七年（1442）漕粮折银 100 万两定额入内承运库',
      ratio: 0.18,
      rules: {
        autoTransfers: [
          { from: 'guoku.money', to: 'neicang.money', mode: 'fixed', amount: Math.round(1000000/12), cadence: 'monthly', reason: '金花银' }
        ]
      }
    },
    'ming_mid_huangzhuang': {
      name: '明中·皇庄盐课内输',
      historical: '皇庄 300 余处；两淮盐课 68 万两中 10 万解内库',
      ratio: 0.20,
      rules: {
        autoTransfers: [
          { from: 'guoku.money', to: 'neicang.money', mode: 'fixed', amount: Math.round(100000/12), cadence: 'monthly', reason: '盐课内解' }
        ],
        royalClanPressure: { enabled: true, basePopulation: 20000, stipendPerCapita: 50 }
      }
    },
    'ming_late_mining': {
      name: '明末·矿税横行',
      historical: '万历 24-34 年矿税 569 万两全入内库；抄家入内承运',
      ratio: 0.30,
      rules: {
        incidentalSources: [
          { id: 'regional_tribute', mode: 'random_monthly', amountRange: [100000, 800000] }
        ],
        taxDestinationOverrides: { mining: 'neicang', customs: 'neicang' },
        royalClanPressure: { enabled: true, basePopulation: 80000, stipendPerCapita: 50,
          growthRatePerYear: 0.015 }
      }
    },
    'qing_early_neiwu': {
      name: '清初·内务府初制',
      historical: '皇庄/贡入内务府；户部主大宗',
      ratio: 0.15,
      rules: {
        transferResistance: { guokuToNeicang: 0.2, neicangToGuoku: 0.15 }
      }
    },
    'qing_mid_yizui': {
      name: '清中·盈余议罪',
      historical: '乾隆朝粤海关盈余入内务府；议罪银直入；和珅时代',
      ratio: 0.28,
      rules: {
        incidentalSources: [
          { id: 'yizui_yin', mode: 'event_driven', amountRange: [50000, 300000] },
          { id: 'guanshui_yingyu', mode: 'percent_over_quota', percent: 0.25 },
          { id: 'yanzheng_gongxian', mode: 'fixed_annual', amount: 300000 },
          { id: 'gongpin_bianjia', mode: 'random_annual', amountRange: [30000, 200000] }
        ]
      }
    },
    'qing_late_reverse': {
      name: '清末·反向救济',
      historical: '嘉道咸同，户部反补内务府亏空',
      ratio: 0.10,
      rules: {
        autoTransfers: [
          { from: 'guoku.money', to: 'neicang.money', mode: 'fixed', amount: Math.round(500000/12), cadence: 'monthly', reason: '补内务府亏空' }
        ]
      }
    },
    'no_split': {
      name: '无分账',
      historical: '所有收入入国库；内帑仅自动转账',
      ratio: 0.05,
      rules: {}
    }
  };

  // 按朝代→预设 key 的推荐映射
  var DYNASTY_PRESET_MAP = {
    '秦': ['shaofu_qinhan'],
    '汉': ['shaofu_qinhan', 'hanwu_yantie'],
    '魏晋': ['hanwu_yantie'],
    '唐': ['tang_early_clear', 'tang_early_clear', 'tang_late_xianyu', 'tang_late_xianyu'],  // 开国/全盛/中衰/末世
    '五代': ['tang_late_xianyu'],
    '北宋': ['song_feng_zhuang'],
    '南宋': ['song_feng_zhuang'],
    '元':   ['yuan_tuoxia'],
    '明':   ['ming_jinhua', 'ming_mid_huangzhuang', 'ming_mid_huangzhuang', 'ming_late_mining'],
    '清':   ['qing_early_neiwu', 'qing_mid_yizui', 'qing_mid_yizui', 'qing_late_reverse']
  };

  var PHASE_INDEX = { founding:0, peak:1, decline:2, collapse:3,
    '开国':0, '全盛':1, '守成':1, '中衰':2, '末世':3, '衰落':2 };

  function selectHistoricalPreset(dynasty, phase) {
    var list = DYNASTY_PRESET_MAP[dynasty];
    if (!list) {
      for (var k in DYNASTY_PRESET_MAP) {
        if (dynasty && dynasty.indexOf(k) !== -1) { list = DYNASTY_PRESET_MAP[k]; break; }
      }
    }
    if (!list) return DETAILED_PRESETS['no_split'];
    var pi = PHASE_INDEX[phase] !== undefined ? PHASE_INDEX[phase] : 1;
    var key = list[Math.min(pi, list.length - 1)];
    return DETAILED_PRESETS[key] || DETAILED_PRESETS['no_split'];
  }

  // ═════════════════════════════════════════════════════════════
  // S3: royalClanPressure（明代宗室压力）
  // ═════════════════════════════════════════════════════════════

  function applyRoyalClanPressure(mr) {
    var rules = GM.neitang.neicangRules || {};
    var rcp = rules.royalClanPressure;
    if (!rcp || !rcp.enabled) return;
    if (!GM.neitang._royalClan) {
      GM.neitang._royalClan = {
        population: rcp.basePopulation || 5000,
        startTurn: GM.turn
      };
    }
    var rc = GM.neitang._royalClan;

    // 年增长率（按月累加）
    var monthlyGrowth = Math.pow(1 + (rcp.growthRatePerYear || 0.015), 1/12) - 1;
    rc.population = Math.round(rc.population * Math.pow(1 + monthlyGrowth, mr));

    // 宗室俸禄（每月）
    var stipendPerCapita = rcp.stipendPerCapita || 50;
    var monthlyCost = rc.population * stipendPerCapita / 12 * mr;  // 年折月

    // 默认出帑廪粮（明代）
    var dest = rcp.destination || 'guoku.grain';
    if (dest === 'guoku.grain' && GM.guoku && GM.guoku.ledgers && GM.guoku.ledgers.grain) {
      GM.guoku.ledgers.grain.stock = Math.max(0, GM.guoku.ledgers.grain.stock - monthlyCost / 5);
      // 粮价 5 两/石，等价金额
    } else if (GM.guoku) {
      GM.guoku.balance -= monthlyCost;
    }

    // 崩溃触发
    if (rcp.collapseTrigger) {
      var grainStock = (GM.guoku && GM.guoku.ledgers && GM.guoku.ledgers.grain && GM.guoku.ledgers.grain.stock) || 0;
      var threshold = grainStock * 0.3;
      var annualCost = rc.population * stipendPerCapita;
      if (annualCost > threshold && Math.random() < 0.02 * mr) {
        triggerRoyalClanBankruptcy();
      }
    }

    GM.neitang._royalClan.lastStipendCost = monthlyCost;
  }

  function triggerRoyalClanBankruptcy() {
    if (typeof addEB === 'function') {
      addEB('朝代', '宗室子孙繁衍数十倍，朝廷难以供养，藩王贫极殴夺民产',
        { credibility: 'high' });
    }
    if (GM.minxin) GM.minxin.trueIndex = Math.max(0, GM.minxin.trueIndex - 10);
    if (GM.huangwei) GM.huangwei.index = Math.max(0, GM.huangwei.index - 8);
    if (GM.neitang.history) GM.neitang.history.events.push({
      turn: GM.turn, type: 'royal_clan_bankruptcy'
    });
  }

  // ═════════════════════════════════════════════════════════════
  // A1+A2: neicangRules 完整读取 + taxDestinationOverrides
  // ═════════════════════════════════════════════════════════════

  var _origInit = NeitangEngine.initFromDynasty;
  NeitangEngine.initFromDynasty = function(dynasty, phase, scenarioOverride) {
    var r = _origInit.call(this, dynasty, phase, scenarioOverride);

    // 应用详细历史预设
    if (!GM.neitang.neicangRules) GM.neitang.neicangRules = {};
    var preset = selectHistoricalPreset(dynasty, phase);
    if (preset && preset.rules) {
      // 深合并
      Object.keys(preset.rules).forEach(function(k) {
        if (GM.neitang.neicangRules[k] === undefined) {
          GM.neitang.neicangRules[k] = preset.rules[k];
        }
      });
      GM.neitang._presetName = preset.name;
      GM.neitang._presetHistorical = preset.historical;
    }

    // 剧本 fiscalConfig.neicangRules 完整覆盖
    if (scenarioOverride && scenarioOverride.fiscalConfig && scenarioOverride.fiscalConfig.neicangRules) {
      var scRules = scenarioOverride.fiscalConfig.neicangRules;
      Object.keys(scRules).forEach(function(k) {
        GM.neitang.neicangRules[k] = scRules[k];
      });
    }

    return Object.assign({ preset: preset ? preset.name : null }, r);
  };

  // taxDestinationOverrides：修改帑廪 Sources，让某些税种入内帑
  // 通过包装 GuokuEngine.Sources 实现
  if (typeof GuokuEngine !== 'undefined' && GuokuEngine.Sources) {
    var _origGuokuSources = {};
    Object.keys(GuokuEngine.Sources).forEach(function(key) {
      _origGuokuSources[key] = GuokuEngine.Sources[key];
      GuokuEngine.Sources[key] = function() {
        var rules = (GM.neitang && GM.neitang.neicangRules) || {};
        var overrides = rules.taxDestinationOverrides || {};
        // 若该税被标为 neicang，返回 0（帑廪不收），同时累加到 _redirectedToNeicang
        if (overrides[key] === 'neicang') {
          var orig = _origGuokuSources[key]() || 0;
          if (!GM.neitang._redirectedThisMonth) GM.neitang._redirectedThisMonth = 0;
          GM.neitang._redirectedThisMonth += orig / 12;  // 月度等份
          return 0;
        }
        return _origGuokuSources[key]();
      };
    });
  }

  // ═════════════════════════════════════════════════════════════
  // A3: transferResistance 调拨阻力
  // ═════════════════════════════════════════════════════════════

  var _origTransferFromGuoku = NeitangEngine.Actions.transferFromGuoku;
  NeitangEngine.Actions.transferFromGuoku = function(amount) {
    var rules = (GM.neitang && GM.neitang.neicangRules) || {};
    var resistance = (rules.transferResistance || {}).guokuToNeicang || 0;
    if (resistance > 0) {
      // 阻力 > 0.5 视为需要廷议（简化：概率失败）
      if (Math.random() < resistance * 0.5) {
        if (typeof addEB === 'function') {
          addEB('朝代', '谏官抗议：国用岂可私输内帑？调拨未果', { credibility: 'high' });
        }
        return { success: false, reason: '廷议否决（阻力 ' + resistance.toFixed(2) + '）' };
      }
    }
    return _origTransferFromGuoku.call(this, amount);
  };

  var _origRescueGuoku = NeitangEngine.Actions.rescueGuoku;
  NeitangEngine.Actions.rescueGuoku = function(amount) {
    var rules = (GM.neitang && GM.neitang.neicangRules) || {};
    var resistance = (rules.transferResistance || {}).neicangToGuoku || 0;
    // 内帑→帑廪阻力低得多（皇家德政），只在极端阻力下失败
    if (resistance > 0.7 && Math.random() < (resistance - 0.7)) {
      if (typeof addEB === 'function') {
        addEB('朝代', '宦官/近臣劝阻：内帑不可轻输国用', { credibility: 'medium' });
      }
      return { success: false, reason: '近臣劝阻（阻力 ' + resistance.toFixed(2) + '）' };
    }
    return _origRescueGuoku.call(this, amount);
  };

  // ═════════════════════════════════════════════════════════════
  // 接入 tick
  // ═════════════════════════════════════════════════════════════

  var _origTick = NeitangEngine.tick;
  NeitangEngine.tick = function(context) {
    _origTick.call(this, context);
    var mr = (context && context._monthRatio) ||
             (typeof NeitangEngine.getMonthRatio === 'function' ? NeitangEngine.getMonthRatio() : 1);

    try { processIncidentalSources(mr); } catch(e) { console.error('[neitang-p2] incidental:', e); }
    try { applyRoyalClanPressure(mr); }   catch(e) { console.error('[neitang-p2] royalClan:', e); }

    // 应用被重定向的税收
    if (GM.neitang._redirectedThisMonth && GM.neitang._redirectedThisMonth > 0) {
      GM.neitang.balance += GM.neitang._redirectedThisMonth;
      GM.neitang._redirectedThisMonth = 0;
    }

    // 执行 autoTransfers
    var autos = ((GM.neitang.neicangRules || {}).autoTransfers) || [];
    autos.forEach(function(tr) {
      var cadence = tr.cadence || 'monthly';
      if (cadence === 'monthly') {
        var amt = 0;
        if (tr.mode === 'fixed') amt = (tr.amount || 0) * mr;
        else if (tr.mode === 'percent') amt = (tr.percent || 0) * ((GM.guoku && GM.guoku.monthlyIncome) || 0) * mr;
        if (amt > 0 && GM.guoku && GM.guoku.balance > amt) {
          if (tr.from === 'guoku.money' && tr.to === 'neicang.money') {
            GM.guoku.balance -= amt;
            GM.neitang.balance += amt;
          } else if (tr.from === 'neicang.money' && tr.to === 'guoku.money') {
            if (GM.neitang.balance > amt) {
              GM.neitang.balance -= amt;
              GM.guoku.balance += amt;
            }
          }
        }
      }
    });
  };

  // ═════════════════════════════════════════════════════════════
  // 导出
  // ═════════════════════════════════════════════════════════════

  NeitangEngine.INCIDENTAL_TEMPLATES = INCIDENTAL_TEMPLATES;
  NeitangEngine.DETAILED_PRESETS = DETAILED_PRESETS;
  NeitangEngine.DYNASTY_PRESET_MAP = DYNASTY_PRESET_MAP;
  NeitangEngine.selectHistoricalPreset = selectHistoricalPreset;
  NeitangEngine.processIncidentalSources = processIncidentalSources;
  NeitangEngine.applyRoyalClanPressure = applyRoyalClanPressure;

  console.log('[neitang-p2] 加载：5 进奉类 + 13 预设 + 宗室压力 + 调拨阻力 + 税种重定向');

})(typeof window !== 'undefined' ? window : this);
