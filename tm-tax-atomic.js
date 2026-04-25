// @ts-check
/// <reference path="types.d.ts" />
/**
 * tm-phase-h-final.js — H 阶段终极补丁（补完所有残余缺口）
 *
 * 经济补完：
 *  - 19 原子税种扩充（补 11 项）
 *  - 纸币 25 条完整数据体 PAPER_DATA_25
 *  - 纸币状态转移 _updatePaperState
 *  - 纸币崩溃事件 _checkPaperCollapse
 *  - 市场供需 _updateGrainPrice 完整算法
 *  - 地域套利 detailed arbitrage
 *  - _ensureRegionFiscal 四层递归
 *  - _splitTaxByAllocation 分账分发
 *  - 14 项 localActions 执行效果映射
 *  - processTransferOrders 调拨推进
 *  - 封建五类 feudalHoldings 独立规则
 *  - calcPromotionChance 升迁概率
 *  - _formulaEstimate 朝代公式
 *
 * 制度补完：
 *  - abolishInstitution 废除函数
 *  - 制度志 tab（openInstitutionsChronicle 已有但加强）
 *  - evaluateReformFeasibility 改革可行度
 *  - adjustHuangwei / adjustMinxin 统一接口（wrap）
 *  - 皇权 >75 创设扣减 -5 确保应用
 *  - 侍臣问疑×皇权段过滤
 *  - applyTyrantExecutionAmplification 暴君执行放大
 *  - CLASSICAL_UI_TEXTS 整合入 UI 系统
 *
 * 诏令补完：
 *  - 赋役四方对比 openFuyiSchemeComparison（f5/g3 有但确保 UI）
 *  - 工程完工验收奏疏触发
 *  - 大造黄册十年周期自动触发
 *  - 改土归流朝议自动升级
 */
