/**
 * tm-env-capacity-engine.js — 环境承载力引擎
 *
 * 实施设计方案-环境承载力.md 全部 8 决策：
 *  Ⅰ 五维承载力（farmland/water/fuel/housing/sanitation）
 *  Ⅱ 生态疤痕累积（9 类）
 *  Ⅲ 过载多级反馈
 *  Ⅳ 生态恢复（双向可逆）
 *  Ⅴ 20+ 环境危机事件库
 *  Ⅵ 技术进步阶梯（5 个技术维度 × 朝代）
 *  Ⅶ 玩家环境政策（13 类古语）
 *  Ⅷ 民心/帑廪/皇威联动
 */
(function(global) {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════
  //  生态疤痕种类
  // ═══════════════════════════════════════════════════════════════════

  var SCAR_TYPES = [
    'deforestation','soilErosion','salinization','desertification',
    'waterTableDrop','riverSilting','biodiversityLoss','soilFertilityLoss','urbanSewageOverload'
  ];

  var SCAR_LABELS = {
    deforestation:'森林退化', soilErosion:'水土流失', salinization:'盐碱化',
    desertification:'沙漠化', waterTableDrop:'地下水位下降', riverSilting:'河道淤积',
    biodiversityLoss:'生物多样性损失', soilFertilityLoss:'地力衰退', urbanSewageOverload:'城市排污过载'
  };

  // ═══════════════════════════════════════════════════════════════════
  //  20 环境危机事件
  // ═══════════════════════════════════════════════════════════════════

  var CRISIS_EVENTS = [
    { id:'huanghe_change', name:'黄河改道',       trigger:{ riverSilting:0.7 },       severity:'catastrophic', effect:{ deathRate:0.15, farmlandLoss:0.25, unrest:+30 } },
    { id:'huaihe_flood',   name:'淮河泛滥',       trigger:{ riverSilting:0.5 },       severity:'severe',       effect:{ deathRate:0.08, farmlandLoss:0.15, unrest:+20 } },
    { id:'flood',          name:'大水',           trigger:{ waterTableDrop:0.3 },     severity:'severe',       effect:{ deathRate:0.05, farmlandLoss:0.10, unrest:+15 } },
    { id:'drought',        name:'旱灾',           trigger:{ waterTableDrop:0.5 },     severity:'severe',       effect:{ deathRate:0.06, famine:true, unrest:+15 } },
    { id:'locust',         name:'蝗灾',           trigger:{ biodiversityLoss:0.6 },   severity:'severe',       effect:{ farmlandLoss:0.20, famine:true, unrest:+25 } },
    { id:'plague',         name:'瘟疫',           trigger:{ urbanSewageOverload:0.5 },severity:'catastrophic', effect:{ deathRate:0.20, unrest:+30 } },
    { id:'famine',         name:'饥荒',           trigger:{ soilFertilityLoss:0.5 },  severity:'severe',       effect:{ deathRate:0.10, unrest:+25 } },
    { id:'wildfire',       name:'山火',           trigger:{ deforestation:0.7 },      severity:'moderate',     effect:{ deathRate:0.01, deforestationBoost:0.1 } },
    { id:'dust_storm',     name:'沙尘',           trigger:{ desertification:0.5 },    severity:'moderate',     effect:{ farmlandLoss:0.05, unrest:+5 } },
    { id:'earthquake',     name:'地震',           trigger:null,                        severity:'severe',       effect:{ deathRate:0.03, housingLoss:0.20 }, random:true, probAnnual:0.03 },
    { id:'typhoon',        name:'飓风海啸',       trigger:null,                        severity:'moderate',     effect:{ deathRate:0.02, coastalDamage:true }, random:true, probAnnual:0.05 },
    { id:'mountain_desic', name:'山林尽伐',       trigger:{ deforestation:0.85 },     severity:'moderate',     effect:{ fuelCrisis:true, floodRisk:+0.2 } },
    { id:'well_dry',       name:'井泉尽涸',       trigger:{ waterTableDrop:0.8 },     severity:'severe',       effect:{ waterCrisis:true, migration:true } },
    { id:'salt_tide',      name:'盐碱蚀田',       trigger:{ salinization:0.7 },       severity:'severe',       effect:{ farmlandLoss:0.30 } },
    { id:'desert_invade',  name:'沙侵',           trigger:{ desertification:0.7 },    severity:'moderate',     effect:{ farmlandLoss:0.15, migration:true } },
    { id:'pest_outbreak',  name:'虫害爆发',       trigger:{ biodiversityLoss:0.7 },   severity:'moderate',     effect:{ farmlandLoss:0.10 } },
    { id:'fertility_loss', name:'地力尽',         trigger:{ soilFertilityLoss:0.8 },  severity:'severe',       effect:{ farmlandLoss:0.25, migration:true } },
    { id:'urban_epidemic', name:'都市疫疠',       trigger:{ urbanSewageOverload:0.7 },severity:'severe',       effect:{ deathRate:0.15, urbanUnrest:+20 } },
    { id:'river_burst',    name:'河堤溃决',       trigger:{ riverSilting:0.8 },       severity:'catastrophic', effect:{ deathRate:0.12, farmlandLoss:0.20 } },
    { id:'winter_severe',  name:'严冬',           trigger:null,                        severity:'moderate',     effect:{ deathRate:0.04, fuelStress:+0.3 }, random:true, probAnnual:0.08 }
  ];

  // ═══════════════════════════════════════════════════════════════════
  //  技术进步阶梯（5 个技术维度 × 朝代）
  // ═══════════════════════════════════════════════════════════════════

  var TECH_TIERS = {
    agriculture: {
      levels: [
        { era:'先秦', yieldMult:0.8, unlocks:['ox_plow'] },
        { era:'汉',   yieldMult:1.0, unlocks:['iron_tools','dongting_rice'] },
        { era:'唐',   yieldMult:1.3, unlocks:['curved_plow','south_rice'] },
        { era:'宋',   yieldMult:1.6, unlocks:['champa_rice','tea_cultivation'] },
        { era:'明',   yieldMult:1.9, unlocks:['maize','sweet_potato'] },
        { era:'清',   yieldMult:2.2, unlocks:['potato','expanded_maize'] }
      ]
    },
    irrigation: {
      levels: [
        { era:'先秦', capMult:0.7, unlocks:['dujiangyan'] },
        { era:'汉',   capMult:1.0, unlocks:['waterwheel'] },
        { era:'唐',   capMult:1.3, unlocks:['dragon_pump'] },
        { era:'宋',   capMult:1.6, unlocks:['tong_river'] },
        { era:'明',   capMult:1.9, unlocks:['advanced_channels'] },
        { era:'清',   capMult:2.0, unlocks:['qinling_projects'] }
      ]
    },
    fertilizer: {
      levels: [
        { era:'先秦', fertilityDecay:0.05, unlocks:['ash'] },
        { era:'汉',   fertilityDecay:0.04, unlocks:['manure'] },
        { era:'唐',   fertilityDecay:0.03, unlocks:['crop_rotation'] },
        { era:'宋',   fertilityDecay:0.025, unlocks:['green_manure'] },
        { era:'明',   fertilityDecay:0.02, unlocks:['bean_rotation'] },
        { era:'清',   fertilityDecay:0.018, unlocks:['intensive'] }
      ]
    },
    seedSelection: {
      levels: [
        { era:'汉',   yieldMult:1.0 },
        { era:'宋',   yieldMult:1.1 },
        { era:'明',   yieldMult:1.2 },
        { era:'清',   yieldMult:1.25 }
      ]
    },
    toolImprovement: {
      levels: [
        { era:'先秦', labor:1.0 },
        { era:'汉',   labor:0.9 },
        { era:'唐',   labor:0.8 },
        { era:'宋',   labor:0.7 },
        { era:'明',   labor:0.65 },
        { era:'清',   labor:0.6 }
      ]
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  //  13 类环境政策（古语）
  // ═══════════════════════════════════════════════════════════════════

  var ENV_POLICIES = [
    { id:'feng_shan_mu',  name:'封山育木',    scarReduce:{ deforestation:0.02 },      cost:{ money:50000 } },
    { id:'jin_hu_kui',    name:'禁伐楛',      scarReduce:{ deforestation:0.015 },     cost:{ money:30000 } },
    { id:'yi_he_shui',    name:'疏浚河道',    scarReduce:{ riverSilting:0.03 },       cost:{ money:80000 } },
    { id:'ke_gao',        name:'克膏治田',    scarReduce:{ salinization:0.02 },       cost:{ money:60000 } },
    { id:'tun_tian',      name:'屯田养地',    scarReduce:{ soilFertilityLoss:0.02 },  cost:{ money:40000, grain:20000 } },
    { id:'fan_gu',        name:'反古休耕',    scarReduce:{ soilFertilityLoss:0.03 },  cost:{ money:30000 } },
    { id:'jie_yong',      name:'节用爱民',    scarReduce:{ deforestation:0.01, urbanSewageOverload:0.01 }, cost:{ money:20000 } },
    { id:'zhi_tian_yu',   name:'制田赋',      scarReduce:{ soilErosion:0.015 },       cost:{ money:35000 } },
    { id:'jin_dian_hun',  name:'禁奠琥',      scarReduce:{ biodiversityLoss:0.02 },   cost:{ money:15000 } },
    { id:'shui_li',       name:'兴水利',      scarReduce:{ waterTableDrop:0.02 },     cost:{ money:100000 } },
    { id:'ken_huang',     name:'垦荒（慎）',  effect:{ farmlandBoost:+0.05 },         cost:{ money:40000 }, risk:{ deforestation:+0.01 } },
    { id:'yu_huang',      name:'育皇林',      scarReduce:{ biodiversityLoss:0.01 },   cost:{ money:25000 } },
    { id:'jing_wei',      name:'净渭清畿',    scarReduce:{ urbanSewageOverload:0.03 },cost:{ money:50000 } }
  ];

  // ═══════════════════════════════════════════════════════════════════
  //  初始化
  // ═══════════════════════════════════════════════════════════════════

  function init(sc) {
    var G = global.GM;
    if (!G) return;
    if (G.environment && G.environment._inited) {
      if (!G.environment.byRegion) G.environment.byRegion = {};
      if (!G.environment.crisisHistory) G.environment.crisisHistory = [];
      if (!G.environment.historicalScarMap) G.environment.historicalScarMap = [];
      return;
    }

    var config = (sc && sc.environmentConfig) || {};
    var regions = (G.regions || []);

    G.environment = {
      _inited: true,
      nationalCarrying: { farmland: 0, water: 0, fuel: 0, housing: 0, sanitation: 0 },
      nationalLoad: 0.5,
      ecoDebt: 0,
      byRegion: _initRegions(regions, config),
      climatePhase: (config.climateTimeline && config.climateTimeline[0]) || 'normal',
      historicalScarMap: [],
      crisisHistory: [],
      techEra: _inferTechEra(sc),
      activePolicies: [] // 正在推行的政策列表
    };

    _recomputeNationalCarrying();
  }

  function _inferTechEra(sc) {
    if (!sc) return '唐';
    var name = (sc.name || sc.dynasty || '').toString();
    var eras = ['先秦','汉','唐','宋','元','明','清'];
    for (var i = eras.length - 1; i >= 0; i--) {
      if (name.indexOf(eras[i]) >= 0) return eras[i];
    }
    return '唐';
  }

  function _initRegions(regions, config) {
    var out = {};
    regions.forEach(function(r) {
      if (!r || !r.id) return;
      var custom = (config.initialCarrying && config.initialCarrying.byRegion && config.initialCarrying.byRegion[r.id]) || {};
      var customScars = (config.initialScars && config.initialScars.byRegion && config.initialScars.byRegion[r.id]) || {};
      out[r.id] = {
        carrying: {
          farmlandSupport: custom.farmlandSupport || 1000000,
          waterSupport:    custom.waterSupport    || 1500000,
          fuelSupport:     custom.fuelSupport     || 800000,
          housingSupport:  custom.housingSupport  || 1200000,
          sanitationSupport: custom.sanitationSupport || 1000000
        },
        carryingMax: 0,
        ecoScars: _defaultScars(customScars),
        currentLoad: 0.5,
        overloadYears: 0,
        forestArea: custom.forestArea || 500000,
        coalReserve: custom.coalReserve || 0,
        aquiferLevel: custom.aquiferLevel || 1.0,
        riverFlow: custom.riverFlow || 1.0,
        arableArea: custom.arableArea || 500000,
        soilFertility: custom.soilFertility || 0.85,
        techLevel: Object.assign({ agriculture: 1, irrigation: 1, fertilizer: 1, seedSelection: 1, toolImprovement: 1 }, custom.techLevel || {})
      };
      _recomputeRegionCarrying(r.id, out[r.id]);
    });
    return out;
  }

  function _defaultScars(custom) {
    var s = {};
    SCAR_TYPES.forEach(function(t) { s[t] = (custom && custom[t]) || 0; });
    return s;
  }

  function _recomputeRegionCarrying(rid, reg) {
    // 1) 土地支撑
    var G = global.GM;
    var techEra = G.environment ? G.environment.techEra : '唐';
    var yieldMult = _getTechEraMult('agriculture', techEra, 'yieldMult') || 1.0;
    var irrigMult = _getTechEraMult('irrigation', techEra, 'capMult') || 1.0;
    var seedMult = _getTechEraMult('seedSelection', techEra, 'yieldMult') || 1.0;
    var farmland = (reg.arableArea || 500000) * (reg.soilFertility || 0.85) * yieldMult * seedMult * irrigMult
                   - (reg.ecoScars.salinization || 0) * 200000
                   - (reg.ecoScars.soilErosion || 0) * 150000;
    reg.carrying.farmlandSupport = Math.max(100000, farmland);
    // 2) 水
    var water = (reg.aquiferLevel || 1.0) * 1500000 * (reg.riverFlow || 1.0)
                - (reg.ecoScars.waterTableDrop || 0) * 300000
                - (reg.ecoScars.riverSilting || 0) * 200000;
    reg.carrying.waterSupport = Math.max(100000, water);
    // 3) 燃料
    var fuel = (reg.forestArea || 500000) * 1.5 + (reg.coalReserve || 0) * 3
               - (reg.ecoScars.deforestation || 0) * 400000;
    reg.carrying.fuelSupport = Math.max(50000, fuel);
    // 4) 住房
    reg.carrying.housingSupport = (reg.mouths || 1200000) * 1.1; // 简化估算
    // 5) 卫生
    var sani = 1000000 - (reg.ecoScars.urbanSewageOverload || 0) * 500000;
    reg.carrying.sanitationSupport = Math.max(100000, sani);

    reg.carryingMax = Math.min(
      reg.carrying.farmlandSupport,
      reg.carrying.waterSupport,
      reg.carrying.fuelSupport,
      reg.carrying.housingSupport,
      reg.carrying.sanitationSupport
    );

    // 加载比
    var pop = global.GM.population && global.GM.population.byRegion && global.GM.population.byRegion[rid];
    var popCount = pop ? pop.mouths : 1000000;
    reg.currentLoad = popCount / Math.max(1, reg.carryingMax);
  }

  function _getTechEraMult(tech, era, key) {
    var levels = TECH_TIERS[tech] && TECH_TIERS[tech].levels;
    if (!levels) return 1.0;
    var lv = levels.find(function(l) { return l.era === era; });
    if (!lv) lv = levels[levels.length - 1];
    return lv[key] || 1.0;
  }

  function _recomputeNationalCarrying() {
    var E = global.GM.environment;
    if (!E) return;
    var totals = { farmland:0, water:0, fuel:0, housing:0, sanitation:0 };
    var loadSum = 0, n = 0;
    Object.values(E.byRegion).forEach(function(r) {
      totals.farmland += r.carrying.farmlandSupport;
      totals.water += r.carrying.waterSupport;
      totals.fuel += r.carrying.fuelSupport;
      totals.housing += r.carrying.housingSupport;
      totals.sanitation += r.carrying.sanitationSupport;
      loadSum += r.currentLoad;
      n++;
    });
    E.nationalCarrying = totals;
    E.nationalLoad = n > 0 ? loadSum / n : 0.5;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Ⅱ 生态疤痕累积 + Ⅳ 恢复
  // ═══════════════════════════════════════════════════════════════════

  function _tickScarAccumulation(ctx, mr) {
    var E = global.GM.environment;
    if (!E) return;
    var G = global.GM;
    Object.keys(E.byRegion).forEach(function(rid) {
      var reg = E.byRegion[rid];
      var pop = G.population && G.population.byRegion && G.population.byRegion[rid];
      var popCount = pop ? pop.mouths : 500000;
      var load = reg.currentLoad || 0.5;
      // 过载加速疤痕
      var overloadMult = Math.max(1.0, load);
      // 森林退化（按人口烧柴）
      reg.ecoScars.deforestation = Math.min(1, (reg.ecoScars.deforestation || 0) + 0.0005 * overloadMult * mr);
      // 水土流失
      reg.ecoScars.soilErosion = Math.min(1, (reg.ecoScars.soilErosion || 0) + 0.0003 * overloadMult * mr);
      // 地下水下降（人口密度影响）
      reg.ecoScars.waterTableDrop = Math.min(1, (reg.ecoScars.waterTableDrop || 0) + 0.0002 * overloadMult * mr);
      // 河道淤积
      reg.ecoScars.riverSilting = Math.min(1, (reg.ecoScars.riverSilting || 0) + 0.0002 * mr);
      // 地力衰退（按技术）
      var fertDecay = _getTechEraMult('fertilizer', E.techEra, 'fertilityDecay') || 0.03;
      reg.ecoScars.soilFertilityLoss = Math.min(1, (reg.ecoScars.soilFertilityLoss || 0) + fertDecay / 12 * mr);
      reg.soilFertility = Math.max(0.3, reg.soilFertility - fertDecay / 12 * mr);
      // 盐碱化（灌溉过度）
      reg.ecoScars.salinization = Math.min(1, (reg.ecoScars.salinization || 0) + 0.0001 * overloadMult * mr);
      // 沙漠化（干旱+过伐）
      if (reg.ecoScars.deforestation > 0.5) {
        reg.ecoScars.desertification = Math.min(1, (reg.ecoScars.desertification || 0) + 0.0002 * mr);
      }
      // 生物多样性损失
      reg.ecoScars.biodiversityLoss = Math.min(1, (reg.ecoScars.biodiversityLoss || 0) + 0.0001 * mr);
      // 城市排污
      if (popCount > 500000) {
        reg.ecoScars.urbanSewageOverload = Math.min(1, (reg.ecoScars.urbanSewageOverload || 0) + 0.0003 * mr);
      }
      // 过载年数
      if (load > 1.0) reg.overloadYears += mr / 12;
      else reg.overloadYears = Math.max(0, reg.overloadYears - mr / 24); // 恢复慢
      // 政策效果
      (E.activePolicies || []).forEach(function(p) {
        if (p.regionId && p.regionId !== rid && p.regionId !== 'all') return;
        var policy = ENV_POLICIES.find(function(pp) { return pp.id === p.id; });
        if (policy && policy.scarReduce) {
          Object.keys(policy.scarReduce).forEach(function(sk) {
            reg.ecoScars[sk] = Math.max(0, reg.ecoScars[sk] - policy.scarReduce[sk] * mr / 12);
          });
        }
      });
      _recomputeRegionCarrying(rid, reg);
    });
    _recomputeNationalCarrying();
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Ⅲ 过载多级反馈
  // ═══════════════════════════════════════════════════════════════════

  function _tickOverloadFeedback(ctx, mr) {
    var E = global.GM.environment;
    if (!E) return;
    var G = global.GM;
    Object.keys(E.byRegion).forEach(function(rid) {
      var reg = E.byRegion[rid];
      var load = reg.currentLoad || 0.5;
      if (load < 1.0) return;
      // 级别 1: 1.0-1.2 压力
      // 级别 2: 1.2-1.5 饥荒
      // 级别 3: >1.5 崩溃
      var level = load < 1.2 ? 1 : load < 1.5 ? 2 : 3;
      var pop = G.population && G.population.byRegion && G.population.byRegion[rid];
      if (!pop) return;
      if (level === 1) {
        pop.yearlyDeaths = (pop.yearlyDeaths || 0) + pop.mouths * 0.002 * mr / 12;
        pop.mouths = Math.max(10000, pop.mouths - pop.mouths * 0.002 * mr / 12);
      } else if (level === 2) {
        pop.yearlyDeaths = (pop.yearlyDeaths || 0) + pop.mouths * 0.008 * mr / 12;
        pop.mouths = Math.max(10000, pop.mouths - pop.mouths * 0.008 * mr / 12);
        var region = (G.regions || []).find(function(r) { return r.id === rid; });
        if (region) region.unrest = Math.min(100, (region.unrest || 30) + 3 * mr);
        if (global._adjAuthority) global._adjAuthority('minxin', -0.2 * mr);
      } else {
        pop.yearlyDeaths = (pop.yearlyDeaths || 0) + pop.mouths * 0.02 * mr / 12;
        pop.mouths = Math.max(10000, pop.mouths - pop.mouths * 0.02 * mr / 12);
        var region2 = (G.regions || []).find(function(r) { return r.id === rid; });
        if (region2) { region2.unrest = Math.min(100, (region2.unrest || 30) + 8 * mr); region2.disasterLevel = Math.min(1, (region2.disasterLevel || 0) + 0.05 * mr); }
        if (global._adjAuthority) global._adjAuthority('minxin', -0.5 * mr);
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Ⅴ 危机事件触发
  // ═══════════════════════════════════════════════════════════════════

  function _tickCrisisEvents(ctx, mr) {
    var E = global.GM.environment;
    if (!E) return;
    CRISIS_EVENTS.forEach(function(ev) {
      // 触发检测——每月仅一次机会
      if (ev.random) {
        if (Math.random() < (ev.probAnnual || 0.02) * mr / 12) {
          _triggerCrisis(ev);
        }
      } else if (ev.trigger) {
        // 按 scar 触发
        Object.keys(ev.trigger).forEach(function(sk) {
          var threshold = ev.trigger[sk];
          Object.keys(E.byRegion).forEach(function(rid) {
            var reg = E.byRegion[rid];
            if (reg.ecoScars[sk] >= threshold && !reg['_crisis_' + ev.id]) {
              if (Math.random() < 0.02 * mr) {
                _triggerCrisis(ev, rid);
                reg['_crisis_' + ev.id] = ctx.turn || 0;
              }
            }
            // 冷却 5 年后可再触发
            if (reg['_crisis_' + ev.id] && (ctx.turn - reg['_crisis_' + ev.id]) > 60) {
              delete reg['_crisis_' + ev.id];
            }
          });
        });
      }
    });
  }

  function _triggerCrisis(ev, rid) {
    var E = global.GM.environment;
    E.crisisHistory.push({ id: ev.id, name: ev.name, turn: global.GM.turn, regionId: rid || 'national', severity: ev.severity });
    if (E.crisisHistory.length > 60) E.crisisHistory.splice(0, E.crisisHistory.length - 60);
    // 效果
    if (ev.effect) {
      var ef = ev.effect;
      if (ef.deathRate) {
        var P = global.GM.population;
        if (P) {
          var target = rid && P.byRegion[rid] ? P.byRegion[rid] : P.national;
          var deaths = Math.round(target.mouths * ef.deathRate);
          target.mouths = Math.max(10000, target.mouths - deaths);
          if (P.national !== target) P.national.mouths = Math.max(10000, P.national.mouths - deaths);
        }
      }
      if (ef.unrest) {
        var G = global.GM;
        if (rid) {
          var reg = (G.regions || []).find(function(r) { return r.id === rid; });
          if (reg) reg.unrest = Math.min(100, (reg.unrest || 30) + ef.unrest);
        } else {
          if (typeof G.unrest === 'number') G.unrest = Math.min(100, G.unrest + ef.unrest / 2);
        }
      }
      if (ef.farmlandLoss) {
        if (rid && E.byRegion[rid]) {
          E.byRegion[rid].arableArea *= (1 - ef.farmlandLoss);
        }
      }
    }
    if (global.addEB) global.addEB('环境', ev.name + (rid ? '（' + rid + '）' : '') + ' · ' + ev.severity);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Ⅶ 玩家环境政策
  // ═══════════════════════════════════════════════════════════════════

  function enactPolicy(policyId, regionId) {
    var policy = ENV_POLICIES.find(function(p) { return p.id === policyId; });
    if (!policy) return { ok: false };
    var E = global.GM.environment;
    if (!E) return { ok: false };
    // 扣钱
    var cost = policy.cost || {};
    if (cost.money && global.GM.guoku) {
      if ((global.GM.guoku.money || 0) < cost.money) return { ok: false, reason: '帑廪不足' };
      global.GM.guoku.money -= cost.money;
    }
    if (cost.grain && global.GM.guoku) {
      global.GM.guoku.grain = Math.max(0, (global.GM.guoku.grain || 0) - cost.grain);
    }
    // 加入活跃政策（持续 24 回合 2 年）
    E.activePolicies.push({
      id: policyId, regionId: regionId || 'all',
      startTurn: global.GM.turn || 0, duration: 24
    });
    if (global.addEB) global.addEB('环政', '推行 ' + policy.name + (regionId ? '（' + regionId + '）' : '（全国）'));
    return { ok: true };
  }

  function _cleanExpiredPolicies(ctx) {
    var E = global.GM.environment;
    if (!E || !E.activePolicies) return;
    E.activePolicies = E.activePolicies.filter(function(p) {
      return (ctx.turn - p.startTurn) < p.duration;
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Ⅷ 民心/帑廪/皇威联动
  // ═══════════════════════════════════════════════════════════════════

  function _applyMinxinCoupling(mr) {
    var E = global.GM.environment;
    if (!E) return;
    var G = global.GM;
    // 全国平均疤痕
    var avgScar = 0, n = 0;
    Object.values(E.byRegion).forEach(function(r) {
      SCAR_TYPES.forEach(function(t) { avgScar += r.ecoScars[t] || 0; });
      n += SCAR_TYPES.length;
    });
    avgScar = n > 0 ? avgScar / n : 0;
    // 疤痕高 → 民心降
    if (global._adjAuthority) {
      if (avgScar > 0.5) global._adjAuthority('minxin', -(avgScar - 0.5) * 0.5 * mr);
      else if (avgScar < 0.1) {
        var _mxV = (G.minxin && typeof G.minxin === 'object' ? G.minxin.trueIndex : G.minxin) || 60;
        if (_mxV < 80) global._adjAuthority('minxin', 0.1 * mr);
      }
    }
    // 承载力不足 → 皇权下降
    if (E.nationalLoad > 1.2 && global._adjAuthority) {
      global._adjAuthority('huangquan', -(E.nationalLoad - 1.2) * 0.3 * mr);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  AI 上下文
  // ═══════════════════════════════════════════════════════════════════

  function getAIContext() {
    var E = global.GM && global.GM.environment;
    if (!E) return '';
    var lines = ['【环境承载力】'];
    lines.push('全国加载比：' + (E.nationalLoad * 100).toFixed(0) + '% · 气候：' + E.climatePhase);
    // 严重疤痕
    var worstScars = [];
    Object.keys(E.byRegion).forEach(function(rid) {
      var reg = E.byRegion[rid];
      SCAR_TYPES.forEach(function(t) {
        if (reg.ecoScars[t] > 0.5) {
          worstScars.push(rid + ' ' + SCAR_LABELS[t] + ' ' + (reg.ecoScars[t]*100).toFixed(0) + '%');
        }
      });
    });
    if (worstScars.length > 0) lines.push('严重疤痕：' + worstScars.slice(0, 5).join('；'));
    if (E.crisisHistory.length > 0) {
      var recent = E.crisisHistory.filter(function(c) { return (global.GM.turn || 0) - c.turn < 24; });
      if (recent.length > 0) lines.push('近年危机：' + recent.map(function(c) { return c.name; }).join('、'));
    }
    if (E.activePolicies.length > 0) {
      lines.push('在行环政：' + E.activePolicies.map(function(p) { var pp = ENV_POLICIES.find(function(x){return x.id===p.id;}); return pp ? pp.name : p.id; }).join('、'));
    }
    return lines.join('\n');
  }

  // ═══════════════════════════════════════════════════════════════════
  //  主 tick
  // ═══════════════════════════════════════════════════════════════════

  function tick(ctx) {
    ctx = ctx || {};
    if (!global.GM || !global.GM.environment) {
      var sc = (typeof global.findScenarioById === 'function') ? global.findScenarioById(global.GM.sid) : null;
      init(sc);
    }
    var mr = ctx.monthRatio || 1;
    try { _tickScarAccumulation(ctx, mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'env] scars:') : console.error('[env] scars:', e); }
    try { _tickOverloadFeedback(ctx, mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'env] overload:') : console.error('[env] overload:', e); }
    try { _tickCrisisEvents(ctx, mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'env] crises:') : console.error('[env] crises:', e); }
    try { _cleanExpiredPolicies(ctx); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-env-capacity-engine');}catch(_){}}
    try { _applyMinxinCoupling(mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'env] minxin:') : console.error('[env] minxin:', e); }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  导出
  // ═══════════════════════════════════════════════════════════════════

  global.EnvCapacityEngine = {
    init: init,
    tick: tick,
    enactPolicy: enactPolicy,
    getAIContext: getAIContext,
    SCAR_TYPES: SCAR_TYPES,
    SCAR_LABELS: SCAR_LABELS,
    CRISIS_EVENTS: CRISIS_EVENTS,
    TECH_TIERS: TECH_TIERS,
    ENV_POLICIES: ENV_POLICIES,
    VERSION: 1
  };

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