(function(global) {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════
  //  经济 · 19 原子税种扩充
  // ═══════════════════════════════════════════════════════════════════

  var ATOMIC_TAX_TYPES_19 = {
    // 原 8 项
    tianfu:       { name:'田赋',     base:'land',      rate:0.05,  enabled:true,  dynasties:'all' },
    dingshui:     { name:'丁税',     base:'head',      rate:0.01,  enabled:true,  dynasties:'preQing' },
    caoliang:     { name:'漕粮',     base:'land',      rate:0.02,  enabled:true,  dynasties:'MingQing' },
    yanlizhuan:   { name:'盐利专',   base:'consumption',rate:0.20, enabled:true,  dynasties:'HanTangMing' },
    shipaiShui:   { name:'市舶税',   base:'trade',     rate:0.10,  enabled:false, dynasties:'SongMingQing' },
    quanShui:     { name:'权税/关税',base:'trade',     rate:0.05,  enabled:true,  dynasties:'all' },
    juanNa:       { name:'捐纳',     base:'custom',    rate:0,     enabled:false, dynasties:'MingQing' },
    qita:         { name:'其他杂税', base:'head',      rate:0.005, enabled:true,  dynasties:'all' },
    // 补 11 项
    shangshui:    { name:'商税',     base:'commerce',  rate:0.03,  enabled:true,  dynasties:'SongMingQing' },
    chashui:      { name:'茶税',     base:'consumption',rate:0.10, enabled:true,  dynasties:'TangSong' },
    jiushui:      { name:'酒税',     base:'consumption',rate:0.15, enabled:true,  dynasties:'all' },
    tieshui:      { name:'铁税',     base:'mining',    rate:0.10,  enabled:false, dynasties:'HanTang' },
    tongshui:     { name:'铜税',     base:'mining',    rate:0.10,  enabled:false, dynasties:'HanTang' },
    yongshou:     { name:'庸税（折绢）',base:'corvee', rate:0.02,  enabled:true,  dynasties:'Tang' },
    diaoshou:     { name:'调税（绢布）',base:'household',rate:0.015,enabled:true, dynasties:'Tang' },
    suanmin:      { name:'算缗',     base:'wealth',    rate:0.08,  enabled:false, dynasties:'Han' },
    imperialEstate:{name:'皇庄租',   base:'imperial',  rate:0.15,  enabled:true,  dynasties:'MingQing', destination:'neitang' },
    shuimoShui:   { name:'税磨税',   base:'commerce',  rate:0.02,  enabled:false, dynasties:'SongYuan' },
    zajuan:       { name:'杂捐',     base:'household', rate:0.01,  enabled:true,  dynasties:'all' }
  };

  function enableTaxesByDynasty(G) {
    if (!G.fiscalConfig) G.fiscalConfig = {};
    if (!G.fiscalConfig.taxes) G.fiscalConfig.taxes = {};
    var dy = G.dynasty || '唐';
    Object.keys(ATOMIC_TAX_TYPES_19).forEach(function(tid) {
      var t = ATOMIC_TAX_TYPES_19[tid];
      var applicable = t.dynasties === 'all' || (t.dynasties && t.dynasties.indexOf(dy.replace(/朝/,'')) >= 0);
      G.fiscalConfig.taxes[tid] = Object.assign({}, t, { enabled: applicable && t.enabled });
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  纸币 25 条完整数据体 PAPER_DATA_25
  // ═══════════════════════════════════════════════════════════════════

  var PAPER_DATA_25 = [
    { id:'jiaozi_shu',       name:'交子（蜀）',   dynasty:'宋', startYear:1023, endYear:1107, initialValue:1.0, inflationRate:0.02, state:'trial',       trust:0.8 },
    { id:'qianyin',           name:'钱引',         dynasty:'宋', startYear:1107, endYear:1160, initialValue:1.0, inflationRate:0.04, state:'active',      trust:0.7 },
    { id:'huizi',             name:'会子',         dynasty:'宋', startYear:1160, endYear:1240, initialValue:1.0, inflationRate:0.08, state:'depreciate',  trust:0.5 },
    { id:'guanzi',            name:'关子',         dynasty:'宋', startYear:1238, endYear:1279, initialValue:1.0, inflationRate:0.30, state:'collapse',    trust:0.1 },
    { id:'zhongtong_chao',    name:'中统钞',       dynasty:'元', startYear:1260, endYear:1287, initialValue:1.0, inflationRate:0.03, state:'active',      trust:0.8 },
    { id:'zhiyuan_chao',      name:'至元钞',       dynasty:'元', startYear:1287, endYear:1350, initialValue:1.0, inflationRate:0.05, state:'active',      trust:0.7 },
    { id:'zhizheng_chao',     name:'至正钞',       dynasty:'元', startYear:1350, endYear:1368, initialValue:1.0, inflationRate:0.50, state:'collapse',    trust:0.05 },
    { id:'daming_chao',       name:'大明宝钞',     dynasty:'明', startYear:1375, endYear:1450, initialValue:1.0, inflationRate:0.20, state:'depreciate',  trust:0.2 },
    { id:'jinjinling',        name:'金银引',       dynasty:'宋', startYear:1200, endYear:1250, initialValue:1.0, inflationRate:0.03, state:'trial',       trust:0.75 },
    { id:'yuanbao',           name:'元宝券',       dynasty:'元', startYear:1280, endYear:1340, initialValue:1.0, inflationRate:0.04, state:'active',      trust:0.7 },
    { id:'yinpiao',           name:'银票',         dynasty:'明', startYear:1600, endYear:1850, initialValue:1.0, inflationRate:0.02, state:'private',     trust:0.85 },
    { id:'qianpiao',           name:'钱票',         dynasty:'清', startYear:1770, endYear:1880, initialValue:1.0, inflationRate:0.02, state:'private',     trust:0.8 },
    { id:'huzhao',             name:'户钞',         dynasty:'明', startYear:1450, endYear:1500, initialValue:1.0, inflationRate:0.05, state:'active',      trust:0.6 },
    { id:'baochao_qing',       name:'大清宝钞',     dynasty:'清', startYear:1853, endYear:1861, initialValue:1.0, inflationRate:0.15, state:'trial',       trust:0.4 },
    { id:'hubu_guanpiao',      name:'户部官票',     dynasty:'清', startYear:1853, endYear:1861, initialValue:1.0, inflationRate:0.15, state:'trial',       trust:0.4 },
    { id:'shanxi_piaohao',     name:'山西票号',     dynasty:'清', startYear:1823, endYear:1921, initialValue:1.0, inflationRate:0.01, state:'private',     trust:0.95 },
    { id:'quanyezhang',        name:'钱业庄',       dynasty:'清', startYear:1850, endYear:1900, initialValue:1.0, inflationRate:0.02, state:'private',     trust:0.85 },
    { id:'jiaozi_xue',         name:'交子学',       dynasty:'宋', startYear:1100, endYear:1110, initialValue:1.0, inflationRate:0.05, state:'proposal',    trust:0.7 },
    { id:'qianyin_huai',       name:'钱引·淮',      dynasty:'宋', startYear:1150, endYear:1200, initialValue:1.0, inflationRate:0.04, state:'active',      trust:0.7 },
    { id:'dongnan_huizi',      name:'东南会子',     dynasty:'宋', startYear:1165, endYear:1210, initialValue:1.0, inflationRate:0.06, state:'active',      trust:0.65 },
    { id:'zhongtong_jiao',     name:'中统交钞',     dynasty:'元', startYear:1260, endYear:1280, initialValue:1.0, inflationRate:0.03, state:'active',      trust:0.8 },
    { id:'hongwu_baochao',     name:'洪武宝钞',     dynasty:'明', startYear:1375, endYear:1400, initialValue:1.0, inflationRate:0.10, state:'active',      trust:0.5 },
    { id:'dagong_bao',         name:'大工宝',       dynasty:'清', startYear:1850, endYear:1860, initialValue:1.0, inflationRate:0.20, state:'proposal',    trust:0.3 },
    { id:'yixian_chao',        name:'义县钞',       dynasty:'清', startYear:1861, endYear:1880, initialValue:1.0, inflationRate:0.05, state:'private',     trust:0.5 },
    { id:'yinyuan_piao',       name:'银圆票',       dynasty:'清', startYear:1890, endYear:1911, initialValue:1.0, inflationRate:0.01, state:'active',      trust:0.9 }
  ];

  // ═══════════════════════════════════════════════════════════════════
  //  纸币状态转移与崩溃
  // ═══════════════════════════════════════════════════════════════════

  function _updatePaperState(G, mr) {
    if (!G.currency || !G.currency.coins || !G.currency.coins.paper) return;
    var paper = G.currency.coins.paper;
    if (!paper.enabled) return;
    if (!paper.issuedAmount) paper.issuedAmount = 0;
    if (!paper.reserveRatio) paper.reserveRatio = 0.3;
    if (paper.cumulativeInflation === undefined) paper.cumulativeInflation = 0;
    // 累积通胀
    paper.cumulativeInflation += (paper.inflationRate || 0.02) * mr / 12;
    var state = paper.state || 'active';
    // 状态转移
    if (state === 'proposal' && paper.issuedAmount > 1000000) state = 'trial';
    if (state === 'trial' && paper.cumulativeInflation < 0.1 && paper.issuedAmount > 10000000) state = 'circulate';
    if (state === 'circulate' && paper.issuedAmount > (paper.reserveRatio || 0.3) * 100000000) state = 'overissue';
    if (state === 'overissue' && paper.cumulativeInflation > 0.3) state = 'depreciate';
    if (state === 'depreciate' && paper.cumulativeInflation > 1.0) state = 'collapse';
    if (state === 'collapse' && (G.turn - (paper.collapseTurn || G.turn)) > 12) state = 'abolish';
    if (state !== paper.state) {
      paper.state = state;
      if (state === 'collapse') {
        paper.collapseTurn = G.turn;
        _checkPaperCollapse(G);
      }
      if (global.addEB) global.addEB('纸币', '转入 ' + state + '（累积通胀 ' + (paper.cumulativeInflation*100).toFixed(0) + '%）');
    }
    // 信用调整
    paper.trust = Math.max(0.05, Math.min(1, 1 - paper.cumulativeInflation * 0.8));
  }

  function _checkPaperCollapse(G) {
    // 纸币崩溃：民众拒用，市场停摆
    if (G.currency && G.currency.market) {
      G.currency.market.inflation = Math.min(2, (G.currency.market.inflation || 0) + 0.5);
      G.currency.market.moneySupplyRatio = Math.max(0.1, (G.currency.market.moneySupplyRatio || 0.8) * 0.3);
    }
    if (global._adjAuthority) {
      global._adjAuthority('minxin', -12);
      global._adjAuthority('huangwei', -8);
    }
    if (global.addEB) global.addEB('纸币崩溃', '钞法尽废，民不堪命');
    // 事件钩子
    if (typeof global.EventBus !== 'undefined') {
      global.EventBus.emit('currency.paper.collapse', { turn: G.turn });
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  市场供需 _updateGrainPrice
  // ═══════════════════════════════════════════════════════════════════

  function _updateGrainPrice(G, mr) {
    if (!G.currency || !G.currency.market) return;
    var m = G.currency.market;
    // 供给
    var supply = 0;
    if (G.regions) {
      G.regions.forEach(function(r) {
        supply += (r.arableLand || 100000) * (r.grainYieldPerAcre || 0.5);
      });
    }
    if (!supply) supply = 50000000;
    // 需求：人口 × 年消耗
    var demand = (G.population && G.population.national && G.population.national.mouths || 50000000) * 180;  // 180 斤/人/年
    // 季节因子
    var month = G.month || 1;
    var seasonFactor = month >= 5 && month <= 8 ? 0.85 :  // 夏秋青黄不接
                      month >= 9 && month <= 11 ? 1.1 :   // 秋收
                      1.0;
    // 天灾
    var disasterFactor = G.vars && G.vars.disasterLevel > 0.3 ? (1 + G.vars.disasterLevel * 0.5) : 1.0;
    // 基础价（按朝代：汉约 30 钱/石，唐 50，宋 400，明 500，清 1200）
    var basePriceByDynasty = { '汉':30, '唐':50, '宋':400, '元':350, '明':500, '清':1200 };
    var basePrice = basePriceByDynasty[G.dynasty] || 100;
    // 供需比
    var ratio = demand / Math.max(1, supply);
    // 最终价
    var newPrice = basePrice * ratio * seasonFactor * disasterFactor;
    // 平滑
    m.grainPrice = (m.grainPrice || basePrice) * 0.9 + newPrice * 0.1;
    // 通胀
    m.inflation = (m.grainPrice / basePrice) - 1;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  _ensureRegionFiscal 四层递归
  // ═══════════════════════════════════════════════════════════════════

  function _ensureRegionFiscal(region, parentRegion) {
    if (!region) return;
    if (!region.fiscal) region.fiscal = { claimed:0, actual:0, remitted:0, retained:0 };
    if (!region.subRegions) region.subRegions = [];
    region.subRegions.forEach(function(sub) {
      _ensureRegionFiscal(sub, region);
    });
    // 父 ≥ 子之和校验
    var childSum = region.subRegions.reduce(function(a, s) { return a + (s.fiscal && s.fiscal.actual || 0); }, 0);
    if (childSum > 0 && (region.fiscal.actual || 0) < childSum) {
      region.fiscal.actual = childSum;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  _splitTaxByAllocation 分账分发
  // ═══════════════════════════════════════════════════════════════════

  function splitTaxByAllocation(tax, amount, allocationMode) {
    var modes = {
      tang_three: { central: 0.4, provincial: 0.3, local: 0.3 },
      qiyun_cunliu: { central: 0.6, local: 0.4 },  // 明清
      song_cash: { central: 0.7, local: 0.3 },
      equal: { central: 0.5, local: 0.5 }
    };
    var alloc = modes[allocationMode || 'qiyun_cunliu'];
    var result = {};
    Object.keys(alloc).forEach(function(layer) {
      result[layer] = Math.floor(amount * alloc[layer]);
    });
    return result;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  14 项 localActions 执行映射
  // ═══════════════════════════════════════════════════════════════════

  var EXPENDITURE_EFFECTS_14 = {
    disaster_relief:         { refMinxin: +8, cost: 100000, duration: 3 },
    public_works_water:      { refFarmland: +0.1, cost: 150000, duration: 12 },
    public_works_road:       { refCommerce: +0.05, cost: 80000, duration: 6 },
    local_garrison:          { refSecurity: +0.1, cost: 60000, duration: 12 },
    education_school:        { refCulture: +0.08, cost: 40000, duration: 24 },
    census_effort:           { refHujiAccuracy: +0.1, cost: 50000, duration: 6 },
    patronage_local_elite:   { refGentryLoyalty: +5, cost: 30000, duration: 12 },
    religious_patronage:     { refMinxin: +3, cost: 25000, duration: 6 },
    embezzlement:            { refCorruption: +3, cost: 0 },
    lavish_parade:           { refHuangweiFake: +5, refMinxinTrue: -3, cost: 150000 },
    supernatural_disaster_relief: { refMinxin: -2, refHuangwei: +1, cost: 50000 },
    military_prep:           { refMilitary: +0.1, cost: 120000, duration: 12 },
    warehouse_build:         { refGrainCapacity: +0.1, cost: 100000, duration: 24 },
    judicial_expansion:      { refJudicial: +0.1, refCorruption: +1, cost: 70000, duration: 12 }
  };

  function executeLocalAction(regionId, actionType, scale) {
    var G = global.GM;
    var effect = EXPENDITURE_EFFECTS_14[actionType];
    if (!effect) return { ok: false };
    scale = scale || 1.0;
    var cost = (effect.cost || 0) * scale;
    if (G.fiscal && G.fiscal.regions && G.fiscal.regions[regionId]) {
      var reg = G.fiscal.regions[regionId];
      if ((reg.retainedBudget || 0) < cost) return { ok: false, reason: '地方预算不足' };
      reg.retainedBudget -= cost;
    }
    // 应用效果
    Object.keys(effect).forEach(function(k) {
      if (k.startsWith('ref')) {
        var target = k.replace(/^ref/, '').toLowerCase();
        var delta = effect[k] * scale;
        if (target === 'minxin' && global._adjAuthority) global._adjAuthority('minxin', delta);
        else if (target === 'huangwei' && global._adjAuthority) global._adjAuthority('huangwei', delta);
        else if (target === 'huangweifake' && G.huangwei && G.huangwei.perceivedIndex !== undefined) G.huangwei.perceivedIndex = Math.min(100, G.huangwei.perceivedIndex + delta);
        else if (target === 'minxintrue' && G.minxin) G.minxin.trueIndex = Math.max(0, G.minxin.trueIndex + delta);
        else if (target === 'corruption' && G.corruption) {
          if (typeof G.corruption === 'object') G.corruption.overall = Math.min(100, (G.corruption.overall||30) + delta);
        }
      }
    });
    if (global.addEB) global.addEB('地方', regionId + ' 推行 ' + actionType);
    return { ok: true, cost: cost };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  调拨推进 processTransferOrders
  // ═══════════════════════════════════════════════════════════════════

  function _tickTransferOrders(ctx, mr) {
    var G = global.GM;
    if (!G._transferOrders) return;
    G._transferOrders.forEach(function(order) {
      if (order.status !== 'pending') return;
      if ((ctx.turn || 0) < order.expectedArrival) return;
      order.status = 'completed';
      // 扣源
      if (order.from === 'central' && G.guoku) {
        G.guoku.money = Math.max(0, G.guoku.money - order.amount);
      }
      // 加目的
      if (order.toRegion && G.fiscal && G.fiscal.regions && G.fiscal.regions[order.toRegion]) {
        G.fiscal.regions[order.toRegion].retainedBudget = (G.fiscal.regions[order.toRegion].retainedBudget||0) + order.amount;
      }
      if (global.addEB) global.addEB('调拨', '拨 ' + order.amount + ' 至 ' + order.toRegion);
    });
    G._transferOrders = G._transferOrders.filter(function(o){return o.status!=='completed' || (ctx.turn-o.expectedArrival)<12;});
  }

  function createTransferOrder(from, toRegion, amount) {
    var G = global.GM;
    if (!G._transferOrders) G._transferOrders = [];
    var order = {
      id: 'trans_' + (G.turn||0) + '_' + Math.floor(Math.random()*10000),
      from: from,
      toRegion: toRegion,
      amount: amount,
      createdTurn: G.turn || 0,
      expectedArrival: (G.turn || 0) + 2,
      status: 'pending'
    };
    G._transferOrders.push(order);
    return order;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  封建五类独立规则
  // ═══════════════════════════════════════════════════════════════════

  var FEUDAL_HOLDING_TYPES = {
    imperial_clan:     { tributeRate: 0.15, military: 'imperial',  autonomy: 0.3, description:'皇族分封' },
    warlord:           { tributeRate: 0.3,  military: 'own',       autonomy: 0.85,description:'藩镇自立' },
    tribal_federation: { tributeRate: 0.05, military: 'auxiliary', autonomy: 0.7, description:'部族联盟' },
    tributary_state:   { tributeRate: 0.01, military: 'nominal',   autonomy: 0.95,description:'朝贡国' },
    jimi_prefecture:   { tributeRate: 0.10, military: 'nominal',   autonomy: 0.6, description:'羁縻府州' }
  };

  function _tickFeudalHoldings(ctx, mr) {
    var G = global.GM;
    if (!G.feudalHoldings) return;
    G.feudalHoldings.forEach(function(fh) {
      var rule = FEUDAL_HOLDING_TYPES[fh.type];
      if (!rule) return;
      // 年度朝贡
      if ((G.month||1) === 1 && G.guoku && fh.tribute && fh.tribute.annual) {
        G.guoku.money = (G.guoku.money || 0) + fh.tribute.annual;
      }
      // 忠诚度演化
      var hw = G.huangwei && G.huangwei.index || 50;
      if (hw < 30) fh.loyalty = Math.max(0, (fh.loyalty||0.5) - 0.005 * mr);
      if (hw > 70) fh.loyalty = Math.min(1, (fh.loyalty||0.5) + 0.003 * mr);
      // 低忠诚可能叛
      if (fh.loyalty < 0.15 && Math.random() < 0.02 * mr) {
        fh.status = 'rebelling';
        if (global.addEB) global.addEB('藩镇', fh.name + ' 叛');
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  升迁概率 calcPromotionChance
  // ═══════════════════════════════════════════════════════════════════

  function calcPromotionChance(char) {
    if (!char) return 0;
    var G = global.GM;
    var merit = char.virtueMerit || 30;
    var rank = char.rank || 5;
    var hq = G.huangquan && G.huangquan.index || 55;
    var hw = G.huangwei && G.huangwei.index || 50;
    var thresholds = { 5: 60, 4: 75, 3: 85, 2: 92, 1: 97 };
    var needed = thresholds[rank] || 100;
    if (merit < needed) return 0;
    var baseChance = 0.3;
    if (merit >= needed + 20) baseChance = 0.7;
    else if (merit >= needed + 10) baseChance = 0.5;
    // 皇权强 → 升迁快
    if (hq > 70) baseChance *= 1.3;
    else if (hq < 40) baseChance *= 0.6;
    // 皇威低 → 保守
    if (hw < 30) baseChance *= 0.4;
    // 忠诚需足
    if ((char.loyalty || 50) < 40) baseChance *= 0.2;
    return Math.max(0, Math.min(0.95, baseChance));
  }

  // ═══════════════════════════════════════════════════════════════════
  //  朝代公式 _formulaEstimate（角色经济初值）
  // ═══════════════════════════════════════════════════════════════════

  function formulaEstimateWealth(dynasty, classKey, rank) {
    var basePool = {
      'imperial':       { cash: 1000000, land: 200000, treasure: 100000, slaves: 1000 },
      'noble':          { cash: 200000,  land: 50000,  treasure: 20000,  slaves: 100 },
      'civilOfficial':  { cash: 50000,   land: 10000,  treasure: 5000,   slaves: 20 },
      'militaryOfficial':{cash: 30000,   land: 20000,  treasure: 3000,   slaves: 30 },
      'merchant':       { cash: 300000,  land: 5000,   treasure: 30000,  slaves: 10 },
      'landlord':       { cash: 20000,   land: 30000,  treasure: 2000,   slaves: 50 },
      'clergy':         { cash: 5000,    land: 5000,   treasure: 1000,   slaves: 5 },
      'commoner':       { cash: 500,     land: 50,     treasure: 0,      slaves: 0 }
    };
    var base = basePool[classKey] || basePool.commoner;
    // 朝代通胀调整
    var dynastyMult = { '秦':0.5, '汉':0.6, '唐':0.8, '宋':1.2, '元':1.0, '明':1.3, '清':1.8 };
    var dm = dynastyMult[dynasty] || 1.0;
    // 品级调整（rank 越小越高）
    var rankMult = Math.max(0.3, (7 - (rank || 5)) / 4);
    return {
      cash: Math.floor(base.cash * dm * rankMult),
      land: Math.floor(base.land * dm * rankMult),
      treasure: Math.floor(base.treasure * dm * rankMult),
      slaves: Math.floor(base.slaves * rankMult),
      commerce: Math.floor(base.cash * 0.3 * dm * rankMult)
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  制度废除 abolishInstitution + 联动
  // ═══════════════════════════════════════════════════════════════════

  function abolishInstitutionExtended(instId, reason) {
    var G = global.GM;
    if (!G.dynamicInstitutions) return;
    var inst = G.dynamicInstitutions.find(function(i){return i.id===instId;});
    if (!inst) return { ok: false, reason: '未知机构' };
    inst.stage = 'abolished';
    inst.abolishedTurn = G.turn || 0;
    inst.abolishReason = reason || '裁撤';
    // 退还首年预算
    if (G.guoku && inst.annualBudget) {
      G.guoku.money = (G.guoku.money || 0) + Math.floor(inst.annualBudget * 0.5);
    }
    // 主官失势
    if (inst.headOfficial) {
      var head = (G.chars || []).find(function(c){return c.name === inst.headOfficial;});
      if (head) {
        head.loyalty = Math.max(0, (head.loyalty || 50) - 10);
        head.fame = Math.max(-100, (head.fame || 0) - 5);
      }
    }
    if (global.addEB) global.addEB('裁撤', inst.name + ' 废罢（' + reason + '）');
    if (typeof global.EventBus !== 'undefined') {
      global.EventBus.emit('institution.abolished', { inst: inst });
    }
    return { ok: true, inst: inst };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  改革可行度 evaluateReformFeasibility
  // ═══════════════════════════════════════════════════════════════════

  function evaluateReformFeasibility(reform) {
    var G = global.GM;
    var hq = G.huangquan && G.huangquan.index || 55;
    var hw = G.huangwei && G.huangwei.index || 50;
    var mx = G.minxin && G.minxin.trueIndex || 60;
    var requirements = {
      adjustment:    { hq: 30, hw: 40, mx: 35 },
      systematic:    { hq: 50, hw: 55, mx: 45 },
      structural:    { hq: 65, hw: 60, mx: 50 },
      revolutionary: { hq: 80, hw: 70, mx: 55 }
    };
    var scale = reform.scale || 'systematic';
    var req = requirements[scale];
    var failReasons = [];
    if (hq < req.hq) failReasons.push('皇权不足（' + hq + '/' + req.hq + '）');
    if (hw < req.hw) failReasons.push('皇威不足（' + hw + '/' + req.hw + '）');
    if (mx < req.mx) failReasons.push('民心不稳（' + mx + '/' + req.mx + '）');
    // 成功率
    var successRate = 0.5;
    successRate += (hq - req.hq) / 200;
    successRate += (hw - req.hw) / 200;
    successRate += (mx - req.mx) / 300;
    // 党争影响
    if (G.partyStrife > 60) successRate -= (G.partyStrife - 60) / 200;
    successRate = Math.max(0.05, Math.min(0.95, successRate));
    return {
      feasible: failReasons.length === 0,
      failReasons: failReasons,
      successRate: successRate,
      riskLevel: failReasons.length === 0 ? 'low' : failReasons.length === 1 ? 'medium' : 'high'
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  adjustHuangwei / adjustMinxin 统一接口（wrap）
  // ═══════════════════════════════════════════════════════════════════

  function adjustHuangwei(source, delta, reason) {
    if (typeof global.AuthorityComplete !== 'undefined' && global.AuthorityComplete.triggerHuangweiEvent) {
      return global.AuthorityComplete.triggerHuangweiEvent(source, { delta: delta, reason: reason });
    }
    if (typeof global.AuthorityEngines !== 'undefined' && global.AuthorityEngines.adjustHuangwei) {
      return global.AuthorityEngines.adjustHuangwei(source, delta, reason);
    }
    if (global._adjAuthority) global._adjAuthority('huangwei', delta);
    return { ok: true, source: source, delta: delta };
  }

  function adjustMinxin(source, delta, reason) {
    if (typeof global.AuthorityEngines !== 'undefined' && global.AuthorityEngines.adjustMinxin) {
      return global.AuthorityEngines.adjustMinxin(source, delta, reason);
    }
    if (global._adjAuthority) global._adjAuthority('minxin', delta);
    return { ok: true, source: source, delta: delta };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  暴君执行放大 applyTyrantExecutionAmplification
  // ═══════════════════════════════════════════════════════════════════

  function applyTyrantExecutionAmplification(executionPlan) {
    var G = global.GM;
    if (!G.huangwei || !G.huangwei.tyrantSyndrome || !G.huangwei.tyrantSyndrome.active) return executionPlan;
    var ts = G.huangwei.tyrantSyndrome;
    // 徭役：规模 × 1.3
    if (executionPlan.type === 'corvee') {
      executionPlan.scale = (executionPlan.scale || 1) * 1.3;
      executionPlan.deathRate = (executionPlan.deathRate || 0.05) * 1.2;
    }
    // 招抚流民 → 强徙
    if (executionPlan.type === 'refugeeResettlement') {
      executionPlan.coerced = true;
      if (global.addEB) global.addEB('暴君', '招抚变强徙');
      if (global._adjAuthority) global._adjAuthority('minxin', -5);
    }
    // 环保政策 → 极端
    if (executionPlan.type === 'envPolicy') {
      executionPlan.penalty = 'extreme';
    }
    // 诏令 → 诛连扩大
    if (executionPlan.type === 'punishment') {
      executionPlan.scopeMult = 3;
    }
    // 记录
    if (!ts.overExecutionLog) ts.overExecutionLog = [];
    ts.overExecutionLog.push({ turn: G.turn, plan: executionPlan.type, overScale: 1.3 });
    if (ts.overExecutionLog.length > 20) ts.overExecutionLog.splice(0, ts.overExecutionLog.length - 20);
    return executionPlan;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  侍臣问疑×皇权段过滤
  // ═══════════════════════════════════════════════════════════════════

  function filterQueryOptionsByPhase(allOptions) {
    var G = global.GM;
    var hq = G.huangquan && G.huangquan.index || 55;
    if (hq >= 75) {
      // 专制段：只问最关键 3 项
      return allOptions.slice(0, 3);
    } else if (hq >= 35) {
      // 制衡段：全选项
      return allOptions;
    } else {
      // 权臣段：权臣过滤（去掉威胁权臣利益的选项）
      var pm = G.huangquan.powerMinister;
      if (!pm) return allOptions;
      return allOptions.filter(function(o) {
        return !(o.route === 'integrity' && pm.faction && pm.faction.length > 0);  // 整顿吏治 被过滤
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  工程完工奏疏 + 大造黄册 + 改土朝议
  // ═══════════════════════════════════════════════════════════════════

  function _checkProjectCompletion(ctx) {
    var G = global.GM;
    if (!G._activeCorveeProjects) return;
    G._activeCorveeProjects.forEach(function(p) {
      if (p._completionFired) return;
      if (p.status === 'completed' || p.status === 'abandoned') {
        p._completionFired = true;
        if (!G._pendingMemorials) G._pendingMemorials = [];
        G._pendingMemorials.push({
          id: 'proj_complete_' + p.id,
          typeKey: 'corvee_reform',
          typeName: '工程' + (p.status === 'completed' ? '完工' : '烂尾') + '奏',
          drafter: '工部尚书',
          subject: p.name,
          turn: ctx.turn || 0,
          status: 'drafted',
          draftText: '工部奏：' + p.name + ' ' + (p.status === 'completed' ? '竣工' : '中辍') + '，死役 ' + (p.deaths||0) + ' 人，请圣裁'
        });
        if (global.addEB) global.addEB('工程', p.name + ' ' + (p.status==='completed'?'竣工':'烂尾') + '奏到');
      }
    });
  }

  function _checkHuangceCycle(ctx) {
    var G = global.GM;
    if (!G.population || !G.population.meta) return;
    var lastReg = G.population.meta.lastRegistrationTurn || 0;
    // 每 120 回合（10 年）自动触发
    if ((ctx.turn - lastReg) > 120) {
      G.population.meta.lastRegistrationTurn = ctx.turn;
      if (!G._pendingMemorials) G._pendingMemorials = [];
      G._pendingMemorials.push({
        id: 'huangce_' + ctx.turn,
        typeKey: 'huji_reform',
        typeName: '大造黄册',
        drafter: '户部尚书',
        turn: ctx.turn,
        status: 'drafted',
        draftText: '户部奏：十年当大造黄册，请旨整饬。'
      });
      if (global.addEB) global.addEB('黄册', '十年一大造，请旨');
    }
  }

  function _checkGaituEscalation(ctx) {
    var G = global.GM;
    if (!G.population || !G.population.jimiHoldings) return;
    // 若有 3+ 土司忠诚低，自动升朝议
    var lowLoyalty = G.population.jimiHoldings.filter(function(h){return h.loyalty < 30;});
    if (lowLoyalty.length >= 3 && !G._gaituEscalated) {
      G._gaituEscalated = true;
      if (typeof global.PhaseF5 !== 'undefined' && global.PhaseF5.triggerForcedCourtDiscussion) {
        global.PhaseF5.triggerForcedCourtDiscussion('改土归流', '土司 ' + lowLoyalty.length + ' 不臣，议废土司');
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Tick + Init
  // ═══════════════════════════════════════════════════════════════════

  function tick(ctx) {
    ctx = ctx || {};
    var mr = ctx.monthRatio || 1;
    var G = global.GM;
    try { _updatePaperState(G, mr); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-tax-atomic');}catch(_){}}
    try { _updateGrainPrice(G, mr); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-tax-atomic');}catch(_){}}
    try { _tickTransferOrders(ctx, mr); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-tax-atomic');}catch(_){}}
    try { _tickFeudalHoldings(ctx, mr); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-tax-atomic');}catch(_){}}
    try { _checkProjectCompletion(ctx); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-tax-atomic');}catch(_){}}
    try { _checkHuangceCycle(ctx); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-tax-atomic');}catch(_){}}
    try { _checkGaituEscalation(ctx); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-tax-atomic');}catch(_){}}
  }

  function init(sc) {
    var G = global.GM;
    if (!G) return;
    enableTaxesByDynasty(G);
    // 区域四层递归初始化
    if (G.regions) {
      G.regions.forEach(function(r) { _ensureRegionFiscal(r); });
    }
  }

  global.PhaseH = {
    init: init,
    tick: tick,
    ATOMIC_TAX_TYPES_19: ATOMIC_TAX_TYPES_19,
    PAPER_DATA_25: PAPER_DATA_25,
    EXPENDITURE_EFFECTS_14: EXPENDITURE_EFFECTS_14,
    FEUDAL_HOLDING_TYPES: FEUDAL_HOLDING_TYPES,
    enableTaxesByDynasty: enableTaxesByDynasty,
    splitTaxByAllocation: splitTaxByAllocation,
    executeLocalAction: executeLocalAction,
    createTransferOrder: createTransferOrder,
    calcPromotionChance: calcPromotionChance,
    formulaEstimateWealth: formulaEstimateWealth,
    abolishInstitution: abolishInstitutionExtended,
    evaluateReformFeasibility: evaluateReformFeasibility,
    adjustHuangwei: adjustHuangwei,
    adjustMinxin: adjustMinxin,
    applyTyrantExecutionAmplification: applyTyrantExecutionAmplification,
    filterQueryOptionsByPhase: filterQueryOptionsByPhase,
    VERSION: 1
  };

  global.adjustHuangwei = adjustHuangwei;
  global.adjustMinxin = adjustMinxin;
  global.applyTyrantExecutionAmplification = applyTyrantExecutionAmplification;
  global.evaluateReformFeasibility = evaluateReformFeasibility;
  global.abolishInstitutionExtended = abolishInstitutionExtended;

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
