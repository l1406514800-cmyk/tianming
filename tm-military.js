// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// tm-military.js — 军事·封建·头衔·补给·铨选·战争·建筑 (R122 从 tm-economy-military.js L723-end 拆出)
// 姊妹: tm-economy.js (L1-722·经济+继承)
// ============================================================

// ============================================================
// 战斗策略抽取系统
// ============================================================

// 战斗策略系统：将战术细节从 AI 推演中抽取出来，提供可视化展示
// 不替换现有的 AI 战斗推演，而是作为增强层提供战术分析

// 战术类型定义
var TacticTypes = {
  offensive: {
    frontal_assault: { name: '正面强攻', moraleCost: 15, casualtyRate: 0.2, successRate: 0.6 },
    flanking: { name: '侧翼包抄', moraleCost: 10, casualtyRate: 0.15, successRate: 0.7 },
    cavalry_charge: { name: '骑兵冲锋', moraleCost: 12, casualtyRate: 0.18, successRate: 0.65 },
    siege: { name: '围城', moraleCost: 8, casualtyRate: 0.1, successRate: 0.5 },
    ambush: { name: '伏击', moraleCost: 5, casualtyRate: 0.08, successRate: 0.8 }
  },
  defensive: {
    hold_ground: { name: '坚守阵地', moraleCost: 8, casualtyRate: 0.12, successRate: 0.7 },
    retreat: { name: '战略撤退', moraleCost: 20, casualtyRate: 0.05, successRate: 0.9 },
    counter_attack: { name: '反击', moraleCost: 12, casualtyRate: 0.15, successRate: 0.65 },
    fortify: { name: '加固防御', moraleCost: 5, casualtyRate: 0.08, successRate: 0.75 }
  },
  special: {
    night_raid: { name: '夜袭', moraleCost: 10, casualtyRate: 0.12, successRate: 0.7 },
    feint: { name: '佯攻', moraleCost: 5, casualtyRate: 0.05, successRate: 0.8 },
    scorched_earth: { name: '坚壁清野', moraleCost: 15, casualtyRate: 0.02, successRate: 0.85 },
    psychological: { name: '心理战', moraleCost: 3, casualtyRate: 0.01, successRate: 0.6 }
  }
};

// 战斗策略分析
function analyzeBattleStrategy(attacker, defender, context) {
  if (!attacker || !defender) return null;

  var analysis = {
    attacker: {
      name: attacker.name,
      strength: calculateArmyStrength(attacker),
      morale: attacker.morale || 70,
      commander: attacker.commander,
      recommendedTactics: []
    },
    defender: {
      name: defender.name,
      strength: calculateArmyStrength(defender),
      morale: defender.morale || 70,
      commander: defender.commander,
      recommendedTactics: []
    },
    terrain: context.terrain || 'plains',
    weather: context.weather || 'clear',
    prediction: null
  };

  // 推荐进攻方战术
  analysis.attacker.recommendedTactics = recommendTactics(attacker, defender, 'offensive', context);

  // 推荐防守方战术
  analysis.defender.recommendedTactics = recommendTactics(defender, attacker, 'defensive', context);

  // 预测战斗结果
  analysis.prediction = predictBattleOutcome(analysis);

  return analysis;
}

// 计算军队实力
/**
 * 增强军力计算：兵力 × 士气 × 训练 × 品质 × 将领 × 补给 × 地形 × 兵种
 * @param {Object} army - 军队对象
 * @param {Object} [context] - 可选战场上下文 {terrain, isDefender, enemyType}
 * @returns {number}
 */
function calculateArmyStrength(army, context) {
  if (!army || army.destroyed) return 0;
  var ctx = context || {};

  var baseStrength = army.soldiers || army.strength || 1000;
  var moraleMod = 0.5 + (army.morale || 70) / 200;       // 0.5-1.0
  var trainingMod = 0.5 + (army.training || 50) / 200;    // 0.5-1.0
  var qualityMod = army.quality === '\u7CBE\u9510' ? 1.3 : army.quality === '\u65B0\u5175' ? 0.7 : 1.0;

  // 将领加成（军事能力+智力综合）
  var commanderMod = 1.0;
  if (army.commander) {
    var commander = typeof findCharByName === 'function' ? findCharByName(army.commander) : null;
    if (commander) {
      var military = commander.military || commander.valor || 50;
      var intel = commander.intelligence || 50;
      commanderMod = 1 + (military * 0.7 + intel * 0.3) / 200; // 1.0-1.5
    }
  }

  // 补给加成（0.5无补给~1.2满补给）
  var supplyMod = 1.0;
  if (army.supplyRatio !== undefined) {
    supplyMod = 0.5 + (army.supplyRatio || 0) * 0.7; // 0.5-1.2
  }

  // 地形加成（从P.battleConfig读取，防守方额外+10%）
  var terrainMod = 1.0;
  if (ctx.terrain && P.battleConfig && P.battleConfig.terrainModifiers) {
    var tMod = P.battleConfig.terrainModifiers[ctx.terrain];
    if (tMod) terrainMod = ctx.isDefender ? (tMod.defender || 1.0) : (tMod.attacker || 1.0);
  } else if (ctx.isDefender) {
    terrainMod = 1.1; // 默认防守方+10%
  }

  // 兵种克制（简化：从unitTypes配置读取）
  var unitMod = 1.0;
  if (army.type && ctx.enemyType && P.battleConfig && P.battleConfig.unitTypes) {
    var unitDef = P.battleConfig.unitTypes.find(function(u) { return u.id === army.type; });
    if (unitDef && unitDef.strong_against && unitDef.strong_against.indexOf(ctx.enemyType) >= 0) unitMod = 1.25;
    if (unitDef && unitDef.weak_against && unitDef.weak_against.indexOf(ctx.enemyType) >= 0) unitMod = 0.75;
  }

  return baseStrength * moraleMod * trainingMod * qualityMod * commanderMod * supplyMod * terrainMod * unitMod;
}

// 推荐战术
function recommendTactics(army, enemy, tacticCategory, context) {
  var tactics = [];
  var availableTactics = TacticTypes[tacticCategory] || {};

  var armyStrength = calculateArmyStrength(army);
  var enemyStrength = calculateArmyStrength(enemy);
  var strengthRatio = armyStrength / (enemyStrength || 1);

  Object.keys(availableTactics).forEach(function(tacticKey) {
    var tactic = availableTactics[tacticKey];
    var score = evaluateTactic(tactic, army, enemy, strengthRatio, context);

    tactics.push({
      key: tacticKey,
      name: tactic.name,
      score: score,
      moraleCost: tactic.moraleCost,
      casualtyRate: tactic.casualtyRate,
      successRate: tactic.successRate,
      description: generateTacticDescription(tactic, army, enemy, context)
    });
  });

  // 按得分排序
  tactics.sort(function(a, b) { return b.score - a.score; });

  return tactics.slice(0, 3); // 返回前 3 个推荐战术
}

// 评估战术得分
function evaluateTactic(tactic, army, enemy, strengthRatio, context) {
  var score = tactic.successRate * 100;

  // 实力比影响
  if (strengthRatio > 1.5) {
    // 优势方：进攻战术加分
    if (tactic.name.indexOf('强攻') >= 0 || tactic.name.indexOf('冲锋') >= 0) {
      score += 20;
    }
  } else if (strengthRatio < 0.7) {
    // 劣势方：防守和特殊战术加分
    if (tactic.name.indexOf('撤退') >= 0 || tactic.name.indexOf('防御') >= 0) {
      score += 20;
    }
  }

  // 士气影响
  var morale = army.morale || 70;
  if (morale < 50 && tactic.moraleCost > 10) {
    score -= 30; // 低士气时避免高士气消耗战术
  }

  // 地形影响
  if (context.terrain === 'mountains' && tactic.name.indexOf('骑兵') >= 0) {
    score -= 20; // 山地不利于骑兵
  } else if (context.terrain === 'plains' && tactic.name.indexOf('骑兵') >= 0) {
    score += 15; // 平原有利于骑兵
  }

  // 天气影响
  if (context.weather === 'rain' && tactic.name.indexOf('夜袭') >= 0) {
    score += 10; // 雨天有利于夜袭
  }

  return Math.max(0, Math.min(100, score));
}

// 生成战术描述
function generateTacticDescription(tactic, army, enemy, context) {
  var desc = tactic.name + '：';

  if (tactic.successRate > 0.7) {
    desc += '成功率高，';
  } else if (tactic.successRate < 0.5) {
    desc += '风险较大，';
  }

  if (tactic.casualtyRate > 0.15) {
    desc += '伤亡较重';
  } else if (tactic.casualtyRate < 0.1) {
    desc += '伤亡较轻';
  }

  if (tactic.moraleCost > 12) {
    desc += '，对士气影响大';
  }

  return desc;
}

// 预测战斗结果
function predictBattleOutcome(analysis) {
  var attackerStrength = analysis.attacker.strength;
  var defenderStrength = analysis.defender.strength;
  var strengthRatio = attackerStrength / (defenderStrength || 1);

  var prediction = {
    winner: null,
    confidence: 0,
    attackerCasualties: 0,
    defenderCasualties: 0,
    duration: 0 // 战斗持续回合数
  };

  // 简单预测逻辑
  if (strengthRatio > 1.3) {
    prediction.winner = analysis.attacker.name;
    prediction.confidence = Math.min(0.9, 0.5 + (strengthRatio - 1) * 0.2);
    prediction.attackerCasualties = Math.floor(attackerStrength * 0.1);
    prediction.defenderCasualties = Math.floor(defenderStrength * 0.4);
    prediction.duration = 1;
  } else if (strengthRatio < 0.7) {
    prediction.winner = analysis.defender.name;
    prediction.confidence = Math.min(0.9, 0.5 + (1 / strengthRatio - 1) * 0.2);
    prediction.attackerCasualties = Math.floor(attackerStrength * 0.4);
    prediction.defenderCasualties = Math.floor(defenderStrength * 0.1);
    prediction.duration = 1;
  } else {
    prediction.winner = '胶着';
    prediction.confidence = 0.5;
    prediction.attackerCasualties = Math.floor(attackerStrength * 0.2);
    prediction.defenderCasualties = Math.floor(defenderStrength * 0.2);
    prediction.duration = 2;
  }

  return prediction;
}

// 生成战斗策略报告
function generateBattleStrategyReport(analysis) {
  if (!analysis) return '无战斗分析数据';

  var report = '【战斗策略分析】\n\n';

  // 进攻方
  report += '【进攻方：' + analysis.attacker.name + '】\n';
  report += '实力：' + Math.floor(analysis.attacker.strength) + ' | ';
  report += '士气：' + analysis.attacker.morale + '\n';
  if (analysis.attacker.commander) {
    report += '统帅：' + analysis.attacker.commander + '\n';
  }
  report += '推荐战术：\n';
  analysis.attacker.recommendedTactics.forEach(function(t, i) {
    report += '  ' + (i + 1) + '. ' + t.name + '（得分：' + t.score.toFixed(0) + '）\n';
    report += '     ' + t.description + '\n';
  });
  report += '\n';

  // 防守方
  report += '【防守方：' + analysis.defender.name + '】\n';
  report += '实力：' + Math.floor(analysis.defender.strength) + ' | ';
  report += '士气：' + analysis.defender.morale + '\n';
  if (analysis.defender.commander) {
    report += '统帅：' + analysis.defender.commander + '\n';
  }
  report += '推荐战术：\n';
  analysis.defender.recommendedTactics.forEach(function(t, i) {
    report += '  ' + (i + 1) + '. ' + t.name + '（得分：' + t.score.toFixed(0) + '）\n';
    report += '     ' + t.description + '\n';
  });
  report += '\n';

  // 战场环境
  report += '【战场环境】\n';
  report += '地形：' + analysis.terrain + ' | 天气：' + analysis.weather + '\n\n';

  // 预测结果
  if (analysis.prediction) {
    report += '【战果预测】\n';
    report += '预测胜者：' + analysis.prediction.winner + '\n';
    report += '置信度：' + (analysis.prediction.confidence * 100).toFixed(0) + '%\n';
    report += '预计伤亡：\n';
    report += '  进攻方：' + analysis.prediction.attackerCasualties + ' 人\n';
    report += '  防守方：' + analysis.prediction.defenderCasualties + ' 人\n';
    report += '预计持续：' + analysis.prediction.duration + ' 回合\n';
  }

  return report;
}

// 执行战术（应用战术效果）
function executeTactic(army, tacticKey, tacticCategory) {
  var tactics = TacticTypes[tacticCategory];
  if (!tactics || !tactics[tacticKey]) {
    return { success: false, reason: '战术不存在' };
  }

  var tactic = tactics[tacticKey];

  // 应用士气消耗
  if (army.morale !== undefined) {
    army.morale = Math.max(0, army.morale - tactic.moraleCost);
  }

  // 应用伤亡
  if (army.soldiers !== undefined) {
    var casualties = Math.floor(army.soldiers * tactic.casualtyRate);
    army.soldiers = Math.max(0, army.soldiers - casualties);
  }

  // 记录战术使用
  addEB('战术', army.name + ' 使用战术：' + tactic.name);

  return {
    success: true,
    tactic: tactic,
    moraleLoss: tactic.moraleCost,
    casualties: Math.floor((army.soldiers || 0) * tactic.casualtyRate)
  };
}

// ============================================================
// 战斗结算引擎（BattleEngine）
// 接通已有 analyzeBattleStrategy + calculateArmyStrength + predictBattleOutcome
// 输出确定性战斗结果，注入AI prompt作为不可更改事实
// ============================================================

var BattleEngine = (function() {
  'use strict';

  /**
   * 获取战斗配置（编辑器可调）
   */
  function _getConfig() {
    var cfg = (P && P.battleConfig) || {};
    return {
      enabled: cfg.enabled !== false,
      thresholds: cfg.thresholds || { decisive: 1.5, victory: 1.0, stalemate: 0.7 },
      varianceRange: typeof cfg.varianceRange === 'number' ? cfg.varianceRange : 0.15,
      seasonMod: cfg.seasonMod || { '春': 1.0, '夏': 0.95, '秋': 1.0, '冬': 0.85 },
      fortLevelBonus: cfg.fortLevelBonus || [1.0, 1.3, 1.6, 2.0, 2.5, 3.0],
      terrainModifiers: cfg.terrainModifiers || null
    };
  }

  /**
   * 获取当前季节名
   */
  function _getSeason() {
    if (!P.time) return '春';
    var perTurn = P.time.perTurn || '1m';
    var startMonth = P.time.startMonth || 1;
    var turnMonths = 0;
    if (perTurn === '1d') turnMonths = (GM.turn - 1) / 30;
    else if (perTurn === '1m') turnMonths = GM.turn - 1;
    else if (perTurn === '1s') turnMonths = (GM.turn - 1) * 3;
    else if (perTurn === '1y') turnMonths = (GM.turn - 1) * 12;
    else if (perTurn === 'custom' && P.time.customDays) turnMonths = (GM.turn - 1) * P.time.customDays / 30;
    var curMonth = ((startMonth - 1 + turnMonths) % 12) + 1;
    if (curMonth <= 3) return '春';
    if (curMonth <= 6) return '夏';
    if (curMonth <= 9) return '秋';
    return '冬';
  }

  /**
   * 获取地形修正系数
   * @param {string} terrain - 地形类型
   * @returns {{attackMod:number, defenseMod:number}}
   */
  function _getTerrainMod(terrain) {
    var cfg = _getConfig();
    // 优先使用编辑器配置的地形修正
    if (cfg.terrainModifiers && cfg.terrainModifiers[terrain]) {
      var t = cfg.terrainModifiers[terrain];
      return { attackMod: t.attackMod || 1.0, defenseMod: t.defenseMod || 1.0 };
    }
    // 默认地形修正（硬编码兜底）
    var defaults = {
      plains: { attackMod: 1.0, defenseMod: 1.0 },
      hills: { attackMod: 0.85, defenseMod: 1.15 },
      mountain: { attackMod: 0.7, defenseMod: 1.3 },
      river: { attackMod: 0.8, defenseMod: 1.0 },
      swamp: { attackMod: 0.6, defenseMod: 0.8 },
      desert: { attackMod: 0.9, defenseMod: 0.9 },
      forest: { attackMod: 0.75, defenseMod: 1.2 }
    };
    return defaults[terrain] || { attackMod: 1.0, defenseMod: 1.0 };
  }

  /**
   * 确定性战斗结算
   * @param {Object} attackerArmy - 攻方军队 {name, soldiers, morale, training, quality, commander, faction}
   * @param {Object} defenderArmy - 守方军队
   * @param {Object} context - 战场上下文 {terrain, weather, fortLevel, season, battleId}
   * @returns {Object} 结算结果 {winner, loser, attackerLoss, defenderLoss, ratio, verdict, report}
   */
  function resolve(attackerArmy, defenderArmy, context) {
    var cfg = _getConfig();
    if (!cfg.enabled) return null; // 未启用战斗引擎，回退AI自由裁量

    context = context || {};
    var terrain = context.terrain || 'plains';
    var fortLevel = context.fortLevel || 0;
    var season = context.season || _getSeason();

    // 1. 调用已有函数计算双方战力
    var attackStrength = calculateArmyStrength(attackerArmy);
    var defendStrength = calculateArmyStrength(defenderArmy);

    // 2. 应用地形修正
    var tMod = _getTerrainMod(terrain);
    attackStrength *= tMod.attackMod;
    defendStrength *= tMod.defenseMod;

    // 3. 应用城防加成（围城战守方加成）
    if (fortLevel > 0 && fortLevel < cfg.fortLevelBonus.length) {
      defendStrength *= cfg.fortLevelBonus[fortLevel];
    } else if (fortLevel >= cfg.fortLevelBonus.length) {
      defendStrength *= cfg.fortLevelBonus[cfg.fortLevelBonus.length - 1];
    }

    // 4. 应用季节修正
    var sMod = cfg.seasonMod[season] || 1.0;
    attackStrength *= sMod;
    defendStrength *= sMod;

    // 5. 计算比值 + 确定性随机偏差
    var rawRatio = attackStrength / Math.max(defendStrength, 1);
    var battleSeed = (_rngState.seed || 'battle') + '_T' + GM.turn + '_' + (context.battleId || attackerArmy.name);
    var subRng = createSubRng(battleSeed);
    var variance = (subRng() - 0.5) * 2 * cfg.varianceRange; // ±varianceRange
    var ratio = rawRatio * (1 + variance);

    // 6. 按阈值判定结果
    var th = cfg.thresholds;
    var verdict, attackerLossRate, defenderLossRate;

    if (ratio >= th.decisive) {
      verdict = '大胜';
      attackerLossRate = 0.10 + subRng() * 0.10; // 10-20%
      defenderLossRate = 0.30 + subRng() * 0.20; // 30-50%
    } else if (ratio >= th.victory) {
      verdict = '小胜';
      attackerLossRate = 0.15 + subRng() * 0.10; // 15-25%
      defenderLossRate = 0.20 + subRng() * 0.10; // 20-30%
    } else if (ratio >= th.stalemate) {
      verdict = '僵持';
      attackerLossRate = 0.10 + subRng() * 0.10; // 10-20%
      defenderLossRate = 0.10 + subRng() * 0.10; // 10-20%
    } else {
      verdict = '败北';
      attackerLossRate = 0.25 + subRng() * 0.15; // 25-40%
      defenderLossRate = 0.10 + subRng() * 0.05; // 10-15%
    }

    // 7. 按timeRatio缩放伤亡（日制下一回合战斗消耗远小于年制）
    // 但战斗本身是一次性事件——不按时间缩放，而是按"战斗强度"缩放
    // 如果回合=1天，一天的战斗损失应该比一年的小
    // 使用sqrt(timeRatio×12)作为强度因子：月制=1.0，日制≈0.18，年制≈3.46
    var intensityFactor = Math.min(1.0, Math.sqrt((typeof getTimeRatio === 'function' ? getTimeRatio() : 1 / 12) * 12));

    var attackerSoldiers = attackerArmy.soldiers || attackerArmy.strength || 0;
    var defenderSoldiers = defenderArmy.soldiers || defenderArmy.strength || 0;
    var attackerLoss = Math.floor(attackerSoldiers * attackerLossRate * intensityFactor);
    var defenderLoss = Math.floor(defenderSoldiers * defenderLossRate * intensityFactor);

    // 8. 确定胜负方名称
    var winner, loser;
    if (verdict === '大胜' || verdict === '小胜') {
      winner = attackerArmy.name || attackerArmy.faction || '攻方';
      loser = defenderArmy.name || defenderArmy.faction || '守方';
    } else if (verdict === '败北') {
      winner = defenderArmy.name || defenderArmy.faction || '守方';
      loser = attackerArmy.name || attackerArmy.faction || '攻方';
    } else {
      winner = '僵持';
      loser = '僵持';
    }

    // 9. 同时调用已有分析获取战术推荐（供AI叙事参考，非约束）
    var analysis = analyzeBattleStrategy(attackerArmy, defenderArmy, context);
    var tacticHint = '';
    if (analysis && analysis.attacker.recommendedTactics.length > 0) {
      tacticHint = '攻方推荐战术: ' + analysis.attacker.recommendedTactics[0].name;
    }
    if (analysis && analysis.defender.recommendedTactics.length > 0) {
      tacticHint += ' | 守方推荐战术: ' + analysis.defender.recommendedTactics[0].name;
    }

    var result = {
      battleId: context.battleId || uid(),
      turn: GM.turn,
      attacker: attackerArmy.name || attackerArmy.faction,
      defender: defenderArmy.name || defenderArmy.faction,
      attackerFaction: attackerArmy.faction,
      defenderFaction: defenderArmy.faction,
      attackerSoldiers: attackerSoldiers,
      defenderSoldiers: defenderSoldiers,
      terrain: terrain,
      fortLevel: fortLevel,
      season: season,
      rawRatio: Math.round(rawRatio * 100) / 100,
      adjustedRatio: Math.round(ratio * 100) / 100,
      verdict: verdict,
      winner: winner,
      loser: loser,
      attackerLoss: attackerLoss,
      defenderLoss: defenderLoss,
      tacticHint: tacticHint,
      intensityFactor: Math.round(intensityFactor * 100) / 100
    };

    // 10. 生成可读报告（注入AI prompt用）
    result.report = _formatReport(result);

    _dbg('[BattleEngine]', result.attacker, 'vs', result.defender,
         '比值' + result.adjustedRatio, '→', result.verdict,
         '损' + result.attackerLoss + '/' + result.defenderLoss);

    return result;
  }

  /**
   * 格式化战斗报告（注入AI prompt）
   */
  function _formatReport(r) {
    var s = r.attacker + '(' + r.attackerSoldiers + '人)';
    s += ' vs ' + r.defender + '(' + r.defenderSoldiers + '人)';
    s += ' 地形:' + r.terrain;
    if (r.fortLevel > 0) s += ' 城防:' + r.fortLevel + '级';
    s += ' 季节:' + r.season;
    s += ' 比值:' + r.adjustedRatio;
    s += ' → ' + r.verdict + '。';
    s += r.attacker + '损失' + r.attackerLoss + '人，';
    s += r.defender + '损失' + r.defenderLoss + '人。';
    if (r.verdict === '大胜' || r.verdict === '小胜') {
      s += r.winner + '胜。';
    } else if (r.verdict === '败北') {
      s += r.winner + '胜，' + r.loser + '败退。';
    } else {
      s += '双方僵持不下。';
    }
    if (r.tacticHint) s += ' (' + r.tacticHint + ')';
    return s;
  }

  /**
   * 批量结算本回合所有进行中的战斗
   * 从 GM.activeBattles 读取，结果写入 GM._turnBattleResults
   * 在 _endTurn_updateSystems 中调用（SettlementPipeline注册）
   */
  function resolveAllBattles() {
    if (!GM.activeBattles || !GM.activeBattles.length) return;
    if (!GM._turnBattleResults) GM._turnBattleResults = [];

    var cfg = _getConfig();
    if (!cfg.enabled) return;

    GM.activeBattles.forEach(function(battle) {
      if (battle.phase === 'resolved') return; // 已结算
      if (battle.phase === 'march') return;    // 行军中，未接战

      // 查找对应军队
      var attackerArmy = (GM.armies || []).find(function(a) {
        return a.name === battle.attackerArmy || a.faction === battle.attackerFaction;
      });
      var defenderArmy = (GM.armies || []).find(function(a) {
        return a.name === battle.defenderArmy || a.faction === battle.defenderFaction;
      });

      if (!attackerArmy || !defenderArmy) return;

      // 地形：优先battle字段 → 省份数据 → 默认平原
      var _bTerrain = battle.terrain;
      if (!_bTerrain && battle.location && GM.provinceStats && GM.provinceStats[battle.location]) {
        _bTerrain = GM.provinceStats[battle.location].terrain;
      }
      var result = resolve(attackerArmy, defenderArmy, {
        terrain: _bTerrain || 'plains',
        fortLevel: battle.fortLevel || 0,
        battleId: battle.id
      });

      if (result) {
        // 应用伤亡到军队
        attackerArmy.soldiers = Math.max(0, (attackerArmy.soldiers || 0) - result.attackerLoss);
        defenderArmy.soldiers = Math.max(0, (defenderArmy.soldiers || 0) - result.defenderLoss);

        // 应用士气影响
        if (result.verdict === '败北') {
          attackerArmy.morale = Math.max(0, (attackerArmy.morale || 70) - 15);
          defenderArmy.morale = Math.min(100, (defenderArmy.morale || 70) + 10);
        } else if (result.verdict === '大胜' || result.verdict === '小胜') {
          attackerArmy.morale = Math.min(100, (attackerArmy.morale || 70) + 10);
          defenderArmy.morale = Math.max(0, (defenderArmy.morale || 70) - 15);
        }

        // 标记战斗为已结算
        battle.phase = 'resolved';
        battle.result = result;

        // 记入本回合结果
        GM._turnBattleResults.push(result);

        // 记入历史
        if (!GM.battleHistory) GM.battleHistory = [];
        GM.battleHistory.push(result);
        if (GM.battleHistory.length > 100) GM.battleHistory = GM.battleHistory.slice(-100);
      }
    });

    // 清理已结算的战斗
    GM.activeBattles = GM.activeBattles.filter(function(b) { return b.phase !== 'resolved'; });
  }

  /**
   * 生成本回合全部战斗的AI prompt注入文本
   * @returns {string} 注入AI的战况摘要
   */
  function getPromptInjection() {
    if (!GM._turnBattleResults || !GM._turnBattleResults.length) return '';
    var lines = ['【机械结算·战况（胜负和数字不可更改，请据此叙事）】'];
    GM._turnBattleResults.forEach(function(r) {
      lines.push('  ' + r.report);
      lines.push('  → 请描述战役经过，可自由发挥战术细节、天气氛围、将领表现，但数字不可改。');
    });
    return lines.join('\n');
  }

  return {
    resolve: resolve,
    resolveAllBattles: resolveAllBattles,
    getPromptInjection: getPromptInjection,
    _getConfig: _getConfig,
    _getTerrainMod: _getTerrainMod,
    _getSeason: _getSeason
  };
})();

// ============================================================
// 行军系统（MarchSystem）— 双模式：地图寻路 / AI地理推演
// ============================================================

var MarchSystem = (function() {
  'use strict';

  function _getConfig() {
    var mc = (P && P.battleConfig && P.battleConfig.marchConfig) || {};
    return {
      enabled: mc.enabled === true,
      baseSpeeds: mc.baseSpeeds || { infantry: 1, cavalry: 2, siege: 0.5 },
      postRoadBonus: mc.postRoadBonus || 0.5,
      winterPenalty: mc.winterPenalty || 0.7,
      largeSizeThreshold: mc.largeSizeThreshold || 50000,
      largeSizePenalty: mc.largeSizePenalty || 0.8,
      noMap: mc.noMap || {
        baseKmPerDay: { infantry: 30, cavalry: 50, siege: 15 },
        officialRoadBonus: 1.2,
        noRoadPenalty: 0.8,
        commanderAdminWeight: 0.005
      }
    };
  }

  /**
   * 创建行军命令
   * @param {Object} army - 军队对象
   * @param {string} from - 出发地
   * @param {string} to - 目的地
   * @param {Object} [aiGeoData] - AI地理推演数据(无地图模式) {routeKm, terrainDifficulty, hasOfficialRoad, estimatedDaysBase}
   * @returns {Object|null} marchOrder
   */
  function createMarchOrder(army, from, to, aiGeoData) {
    var cfg = _getConfig();
    if (!cfg.enabled) return null;

    var mapEnabled = P && P.map && P.map.enabled && GM.mapData && GM.mapData.adjacencyGraph;
    var marchDays = 0;
    var routeDesc = '';
    var path = [];

    if (mapEnabled && typeof findPath === 'function') {
      // ═══ 地图模式：A*寻路 ═══
      var pathResult = findPath(from, to, { avoidEnemy: true, faction: army.faction });
      if (pathResult) {
        path = pathResult.path || [];
        var distance = path.length;
        var baseSpeed = _getMinSpeed(army, cfg.baseSpeeds);
        var seasonMod = _getSeasonMod(cfg);
        var sizeMod = (army.soldiers || 0) > cfg.largeSizeThreshold ? cfg.largeSizePenalty : 1.0;
        var hasRoad = pathResult.hasPostRoad || false;
        var speed = baseSpeed * (hasRoad ? (1 + cfg.postRoadBonus) : 1.0) * seasonMod * sizeMod;
        marchDays = Math.ceil(distance * 30 / Math.max(speed, 0.1)); // 距离单位=领地，速度=领地/月
        routeDesc = '经' + path.join('→');
      }
    } else if (aiGeoData && aiGeoData.routeKm) {
      // ═══ 无地图模式：AI地理推演 ═══
      var noMapCfg = cfg.noMap;
      var mainType = _getMainUnitType(army);
      var baseKmDay = (noMapCfg.baseKmPerDay && noMapCfg.baseKmPerDay[mainType]) || 30;
      var terrainMod = aiGeoData.terrainDifficulty || 0.8;
      var roadMod = aiGeoData.hasOfficialRoad ? (noMapCfg.officialRoadBonus || 1.2) : (noMapCfg.noRoadPenalty || 0.8);
      var commanderMod = 1.0;
      if (army.commander) {
        var cmd = typeof findCharByName === 'function' ? findCharByName(army.commander) : null;
        if (cmd) commanderMod = 1 + (cmd.administration || 50) * (noMapCfg.commanderAdminWeight || 0.005);
      }
      var supplyMod = (army.supplyRatio !== undefined && army.supplyRatio < 0.5) ? 0.7 : 1.0;
      var seasonMod2 = _getSeasonMod(cfg);
      var sizeMod2 = (army.soldiers || 0) > cfg.largeSizeThreshold ? cfg.largeSizePenalty : 1.0;
      var actualKmDay = baseKmDay * terrainMod * roadMod * commanderMod * supplyMod * seasonMod2 * sizeMod2;
      marchDays = Math.ceil(aiGeoData.routeKm / Math.max(actualKmDay, 1));
      routeDesc = aiGeoData.routeDescription || (from + '→' + to);
      path = aiGeoData.passesAndBarriers || [];
    } else {
      // ═══ 兜底：无地图+无AI推演，使用估算 ═══
      marchDays = 15; // 默认半个月
      routeDesc = from + '→' + to + '(估算)';
    }

    // 转换天数为回合数
    var turnDays = (typeof getTurnDays === 'function') ? getTurnDays() : 30;
    var marchTurns = Math.max(1, Math.ceil(marchDays / turnDays));

    var order = {
      id: uid(),
      armyId: army.id || army.name,
      armyName: army.name,
      from: from,
      to: to,
      path: path,
      routeDescription: routeDesc,
      totalDays: marchDays,
      totalTurns: marchTurns,
      progress: 0,
      startTurn: GM.turn,
      eta: GM.turn + marchTurns,
      status: 'marching',
      terrain: aiGeoData ? (aiGeoData.terrainDifficulty > 0.8 ? 'mountain' : aiGeoData.terrainDifficulty > 0.6 ? 'hills' : 'plains') : 'plains',
      passesAndBarriers: aiGeoData ? (aiGeoData.passesAndBarriers || []) : []
    };

    if (!GM.marchOrders) GM.marchOrders = [];
    GM.marchOrders.push(order);

    addEB('行军', army.name + '从' + from + '出发前往' + to + '，预计' + marchDays + '天(' + marchTurns + '回合)到达。' + routeDesc);
    _dbg('[March]', army.name, from, '→', to, marchDays + '天/' + marchTurns + '回合');

    return order;
  }

  /**
   * 每回合推进行军进度
   */
  function advanceAll() {
    if (!GM.marchOrders || !GM.marchOrders.length) return;
    GM.marchOrders.forEach(function(order) {
      if (order.status !== 'marching') return;
      order.progress++;
      if (order.progress >= order.totalTurns) {
        order.status = 'arrived';
        // 无地图模式：根据行军距离设置补给效率衰减
        var _army2 = (GM.armies||[]).find(function(a){return a.id===order.armyId||a.name===order.armyName;});
        if (_army2 && order.totalDays) {
          _army2.supplyRatio = Math.max(0.3, 1.0 - (order.totalDays / 1000) * 0.3);
        }
        addEB('行军', (order.armyName || '某军') + '已抵达' + order.to + '。');
        _dbg('[March] 到达:', order.armyName, order.to);
      }
    });
    // 清理已到达的
    GM.marchOrders = GM.marchOrders.filter(function(o) { return o.status === 'marching'; });
  }

  /**
   * 生成AI prompt注入
   */
  function getPromptInjection() {
    if (!GM.marchOrders || !GM.marchOrders.length) return '';
    var lines = ['【行军状况】'];
    GM.marchOrders.forEach(function(o) {
      if (o.status !== 'marching') return;
      var remaining = o.totalTurns - o.progress;
      lines.push('  ' + (o.armyName||'某军') + ': ' + o.from + '→' + o.to +
        ' 进度' + o.progress + '/' + o.totalTurns + '回合 剩余' + remaining + '回合' +
        (o.routeDescription ? ' (' + o.routeDescription + ')' : ''));
    });
    return lines.length > 1 ? lines.join('\n') : '';
  }

  // ─── 内部辅助 ───

  function _getMinSpeed(army, baseSpeeds) {
    // 取军队中最慢兵种的速度
    if (army.composition && Array.isArray(army.composition) && army.composition.length > 0) {
      var minSpeed = Infinity;
      army.composition.forEach(function(c) {
        var spd = baseSpeeds[c.type] || baseSpeeds[c.unitTypeId] || 1;
        if (spd < minSpeed) minSpeed = spd;
      });
      return minSpeed === Infinity ? 1 : minSpeed;
    }
    return baseSpeeds.infantry || 1;
  }

  function _getMainUnitType(army) {
    if (army.composition && Array.isArray(army.composition) && army.composition.length > 0) {
      var maxCount = 0, mainType = 'infantry';
      army.composition.forEach(function(c) {
        if ((c.count || 0) > maxCount) { maxCount = c.count; mainType = c.type || c.unitTypeId || 'infantry'; }
      });
      return mainType;
    }
    return 'infantry';
  }

  function _getSeasonMod(cfg) {
    if (typeof BattleEngine !== 'undefined') {
      var season = BattleEngine._getSeason();
      var sMods = (P.battleConfig && P.battleConfig.seasonMod) || {};
      var mod = sMods[season];
      if (typeof mod === 'number') return mod;
    }
    return 1.0;
  }

  return {
    createMarchOrder: createMarchOrder,
    advanceAll: advanceAll,
    getPromptInjection: getPromptInjection,
    _getConfig: _getConfig
  };
})();

// 注册行军推进到SettlementPipeline
SettlementPipeline.register('march', '行军推进', function() {
  if (MarchSystem._getConfig().enabled) MarchSystem.advanceAll();
}, 33, 'perturn'); // priority 33: 在provinceEconomy(35)之前，行军先完成再计算地方区划

// ============================================================
// 围城系统（SiegeSystem）— 双模式
// ============================================================

var SiegeSystem = (function() {
  'use strict';

  function _getConfig() {
    var sc = (P && P.battleConfig && P.battleConfig.siegeConfig) || {};
    return {
      enabled: sc.enabled === true,
      progressCoeff: sc.progressCoeff || 0.15,
      defenderAttritionRate: sc.defenderAttritionRate || 0.03,
      attackerAttritionRate: sc.attackerAttritionRate || 0.01,
      starvationMoraleLoss: sc.starvationMoraleLoss || 15,
      surrenderMoraleThreshold: sc.surrenderMoraleThreshold || 10
    };
  }

  /**
   * 创建围城
   * @param {Object} attackerArmy - 围城军
   * @param {string} targetCity - 目标城市名
   * @param {number} [fortLevel] - 城防等级(0-5)，无地图时由AI指定
   * @param {number} [garrison] - 守军人数，无则估算
   * @returns {Object|null} siege对象
   */
  function createSiege(attackerArmy, targetCity, fortLevel, garrison) {
    var cfg = _getConfig();
    if (!cfg.enabled) return null;

    fortLevel = fortLevel || 0;
    garrison = garrison || 3000;

    var siege = {
      id: uid(),
      attackerArmy: attackerArmy.name || attackerArmy.id,
      attackerFaction: attackerArmy.faction,
      targetCity: targetCity,
      fortLevel: fortLevel,
      garrison: garrison,
      garrisonMorale: 70,
      garrisonSupply: 100, // 0-100 百分比
      progress: 0,         // 0 → 1.0（≥1.0城陷）
      startTurn: GM.turn,
      status: 'ongoing'    // 'ongoing' | 'fallen' | 'surrendered' | 'lifted'
    };

    if (!GM.activeSieges) GM.activeSieges = [];
    GM.activeSieges.push(siege);

    addEB('围城', attackerArmy.name + '开始围困' + targetCity + '（城防' + fortLevel + '级，守军' + garrison + '）');
    return siege;
  }

  /**
   * 每回合推进所有围城
   */
  function advanceAll() {
    if (!GM.activeSieges || !GM.activeSieges.length) return;

    var cfg = _getConfig();
    var tr = (typeof getTimeRatio === 'function') ? getTimeRatio() : (1/12);
    var scale = tr * 12; // 月度缩放因子

    GM.activeSieges.forEach(function(siege) {
      if (siege.status !== 'ongoing') return;

      // 查找围城军
      var attacker = (GM.armies || []).find(function(a) {
        return a.name === siege.attackerArmy || a.id === siege.attackerArmy;
      });
      var attackerTroops = attacker ? (attacker.soldiers || 0) : 10000;

      // 计算围城值（如果有兵种数据则用siegeValue，否则用兵力/1000）
      var siegeValue = attackerTroops / 1000;
      if (attacker && attacker.composition && Array.isArray(attacker.composition)) {
        var totalSV = 0;
        attacker.composition.forEach(function(c) {
          var ut = (typeof getUnitTypes === 'function') ? getUnitTypes()[c.type || c.unitTypeId] : null;
          totalSV += (c.count || 0) / 1000 * ((ut && ut.siegeValue) || 3);
        });
        if (totalSV > 0) siegeValue = totalSV;
      }

      // 围城进度（按月度缩放）
      var progressDelta = siegeValue / Math.max(siege.garrison / 1000 + siege.fortLevel * 0.5, 0.1) * cfg.progressCoeff * scale;
      siege.progress += progressDelta;

      // 守军损耗
      var defAttrition = Math.floor(siege.garrison * cfg.defenderAttritionRate * (1 - siege.garrisonSupply / 100) * scale);
      siege.garrison = Math.max(0, siege.garrison - defAttrition);

      // 围城军损耗
      if (attacker) {
        var attAttrition = Math.floor(attackerTroops * cfg.attackerAttritionRate * scale);
        attacker.soldiers = Math.max(0, (attacker.soldiers || 0) - attAttrition);
      }

      // 守军补给消耗（每月-8%，按timeRatio缩放）
      siege.garrisonSupply = Math.max(0, siege.garrisonSupply - 8 * scale);

      // 断粮效果
      if (siege.garrisonSupply <= 0) {
        siege.garrisonMorale = Math.max(0, siege.garrisonMorale - cfg.starvationMoraleLoss * scale);
        siege.garrison = Math.max(0, siege.garrison - Math.floor(siege.garrison * 0.05 * scale));
      }

      // 判定结果
      if (siege.progress >= 1.0) {
        siege.status = 'fallen';
        addEB('围城', siege.targetCity + '城破！' + (siege.attackerFaction || '') + '攻陷城池。');
      } else if (siege.garrisonMorale <= cfg.surrenderMoraleThreshold) {
        siege.status = 'surrendered';
        addEB('围城', siege.targetCity + '守军士气崩溃，开城投降。');
      } else if (siege.garrison <= 0) {
        siege.status = 'fallen';
        addEB('围城', siege.targetCity + '守军全灭，城池失守。');
      }
    });

    // 清理已结束的围城
    var resolved = GM.activeSieges.filter(function(s) { return s.status !== 'ongoing'; });
    if (resolved.length > 0) {
      if (!GM._turnSiegeResults) GM._turnSiegeResults = [];
      resolved.forEach(function(s) { GM._turnSiegeResults.push(s); });
    }
    GM.activeSieges = GM.activeSieges.filter(function(s) { return s.status === 'ongoing'; });
  }

  /**
   * AI prompt注入
   */
  function getPromptInjection() {
    var lines = [];
    if (GM.activeSieges && GM.activeSieges.length > 0) {
      lines.push('【围城状况】');
      GM.activeSieges.forEach(function(s) {
        lines.push('  ' + (s.attackerFaction||'') + '围困' + s.targetCity +
          ' 进度' + (s.progress*100).toFixed(0) + '% 城防' + s.fortLevel + '级' +
          ' 守军' + s.garrison + '(士气' + s.garrisonMorale + ')' +
          (s.garrisonSupply <= 0 ? ' ⚠断粮' : ' 补给' + s.garrisonSupply + '%'));
      });
    }
    if (GM._turnSiegeResults && GM._turnSiegeResults.length > 0) {
      lines.push('【围城结果（不可更改）】');
      GM._turnSiegeResults.forEach(function(s) {
        lines.push('  ' + s.targetCity + ': ' + (s.status === 'fallen' ? '城破' : s.status === 'surrendered' ? '投降' : s.status));
      });
    }
    return lines.length > 0 ? lines.join('\n') : '';
  }

  return {
    createSiege: createSiege,
    advanceAll: advanceAll,
    getPromptInjection: getPromptInjection,
    _getConfig: _getConfig
  };
})();

// 注册围城推进到SettlementPipeline
SettlementPipeline.register('siege', '围城结算', function() {
  if (SiegeSystem._getConfig().enabled) {
    GM._turnSiegeResults = [];
    SiegeSystem.advanceAll();
  }
}, 36, 'perturn');

// ============================================================
// 军队编制（Unit）系统
// ============================================================

// Unit 系统：多兵种管理，不替换现有 army.soldiers
// 作为增强层提供更细粒度的军队组织

// 兵种类型定义（默认硬编码，可被编辑器 P.battleConfig.unitTypes 覆盖）
var _DEFAULT_UNIT_TYPES = {
  infantry: {
    name: '步兵',
    baseCost: 10, upkeep: 2,
    attack: 5, defense: 6, speed: 3, morale: 5, siegeValue: 3,
    description: '基础步兵单位，防御力强'
  },
  cavalry: {
    name: '骑兵',
    baseCost: 30, upkeep: 6,
    attack: 8, defense: 4, speed: 9, morale: 7, siegeValue: 1,
    description: '机动性强，冲击力大'
  },
  archer: {
    name: '弓箭手',
    baseCost: 15, upkeep: 3,
    attack: 7, defense: 3, speed: 4, morale: 4, siegeValue: 2,
    description: '远程攻击单位'
  },
  spearman: {
    name: '长矛兵',
    baseCost: 12, upkeep: 2,
    attack: 6, defense: 7, speed: 3, morale: 5, siegeValue: 3,
    description: '克制骑兵的步兵单位'
  },
  crossbowman: {
    name: '弩兵',
    baseCost: 20, upkeep: 4,
    attack: 8, defense: 4, speed: 3, morale: 5, siegeValue: 4,
    description: '强力远程单位，穿透力强'
  },
  heavy_cavalry: {
    name: '重骑兵',
    baseCost: 50, upkeep: 10,
    attack: 10, defense: 7, speed: 7, morale: 8, siegeValue: 1,
    description: '精锐骑兵，攻防兼备'
  },
  siege: {
    name: '攻城器械',
    baseCost: 100, upkeep: 15,
    attack: 12, defense: 2, speed: 1, morale: 3, siegeValue: 10,
    description: '攻城专用，移动缓慢'
  }
};

/**
 * 获取兵种定义（优先编辑器配置，回退硬编码默认）
 * 编辑器中用户可自定义兵种（如秦朝加"弩兵阵"，宋朝加"神臂弓手"）
 * @returns {Object} 兵种类型映射 {id: {name, attack, defense, speed, ...}}
 */
function getUnitTypes() {
  // 优先使用编辑器配置的兵种
  if (P && P.battleConfig && P.battleConfig.unitTypes && Array.isArray(P.battleConfig.unitTypes) && P.battleConfig.unitTypes.length > 0) {
    var map = {};
    P.battleConfig.unitTypes.forEach(function(ut) {
      if (ut && ut.id) map[ut.id] = ut;
    });
    return map;
  }
  return _DEFAULT_UNIT_TYPES;
}

// 兼容性别名——让所有现有 UnitTypes[x] 引用仍然工作（向后兼容）
var UnitTypes = _DEFAULT_UNIT_TYPES;

/**
 * 渲染战斗配置编辑器面板（在编辑器的军事面板中调用）
 * @param {string} containerId - 容器DOM ID
 */
function renderBattleConfigEditor(containerId) {
  var el = document.getElementById(containerId);
  if (!el) return;
  if (!scriptData.battleConfig) scriptData.battleConfig = {enabled:true,thresholds:{decisive:1.5,victory:1.0,stalemate:0.7},varianceRange:0.15,unitTypes:null,terrainModifiers:null};
  var bc = scriptData.battleConfig;

  var html = '<div class="cd"><h4>⚔ 战斗结算系统</h4>';
  html += '<div class="toggle-wrap"><label class="toggle"><input type="checkbox" '+(bc.enabled!==false?'checked':'')+' onchange="scriptData.battleConfig.enabled=this.checked;if(typeof autoSave===\'function\')autoSave()"><span class="toggle-slider"></span></label><div>启用战斗机械结算（AI叙事前先计算确定性战果）</div></div>';

  // 阈值配置
  var th = bc.thresholds || {};
  html += '<div style="margin-top:8px"><div style="font-size:12px;color:var(--txt-d);margin-bottom:4px">比值阈值（攻方战力/守方战力）</div>';
  html += '<div style="display:flex;gap:8px;flex-wrap:wrap">';
  html += '<label style="font-size:12px">大胜≥<input type="number" step="0.1" value="'+(th.decisive||1.5)+'" style="width:50px" onchange="if(!scriptData.battleConfig.thresholds)scriptData.battleConfig.thresholds={};scriptData.battleConfig.thresholds.decisive=parseFloat(this.value)||1.5"></label>';
  html += '<label style="font-size:12px">小胜≥<input type="number" step="0.1" value="'+(th.victory||1.0)+'" style="width:50px" onchange="scriptData.battleConfig.thresholds.victory=parseFloat(this.value)||1.0"></label>';
  html += '<label style="font-size:12px">僵持≥<input type="number" step="0.1" value="'+(th.stalemate||0.7)+'" style="width:50px" onchange="scriptData.battleConfig.thresholds.stalemate=parseFloat(this.value)||0.7"></label>';
  html += '</div></div>';

  // 随机偏差
  html += '<div style="margin-top:6px"><label style="font-size:12px">随机偏差幅度 ±<input type="number" step="0.05" value="'+(bc.varianceRange||0.15)+'" style="width:50px" onchange="scriptData.battleConfig.varianceRange=parseFloat(this.value)||0.15"> (0=完全确定，0.3=高随机性)</label></div>';

  html += '</div>';

  // 兵种定义
  html += '<div class="cd" style="margin-top:10px"><h4>🗡 兵种定义</h4>';
  html += '<div style="font-size:11px;color:var(--txt-d);margin-bottom:6px">自定义本朝代兵种。留空则使用默认7兵种（步兵/骑兵/弓箭手/长矛兵/弩兵/重骑兵/攻城器械）</div>';

  var units = bc.unitTypes || [];
  if (units.length > 0) {
    units.forEach(function(u, i) {
      html += '<div style="border:1px solid var(--bg-4);border-radius:4px;padding:6px 8px;margin-bottom:4px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">';
      html += '<b style="min-width:60px">' + escHtml(u.name||u.id) + '</b>';
      html += '<span style="font-size:11px;color:var(--txt-d)">攻'+( u.attack||0)+' 防'+(u.defense||0)+' 速'+(u.speed||0)+' 攻城'+(u.siegeValue||0)+' 费'+(u.baseCost||0)+'</span>';
      html += '<button class="bd bsm" onclick="editBattleUnitType('+i+')">编辑</button>';
      html += '<button class="bd bsm" onclick="deleteBattleUnitType('+i+')">删</button>';
      html += '</div>';
    });
  } else {
    html += '<div style="font-size:12px;color:var(--txt-d);padding:4px">未自定义（使用默认兵种）</div>';
  }
  html += '<button class="bt bs bsm" onclick="addBattleUnitType()" style="margin-top:4px">+ 添加兵种</button>';
  html += '</div>';

  // 地形修正配置
  html += '<div class="cd" style="margin-top:10px"><h4>🏔 地形战斗修正</h4>';
  html += '<div style="font-size:11px;color:var(--txt-d);margin-bottom:6px">自定义地形对攻守方的修正系数。留空则使用默认值。攻方修正<1.0表示进攻不利，守方修正>1.0表示防守有利。</div>';
  var tm = bc.terrainModifiers || {};
  var defaultTerrains = [
    {id:'plains', name:'平原', aDef:1.0, dDef:1.0},
    {id:'hills', name:'丘陵', aDef:0.85, dDef:1.15},
    {id:'mountain', name:'山地', aDef:0.7, dDef:1.3},
    {id:'river', name:'河流', aDef:0.8, dDef:1.0},
    {id:'swamp', name:'沼泽', aDef:0.6, dDef:0.8},
    {id:'desert', name:'沙漠', aDef:0.9, dDef:0.9},
    {id:'forest', name:'林地', aDef:0.75, dDef:1.2}
  ];
  html += '<table style="font-size:12px;border-collapse:collapse;width:100%"><tr style="border-bottom:1px solid var(--bg-4)"><th style="text-align:left;padding:3px">地形</th><th>攻方修正</th><th>守方修正</th></tr>';
  defaultTerrains.forEach(function(t) {
    var cur = tm[t.id] || {};
    var aVal = cur.attackMod !== undefined ? cur.attackMod : t.aDef;
    var dVal = cur.defenseMod !== undefined ? cur.defenseMod : t.dDef;
    html += '<tr><td style="padding:3px">' + t.name + '(' + t.id + ')</td>';
    html += '<td style="text-align:center"><input type="number" step="0.05" value="' + aVal + '" style="width:50px" onchange="if(!scriptData.battleConfig.terrainModifiers)scriptData.battleConfig.terrainModifiers={};if(!scriptData.battleConfig.terrainModifiers[\'' + t.id + '\'])scriptData.battleConfig.terrainModifiers[\'' + t.id + '\']={};scriptData.battleConfig.terrainModifiers[\'' + t.id + '\'].attackMod=parseFloat(this.value)||' + t.aDef + '"></td>';
    html += '<td style="text-align:center"><input type="number" step="0.05" value="' + dVal + '" style="width:50px" onchange="if(!scriptData.battleConfig.terrainModifiers)scriptData.battleConfig.terrainModifiers={};if(!scriptData.battleConfig.terrainModifiers[\'' + t.id + '\'])scriptData.battleConfig.terrainModifiers[\'' + t.id + '\']={};scriptData.battleConfig.terrainModifiers[\'' + t.id + '\'].defenseMod=parseFloat(this.value)||' + t.dDef + '"></td>';
    html += '</tr>';
  });
  html += '</table>';
  html += '<div style="font-size:11px;color:var(--txt-d);margin-top:4px">无地图时：AI根据剧本地理知识自动判断战场地形类型</div>';
  html += '</div>';

  // 行军配置
  var mcfg = bc.marchConfig || {};
  html += '<div class="cd" style="margin-top:10px"><h4>🚩 行军系统</h4>';
  html += '<div class="toggle-wrap"><label class="toggle"><input type="checkbox" '+(mcfg.enabled?'checked':'')+' onchange="if(!scriptData.battleConfig.marchConfig)scriptData.battleConfig.marchConfig={};scriptData.battleConfig.marchConfig.enabled=this.checked;if(typeof autoSave===\'function\')autoSave()"><span class="toggle-slider"></span></label><div>启用行军距离系统（军队移动需要时间，非瞬间到达）</div></div>';
  html += '<div style="font-size:11px;color:var(--txt-d);margin:4px 0">有地图：A*寻路计算距离。无地图：AI查询历史地理知识（地理志、距离、地形、驿道）估算行军时间。</div>';
  html += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px">';
  var bs = mcfg.baseSpeeds || {};
  html += '<label style="font-size:12px">步兵速度(领地/月)<input type="number" step="0.5" value="'+(bs.infantry||1)+'" style="width:45px" onchange="if(!scriptData.battleConfig.marchConfig)scriptData.battleConfig.marchConfig={};if(!scriptData.battleConfig.marchConfig.baseSpeeds)scriptData.battleConfig.marchConfig.baseSpeeds={};scriptData.battleConfig.marchConfig.baseSpeeds.infantry=parseFloat(this.value)||1"></label>';
  html += '<label style="font-size:12px">骑兵速度<input type="number" step="0.5" value="'+(bs.cavalry||2)+'" style="width:45px" onchange="if(!scriptData.battleConfig.marchConfig.baseSpeeds)scriptData.battleConfig.marchConfig.baseSpeeds={};scriptData.battleConfig.marchConfig.baseSpeeds.cavalry=parseFloat(this.value)||2"></label>';
  html += '<label style="font-size:12px">辎重速度<input type="number" step="0.1" value="'+(bs.siege||0.5)+'" style="width:45px" onchange="if(!scriptData.battleConfig.marchConfig.baseSpeeds)scriptData.battleConfig.marchConfig.baseSpeeds={};scriptData.battleConfig.marchConfig.baseSpeeds.siege=parseFloat(this.value)||0.5"></label>';
  html += '</div>';
  var nm = mcfg.noMap || {};
  html += '<div style="margin-top:6px;font-size:12px;color:var(--txt-d)"><b>无地图模式参数（AI地理推演用）</b></div>';
  html += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:2px">';
  var bk = nm.baseKmPerDay || {};
  html += '<label style="font-size:12px">步兵日行(km)<input type="number" value="'+(bk.infantry||30)+'" style="width:45px" onchange="if(!scriptData.battleConfig.marchConfig.noMap)scriptData.battleConfig.marchConfig.noMap={};if(!scriptData.battleConfig.marchConfig.noMap.baseKmPerDay)scriptData.battleConfig.marchConfig.noMap.baseKmPerDay={};scriptData.battleConfig.marchConfig.noMap.baseKmPerDay.infantry=parseInt(this.value)||30"></label>';
  html += '<label style="font-size:12px">骑兵日行(km)<input type="number" value="'+(bk.cavalry||50)+'" style="width:45px" onchange="if(!scriptData.battleConfig.marchConfig.noMap.baseKmPerDay)scriptData.battleConfig.marchConfig.noMap.baseKmPerDay={};scriptData.battleConfig.marchConfig.noMap.baseKmPerDay.cavalry=parseInt(this.value)||50"></label>';
  html += '</div></div>';

  // 围城配置
  var sgc = bc.siegeConfig || {};
  html += '<div class="cd" style="margin-top:10px"><h4>🏯 围城系统</h4>';
  html += '<div class="toggle-wrap"><label class="toggle"><input type="checkbox" '+(sgc.enabled?'checked':'')+' onchange="if(!scriptData.battleConfig.siegeConfig)scriptData.battleConfig.siegeConfig={};scriptData.battleConfig.siegeConfig.enabled=this.checked;if(typeof autoSave===\'function\')autoSave()"><span class="toggle-slider"></span></label><div>启用围城系统（攻城需要时间，守军可坚守/投降/突围）</div></div>';
  html += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px">';
  html += '<label style="font-size:12px">进度系数<input type="number" step="0.05" value="'+(sgc.progressCoeff||0.15)+'" style="width:45px" onchange="if(!scriptData.battleConfig.siegeConfig)scriptData.battleConfig.siegeConfig={};scriptData.battleConfig.siegeConfig.progressCoeff=parseFloat(this.value)||0.15"></label>';
  html += '<label style="font-size:12px">守军月损耗<input type="number" step="0.01" value="'+(sgc.defenderAttritionRate||0.03)+'" style="width:45px" onchange="scriptData.battleConfig.siegeConfig.defenderAttritionRate=parseFloat(this.value)||0.03"></label>';
  html += '<label style="font-size:12px">投降士气阈值<input type="number" value="'+(sgc.surrenderMoraleThreshold||10)+'" style="width:45px" onchange="scriptData.battleConfig.siegeConfig.surrenderMoraleThreshold=parseInt(this.value)||10"></label>';
  html += '</div>';
  html += '<div style="font-size:11px;color:var(--txt-d);margin-top:4px">无地图时城防等级由AI据史料判断（如"潼关"→5级雄关，"许昌"→2级平原城镇）</div>';
  html += '</div>';

  // 后勤/补给配置
  var sc = bc.supplyConfig || {};
  html += '<div class="cd" style="margin-top:10px"><h4>📦 后勤补给</h4>';
  html += '<div class="toggle-wrap"><label class="toggle"><input type="checkbox" '+(sc.enabled?'checked':'')+' onchange="if(!scriptData.battleConfig.supplyConfig)scriptData.battleConfig.supplyConfig={};scriptData.battleConfig.supplyConfig.enabled=this.checked;if(typeof autoSave===\'function\')autoSave()"><span class="toggle-slider"></span></label><div>启用补给消耗系统（军队消耗粮草武器，断供导致士气崩溃）</div></div>';
  html += '<div style="font-size:11px;color:var(--txt-d);margin:4px 0">天命已内置完整补给系统（生产/消耗/运输/断供惩罚）。开启后军队每回合自动消耗补给，断粮会导致兵变。</div>';
  html += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px">';
  html += '<label style="font-size:12px">低补给士气损失/月<input type="number" value="'+(sc.lowSupplyMoraleLoss||10)+'" style="width:45px" onchange="if(!scriptData.battleConfig.supplyConfig)scriptData.battleConfig.supplyConfig={};scriptData.battleConfig.supplyConfig.lowSupplyMoraleLoss=parseInt(this.value)||10"></label>';
  html += '<label style="font-size:12px">断粮士气损失/月<input type="number" value="'+(sc.starvationMoraleLoss||20)+'" style="width:45px" onchange="if(!scriptData.battleConfig.supplyConfig)scriptData.battleConfig.supplyConfig={};scriptData.battleConfig.supplyConfig.starvationMoraleLoss=parseInt(this.value)||20"></label>';
  html += '</div></div>';

  el.innerHTML = html;
}

/** 添加自定义兵种 */
function addBattleUnitType() {
  if (!scriptData.battleConfig) scriptData.battleConfig = {};
  if (!scriptData.battleConfig.unitTypes) scriptData.battleConfig.unitTypes = [];

  var fields = [
    {key:'id', label:'兵种ID(英文)', default:'new_unit_'+Date.now()},
    {key:'name', label:'兵种名称', default:'新兵种'},
    {key:'attack', label:'攻击力(1-15)', default:'6', type:'number'},
    {key:'defense', label:'防御力(1-15)', default:'6', type:'number'},
    {key:'speed', label:'速度(1-10)', default:'3', type:'number'},
    {key:'siegeValue', label:'攻城值(0-10)', default:'3', type:'number'},
    {key:'baseCost', label:'基础花费', default:'15', type:'number'},
    {key:'upkeep', label:'维护费/月', default:'3', type:'number'},
    {key:'morale', label:'基础士气', default:'5', type:'number'},
    {key:'description', label:'描述', default:''}
  ];

  var body = fields.map(function(f) {
    return '<div class="fd"><label>'+f.label+'</label><input id="bcut-'+f.key+'" value="'+f.default+'" '+(f.type==='number'?'type="number"':'')+' style="width:100%"></div>';
  }).join('');

  openEditorModal('添加兵种', body, function() {
    var ut = {};
    fields.forEach(function(f) {
      var el = document.getElementById('bcut-'+f.key);
      ut[f.key] = f.type === 'number' ? (parseFloat(el.value) || 0) : (el.value || '');
    });
    scriptData.battleConfig.unitTypes.push(ut);
    if (typeof autoSave === 'function') autoSave();
    renderBattleConfigEditor('battleConfigContainer');
  });
}

/** 编辑兵种 */
function editBattleUnitType(index) {
  var ut = scriptData.battleConfig.unitTypes[index];
  if (!ut) return;

  var fields = ['id','name','attack','defense','speed','siegeValue','baseCost','upkeep','morale','description'];
  var labels = {id:'兵种ID',name:'名称',attack:'攻击力',defense:'防御力',speed:'速度',siegeValue:'攻城值',baseCost:'花费',upkeep:'维护费',morale:'士气',description:'描述'};
  var numFields = ['attack','defense','speed','siegeValue','baseCost','upkeep','morale'];

  var body = fields.map(function(f) {
    var isNum = numFields.indexOf(f) >= 0;
    return '<div class="fd"><label>'+labels[f]+'</label><input id="bcut-'+f+'" value="'+(ut[f]||'')+'" '+(isNum?'type="number"':'')+' style="width:100%"></div>';
  }).join('');

  openEditorModal('编辑兵种 - ' + (ut.name||ut.id), body, function() {
    fields.forEach(function(f) {
      var el = document.getElementById('bcut-'+f);
      ut[f] = numFields.indexOf(f)>=0 ? (parseFloat(el.value)||0) : (el.value||'');
    });
    if (typeof autoSave === 'function') autoSave();
    renderBattleConfigEditor('battleConfigContainer');
  });
}

/** 删除兵种 */
function deleteBattleUnitType(index) {
  scriptData.battleConfig.unitTypes.splice(index, 1);
  if (scriptData.battleConfig.unitTypes.length === 0) scriptData.battleConfig.unitTypes = null;
  if (typeof autoSave === 'function') autoSave();
  renderBattleConfigEditor('battleConfigContainer');
}

// 初始化 Unit 系统
function initUnitSystem() {
  if (!P.unitSystem || !P.unitSystem.enabled) return;

  GM.units = GM.units || [];
  GM._indices.unitById = GM._indices.unitById || new Map();

  // 从现有军队创建 Unit
  if (GM.armies && GM.armies.length > 0) {
    GM.armies.forEach(function(army) {
      if (!army.units || army.units.length === 0) {
        // 为没有 Unit 的军队创建默认编制
        var defaultUnits = createDefaultUnits(army);
        army.units = defaultUnits.map(function(u) { return u.id; });
        defaultUnits.forEach(function(u) {
          GM.units.push(u);
          addToIndex('unit', u.id, u);
        });
      }
    });
  }
}

// 创建默认编制
function createDefaultUnits(army) {
  var totalSoldiers = army.soldiers || 1000;
  var units = [];

  // 默认编制：60% 步兵，20% 弓箭手，20% 骑兵
  var infantryCount = Math.floor(totalSoldiers * 0.6);
  var archerCount = Math.floor(totalSoldiers * 0.2);
  var cavalryCount = totalSoldiers - infantryCount - archerCount;

  if (infantryCount > 0) {
    units.push(createUnit('infantry', infantryCount, army));
  }
  if (archerCount > 0) {
    units.push(createUnit('archer', archerCount, army));
  }
  if (cavalryCount > 0) {
    units.push(createUnit('cavalry', cavalryCount, army));
  }

  return units;
}

// 创建 Unit
function createUnit(type, count, army) {
  var unitType = getUnitTypes()[type];
  if (!unitType) return null;

  var unit = {
    id: uid(),
    type: type,
    name: unitType.name,
    count: count,
    armyId: army.id,
    armyName: army.name,
    morale: army.morale || 70,
    experience: 0,
    equipment: 'standard',
    status: 'ready',
    createdTurn: GM.turn
  };

  return unit;
}

// 更新 Unit 系统
function updateUnitSystem() {
  if (!P.unitSystem || !P.unitSystem.enabled || !GM.units) return;

  GM.units.forEach(function(unit) {
    // 更新士气
    var army = GM.armies.find(function(a) { return a.id === unit.armyId; });
    if (army) {
      unit.morale = army.morale || 70;
    }

    // 经验增长（月基准0.5，按天数缩放）
    if (unit.status === 'ready') {
      var _ums = (typeof _getDaysPerTurn === 'function' ? _getDaysPerTurn() : 30) / 30;
      unit.experience = Math.min(100, unit.experience + 0.5 * _ums);
    }

    // 维护费用
    var unitType = getUnitTypes()[unit.type];
    if (unitType && army) {
      var upkeepCost = unitType.upkeep * unit.count;
      // 这里可以从军队或势力扣除维护费
    }
  });

  // 同步军队总兵力
  GM.armies.forEach(function(army) {
    if (army.units && army.units.length > 0) {
      var totalSoldiers = 0;
      army.units.forEach(function(unitId) {
        var unit = GM._indices.unitById.get(unitId);
        if (unit) {
          totalSoldiers += unit.count;
        }
      });
      army.soldiers = totalSoldiers;
    }
  });
}

// 计算 Unit 战斗力
function calculateUnitCombatPower(unit) {
  if (!unit) return 0;

  var unitType = getUnitTypes()[unit.type];
  if (!unitType) return unit.count;

  var basePower = (unitType.attack + unitType.defense) / 2;
  var moraleMod = unit.morale / 100;
  var experienceMod = 1 + unit.experience / 200;

  return unit.count * basePower * moraleMod * experienceMod;
}

// 计算军队总战斗力（基于 Unit）
function calculateArmyCombatPowerByUnits(army) {
  if (!army || !army.units || army.units.length === 0) {
    return calculateArmyStrength(army); // 回退到旧系统
  }

  var totalPower = 0;
  army.units.forEach(function(unitId) {
    var unit = GM._indices.unitById.get(unitId);
    if (unit) {
      totalPower += calculateUnitCombatPower(unit);
    }
  });

  return totalPower;
}

// 招募 Unit
function recruitUnit(army, type, count) {
  if (!army || !type || count <= 0) {
    return { success: false, reason: '参数无效' };
  }

  var unitType = getUnitTypes()[type];
  if (!unitType) {
    return { success: false, reason: '兵种不存在' };
  }

  var totalCost = unitType.baseCost * count;

  // 检查势力财政
  var faction = findFacByName(army.faction);
  if (!faction || faction.money < totalCost) {
    return { success: false, reason: '资金不足' };
  }

  // 扣除费用
  faction.money -= totalCost;

  // 创建 Unit
  var unit = createUnit(type, count, army);
  if (!GM.units) GM.units = [];
  GM.units.push(unit);
  addToIndex('unit', unit.id, unit);

  // 添加到军队
  if (!army.units) army.units = [];
  army.units.push(unit.id);

  // 更新军队总兵力
  army.soldiers = (army.soldiers || 0) + count;

  addEB('招募', army.name + ' 招募了 ' + count + ' 名' + unitType.name);

  return { success: true, unit: unit, cost: totalCost };
}

// 解散 Unit
function disbandUnit(unitId) {
  var unit = GM._indices.unitById.get(unitId);
  if (!unit) {
    return { success: false, reason: 'Unit 不存在' };
  }

  var army = GM.armies.find(function(a) { return a.id === unit.armyId; });
  if (army) {
    // 从军队移除
    army.units = army.units.filter(function(id) { return id !== unitId; });
    // 更新总兵力
    army.soldiers = Math.max(0, (army.soldiers || 0) - unit.count);
  }

  // 从索引移除
  removeFromIndex('unit', unitId);

  // 从列表移除
  GM.units = GM.units.filter(function(u) { return u.id !== unitId; });

  addEB('解散', unit.name + ' 已解散（' + unit.count + ' 人）');

  return { success: true };
}

// 转移 Unit
function transferUnit(unitId, targetArmyId) {
  var unit = GM._indices.unitById.get(unitId);
  if (!unit) {
    return { success: false, reason: 'Unit 不存在' };
  }

  var targetArmy = GM.armies.find(function(a) { return a.id === targetArmyId; });
  if (!targetArmy) {
    return { success: false, reason: '目标军队不存在' };
  }

  var sourceArmy = GM.armies.find(function(a) { return a.id === unit.armyId; });

  // 从源军队移除
  if (sourceArmy) {
    sourceArmy.units = sourceArmy.units.filter(function(id) { return id !== unitId; });
    sourceArmy.soldiers = Math.max(0, (sourceArmy.soldiers || 0) - unit.count);
  }

  // 添加到目标军队
  if (!targetArmy.units) targetArmy.units = [];
  targetArmy.units.push(unitId);
  targetArmy.soldiers = (targetArmy.soldiers || 0) + unit.count;

  // 更新 Unit 归属
  unit.armyId = targetArmyId;
  unit.armyName = targetArmy.name;

  addEB('调动', unit.name + ' 从 ' + (sourceArmy ? sourceArmy.name : '未知') + ' 调往 ' + targetArmy.name);

  return { success: true };
}

// 生成军队编制报告
function generateArmyCompositionReport(army) {
  if (!army) return '无军队数据';

  var report = '【军队编制：' + army.name + '】\n\n';
  report += '总兵力：' + (army.soldiers || 0) + ' 人\n';
  report += '士气：' + (army.morale || 70) + '\n';
  if (army.commander) {
    report += '统帅：' + army.commander + '\n';
  }
  report += '\n';

  if (!army.units || army.units.length === 0) {
    report += '（未启用编制系统）\n';
    return report;
  }

  report += '【兵种构成】\n';
  army.units.forEach(function(unitId) {
    var unit = GM._indices.unitById.get(unitId);
    if (unit) {
      var unitType = getUnitTypes()[unit.type];
      report += '• ' + unit.name + '：' + unit.count + ' 人\n';
      if (unitType) {
        report += '  攻击：' + unitType.attack + ' | 防御：' + unitType.defense + ' | 速度：' + unitType.speed + '\n';
      }
      report += '  士气：' + unit.morale + ' | 经验：' + unit.experience.toFixed(0) + '\n';
      report += '  战斗力：' + calculateUnitCombatPower(unit).toFixed(0) + '\n';
    }
  });

  report += '\n总战斗力：' + calculateArmyCombatPowerByUnits(army).toFixed(0) + '\n';

  return report;
}

// ============================================================
// 补给系统
// ============================================================

// 补给系统：增强战略深度，不影响现有战斗逻辑
// 提供补给链路管理（生产→运输→消耗）

// 补给类型定义
var SupplyTypes = {
  food: { name: '粮草', weight: 1, consumeRate: 1 },
  weapon: { name: '武器', weight: 2, consumeRate: 0.1 },
  armor: { name: '盔甲', weight: 3, consumeRate: 0.05 },
  medicine: { name: '药品', weight: 0.5, consumeRate: 0.2 },
  fodder: { name: '马料', weight: 1.5, consumeRate: 0.5 }
};

// 初始化补给系统
function initSupplySystem() {
  if (!P.supplySystem || !P.supplySystem.enabled) return;

  GM.supplyDepots = GM.supplyDepots || [];
  GM.supplyRoutes = GM.supplyRoutes || [];
  GM._indices.supplyDepotById = GM._indices.supplyDepotById || new Map();

  // 为每个势力创建主要补给仓库
  (GM.facs || []).forEach(function(faction) {
    if (!faction.supplyDepots || faction.supplyDepots.length === 0) {
      var depot = createSupplyDepot(faction.name + '主仓', faction.name, faction.capital || '未知');
      GM.supplyDepots.push(depot);
      addToIndex('supplyDepot', depot.id, depot);

      if (!faction.supplyDepots) faction.supplyDepots = [];
      faction.supplyDepots.push(depot.id);
    }
  });
}

// 创建补给仓库
function createSupplyDepot(name, factionName, location) {
  var depot = {
    id: uid(),
    name: name,
    faction: factionName,
    location: location,
    capacity: 10000,
    supplies: {
      food: 5000,
      weapon: 1000,
      armor: 500,
      medicine: 200,
      fodder: 1000
    },
    createdTurn: GM.turn
  };
  return depot;
}

// ============================================================
// 建筑系统 - 借鉴 KingOfIreland Barony 建筑
// ============================================================

// 建筑类型定义（中国古代背景）
var BUILDING_TYPES = {
  // 经济类建筑
  farmland: { name: '农田', category: 'economy', maxLevel: 5 },
  market: { name: '集市', category: 'economy', maxLevel: 5 },
  workshop: { name: '工坊', category: 'economy', maxLevel: 5 },
  mine: { name: '矿场', category: 'economy', maxLevel: 5 },

  // 军事类建筑
  barracks: { name: '兵营', category: 'military', maxLevel: 5 },
  stable: { name: '马厩', category: 'military', maxLevel: 5 },
  arsenal: { name: '军械库', category: 'military', maxLevel: 5 },
  fortress: { name: '城防', category: 'military', maxLevel: 5 },

  // 文化类建筑
  academy: { name: '书院', category: 'culture', maxLevel: 5 },
  temple: { name: '庙宇', category: 'culture', maxLevel: 5 },
  library: { name: '藏书楼', category: 'culture', maxLevel: 5 },

  // 行政类建筑
  office: { name: '官署', category: 'administration', maxLevel: 5 },
  warehouse: { name: '仓库', category: 'administration', maxLevel: 5 }
};

// 建筑��果计算（按等级）— 优先使用编辑器结构化效果，回退到硬编码
function getBuildingEffects(type, level) {
  var effects = {
    monthlyIncome: 0, monthlyTax: 0, levy: 0, garrison: 0,
    fortLevel: 0, culturalInfluence: 0, administrativeEfficiency: 0, prosperity: 0
  };

  // 优先从 BUILDING_TYPES 中的 structuredEffects 计算
  var btDef = BUILDING_TYPES[type];
  if (btDef && btDef.structuredEffects) {
    var se = btDef.structuredEffects;
    effects.monthlyIncome = (se.monthlyIncome || 0) * level;
    effects.monthlyTax = (se.monthlyTax || 0) * level;
    effects.levy = (se.levy || 0) * level;
    effects.garrison = (se.garrison || 0) * level;
    effects.fortLevel = (se.fortLevel || 0) * level;
    effects.culturalInfluence = (se.culturalInfluence || 0) * level;
    effects.administrativeEfficiency = (se.adminEfficiency || 0) * level;
    effects.prosperity = (se.prosperity || 0) * level;
    return effects;
  }

  // 回退：硬编码默认值
  switch(type) {
    case 'farmland': effects.monthlyIncome = 50 * level; effects.monthlyTax = 20 * level; break;
    case 'market': effects.monthlyIncome = 80 * level; effects.monthlyTax = 30 * level; break;
    case 'workshop': effects.monthlyIncome = 60 * level; effects.monthlyTax = 25 * level; break;
    case 'mine': effects.monthlyIncome = 100 * level; effects.monthlyTax = 40 * level; break;
    case 'barracks': effects.levy = 50 * level; effects.garrison = 20 * level; break;
    case 'stable': effects.levy = 30 * level; effects.garrison = 10 * level; break;
    case 'arsenal': effects.levy = 40 * level; break;
    case 'fortress': effects.garrison = 100 * level; effects.fortLevel = level; break;
    case 'academy': effects.culturalInfluence = 10 * level; effects.administrativeEfficiency = 5 * level; break;
    case 'temple': effects.culturalInfluence = 8 * level; break;
    case 'library': effects.culturalInfluence = 12 * level; break;
    case 'office': effects.administrativeEfficiency = 10 * level; effects.monthlyTax = 15 * level; break;
    case 'warehouse': effects.monthlyIncome = 30 * level; break;
  }

  return effects;
}

// 建筑升级成本计算（优先用编辑器配置）
function getBuildingCost(type, level) {
  var btDef = BUILDING_TYPES[type];
  var baseCost = (btDef && btDef.baseCost) ? btDef.baseCost : 1000;

  // 如果没有编辑器配置，按类别回退
  if (!btDef || !btDef.baseCost) {
    var category = btDef ? btDef.category : 'economy';
    switch(category) {
      case 'economy': case 'economic': baseCost = 800; break;
      case 'military': baseCost = 1200; break;
      case 'culture': case 'cultural': baseCost = 1000; break;
      case 'administration': case 'administrative': baseCost = 900; break;
    }
  }

  return Math.floor(baseCost * Math.pow(1.5, level - 1));
}

// 建筑升级耗时计算（优先用编辑器配置）
function getBuildingTime(type, level) {
  var btDef = BUILDING_TYPES[type];
  var baseTime = (btDef && btDef.buildTime) ? btDef.buildTime : 3;

  if (!btDef || !btDef.buildTime) {
    var category = btDef ? btDef.category : 'economy';
    switch(category) {
      case 'economy': case 'economic': baseTime = 2; break;
      case 'military': baseTime = 4; break;
      case 'culture': case 'cultural': baseTime = 3; break;
      case 'administration': case 'administrative': baseTime = 3; break;
    }
  }

  return Math.floor(baseTime * Math.pow(1.3, level - 1));
}

// 初始化建筑系统
function initBuildingSystem() {
  if (!P.buildingSystem || !P.buildingSystem.enabled) return;

  // 从编辑器配置加载建筑类型到运行时注册表
  if (P.buildingSystem.buildingTypes && P.buildingSystem.buildingTypes.length > 0) {
    P.buildingSystem.buildingTypes.forEach(function(bt) {
      var key = (bt.name || '').replace(/\s/g, '_').toLowerCase();
      if (!key) return;
      // 合入 BUILDING_TYPES（编辑器配置优先于硬编码）
      BUILDING_TYPES[key] = {
        name: bt.name,
        category: bt.category || 'economic',
        maxLevel: bt.maxLevel || 5,
        baseCost: bt.baseCost || 1000,
        buildTime: bt.buildTime || 3,
        structuredEffects: bt.structuredEffects || null,
        description: bt.description || '',
        requirements: bt.requirements || ''
      };
    });
  }

  GM.buildings = GM.buildings || [];
  GM.buildingQueue = GM.buildingQueue || [];
  GM._indices.buildingById = GM._indices.buildingById || new Map();
  GM._indices.buildingByTerritory = GM._indices.buildingByTerritory || new Map();

  // 为每个势力的领地创建初始建筑
  (GM.facs || []).forEach(function(faction) {
    if (!faction.territories || faction.territories.length === 0) {
      var territory = faction.capital || faction.name + '领地';
      createInitialBuildings(faction.name, territory);
    } else {
      faction.territories.forEach(function(territory) {
        createInitialBuildings(faction.name, territory);
      });
    }
  });
}

// 为领地创建初始建筑
function createInitialBuildings(factionName, territory) {
  // 每个领地默认有农田1级和城防1级
  var farmland = createBuilding('farmland', 1, factionName, territory);
  var fortress = createBuilding('fortress', 1, factionName, territory);

  GM.buildings.push(farmland);
  GM.buildings.push(fortress);

  addToIndex('building', farmland.id, farmland);
  addToIndex('building', fortress.id, fortress);

  // 按领地索引
  if (!GM._indices.buildingByTerritory.has(territory)) {
    GM._indices.buildingByTerritory.set(territory, []);
  }
  GM._indices.buildingByTerritory.get(territory).push(farmland);
  GM._indices.buildingByTerritory.get(territory).push(fortress);
}

// 创建建筑
function createBuilding(type, level, factionName, territory) {
  var buildingInfo = BUILDING_TYPES[type];
  var effects = getBuildingEffects(type, level);

  var building = {
    id: uid(),
    type: type,
    name: buildingInfo ? buildingInfo.name : '未知建筑',
    level: level,
    faction: factionName,
    territory: territory,
    effects: effects,
    createdTurn: GM.turn,
    lastUpgradedTurn: GM.turn
  };

  return building;
}

// 开始建造/升级建筑
function startBuildingUpgrade(buildingId, factionName) {
  var building = GM._indices.buildingById ? GM._indices.buildingById.get(buildingId) : null;
  if (!building) {
    toast('建筑不存在');
    return false;
  }

  var buildingInfo = BUILDING_TYPES[building.type];
  if (!buildingInfo) {
    toast('建筑类型无效');
    return false;
  }

  // 检查是否已达到最大等级
  if (building.level >= buildingInfo.maxLevel) {
    toast(building.name + '已达到最大等级');
    return false;
  }

  var nextLevel = building.level + 1;
  var cost = getBuildingCost(building.type, nextLevel);
  var time = getBuildingTime(building.type, nextLevel);

  // 检查势力财政
  var faction = GM._indices.facByName ? GM._indices.facByName.get(factionName) : null;
  if (!faction) {
    toast('势力不存在');
    return false;
  }

  if (faction.money < cost) {
    toast('资金不足，需要 ' + cost + ' 金');
    return false;
  }

  // 扣除费用
  faction.money -= cost;

  // 添加到建造队列
  var task = {
    id: uid(),
    buildingId: buildingId,
    buildingName: building.name,
    type: building.type,
    currentLevel: building.level,
    targetLevel: nextLevel,
    faction: factionName,
    territory: building.territory,
    startTurn: GM.turn,
    completeTurn: GM.turn + time,
    cost: cost,
    time: time
  };

  GM.buildingQueue.push(task);

  toast(building.name + ' 开始升级至 ' + nextLevel + ' 级，预计 ' + time + ' 回合完成');
  return true;
}

// 更新建筑系统
function updateBuildingSystem() {
  if (!P.buildingSystem || !P.buildingSystem.enabled) return;
  if (!GM.buildingQueue || GM.buildingQueue.length === 0) return;

  var completedTasks = [];

  // 检查建造队列
  GM.buildingQueue.forEach(function(task) {
    if (GM.turn >= task.completeTurn) {
      // 建造完成
      var building = GM._indices.buildingById ? GM._indices.buildingById.get(task.buildingId) : null;
      if (building) {
        building.level = task.targetLevel;
        building.lastUpgradedTurn = GM.turn;
        building.effects = getBuildingEffects(building.type, building.level);

        toast(building.name + ' 升级至 ' + building.level + ' 级完成！');
        completedTasks.push(task.id);
      }
    }
  });

  // 移除已完成的任务
  GM.buildingQueue = GM.buildingQueue.filter(function(task) {
    return completedTasks.indexOf(task.id) === -1;
  });
}

// 获取领地的所有建筑
function getTerritoryBuildings(territory) {
  if (GM._indices.buildingByTerritory && GM._indices.buildingByTerritory.has(territory)) {
    return GM._indices.buildingByTerritory.get(territory);
  }
  return [];
}

// 计算领地的建筑总效果
function calculateTerritoryBuildingEffects(territory) {
  var buildings = getTerritoryBuildings(territory);
  var totalEffects = {
    monthlyIncome: 0,
    monthlyTax: 0,
    levy: 0,
    garrison: 0,
    fortLevel: 0,
    culturalInfluence: 0,
    administrativeEfficiency: 0
  };

  buildings.forEach(function(building) {
    if (building.effects) {
      Object.keys(building.effects).forEach(function(key) {
        if (totalEffects.hasOwnProperty(key)) {
          totalEffects[key] += building.effects[key];
        }
      });
    }
  });

  return totalEffects;
}

// 在势力收入计算中应用建筑效果
function applyBuildingEffectsToFaction(faction) {
  if (!P.buildingSystem || !P.buildingSystem.enabled) return { income: 0, tax: 0 };
  if (!faction.territories || faction.territories.length === 0) return { income: 0, tax: 0 };

  var totalIncome = 0;
  var totalTax = 0;

  faction.territories.forEach(function(territory) {
    var effects = calculateTerritoryBuildingEffects(territory);
    totalIncome += effects.monthlyIncome;
    totalTax += effects.monthlyTax;
  });

  // 应用到势力收入
  if (totalIncome > 0) {
    faction.money = (faction.money || 0) + totalIncome;
  }

  return {
    income: totalIncome,
    tax: totalTax
  };
}

// ============================================================
// 2.5: 建筑产出公式（时间缩放版）
// 产出值为月基准 × getTimeRatio()*12
// 建造时间用天数（buildDays）配置，运行时转换为回合数
// ============================================================
function calculateBuildingOutput() {
  if (!P.buildingSystem || !P.buildingSystem.enabled) return;
  if (!GM.buildings || !GM.buildings.length) return;
  var tr = (typeof getTimeRatio === 'function') ? getTimeRatio() : (1/12);
  var monthScale = tr * 12;
  var balBuilding = (typeof getBalanceVal === 'function') ? getBalanceVal('building', {}) : {};
  var maxOutput = balBuilding.maxOutputPerTurn || {};
  var totalOutput = { money: 0, grain: 0, militaryStrength: 0 };
  var outputDescs = [];

  GM.buildings.forEach(function(b) {
    if (!b.effects || b.underConstruction) return;
    for (var key in b.effects) {
      if (!b.effects.hasOwnProperty(key)) continue;
      var monthBase = b.effects[key];
      if (typeof monthBase !== 'number' || monthBase === 0) continue;
      var scaled = monthBase * monthScale;
      // clamp单建筑单回合产出
      var cap = maxOutput[key];
      if (cap && Math.abs(scaled) > cap) scaled = scaled > 0 ? cap : -cap;
      totalOutput[key] = (totalOutput[key] || 0) + scaled;
    }
  });

  // 应用到 GM 经济状态（国库用 GM.stateTreasury，粮食查 GM.vars 中含"粮"的变量）
  if (totalOutput.money && typeof GM.stateTreasury === 'number') {
    var oldT = GM.stateTreasury;
    GM.stateTreasury += Math.round(totalOutput.money);
    if (typeof ChangeLog !== 'undefined') ChangeLog.record('building', 'treasury', 'treasury', oldT, GM.stateTreasury, '建筑产出');
  }
  if (totalOutput.grain && GM.vars) {
    // 查找粮食相关变量
    var _grainKey = null;
    Object.keys(GM.vars).forEach(function(vk) { if (/粮|grain/i.test(vk) && !_grainKey) _grainKey = vk; });
    if (_grainKey && GM.vars[_grainKey]) {
      var oldG = GM.vars[_grainKey].value || 0;
      GM.vars[_grainKey].value = oldG + Math.round(totalOutput.grain);
      if (typeof ChangeLog !== 'undefined') ChangeLog.record('building', _grainKey, 'value', oldG, GM.vars[_grainKey].value, '建筑产出');
    }
  }
  if (totalOutput.militaryStrength && typeof GM.militaryStrength === 'number') {
    var oldM = GM.militaryStrength;
    GM.militaryStrength += Math.round(totalOutput.militaryStrength);
    if (typeof ChangeLog !== 'undefined') ChangeLog.record('building', 'militaryStrength', 'militaryStrength', oldM, GM.militaryStrength, '建筑产出');
  }

  // 汇总供 AI prompt 注入
  for (var k in totalOutput) {
    if (totalOutput[k] && Math.abs(totalOutput[k]) >= 1) {
      outputDescs.push(k + (totalOutput[k] >= 0 ? '+' : '') + Math.round(totalOutput[k]));
    }
  }
  GM._buildingOutputReport = outputDescs.length ? '建筑产出：' + outputDescs.join('、') : '';
  if (outputDescs.length) {
    DebugLog.log('building', GM._buildingOutputReport);
  }
}

// 注册建筑产出到结算流水线（在 updateBuildingSystem 之后）
SettlementPipeline.register('buildingOutput', '建筑产出', function() {
  calculateBuildingOutput();
}, 30, 'perturn');

// ============================================================
// 4.2: 省级独立经济
// 每回合计算省份收入，月基准 × getTimeRatio()*12
// 字段用通用名（incomeRate而非taxRate），初始值从编辑器读取
// ============================================================
function calculateProvinceEconomy() {
  if (!GM.provinceStats) return;
  var tr = (typeof getTimeRatio === 'function') ? getTimeRatio() : (1 / 12);
  var monthScale = tr * 12;
  var provinceNames = Object.keys(GM.provinceStats);

  provinceNames.forEach(function(name) {
    var ps = GM.provinceStats[name];
    if (!ps) return;
    // 确保字段存在
    if (!ps.treasury) ps.treasury = { money: 0, grain: 0 };
    if (ps.population === undefined) ps.population = 0;
    if (ps.incomeRate === undefined) ps.incomeRate = 0;
    if (!ps.monthlyIncome) ps.monthlyIncome = { money: 0, grain: 0 };

    // 计算月收入：人口 × 收入率 × (1 - 腐败/100)
    var corruptionFactor = 1 - (ps.corruption || 0) / 100;
    var baseMonthlyMoney = (ps.population || 0) * (ps.incomeRate || 0) * corruptionFactor;

    // governor 能力加成
    if (ps.governor) {
      var gov = (typeof findCharByName === 'function') ? findCharByName(ps.governor) : null;
      if (gov && gov.alive !== false) {
        var adminSkill = (gov.administration || gov.intelligence || 50) / 100;
        baseMonthlyMoney *= (0.7 + adminSkill * 0.6); // 能力50=×1.0, 能力80=×1.18
      }
    }

    // 时间缩放
    var scaledMoney = baseMonthlyMoney * monthScale;
    var scaledGrain = (ps.population || 0) * 0.001 * corruptionFactor * monthScale; // 粮食简化计算

    ps.monthlyIncome = { money: Math.round(scaledMoney), grain: Math.round(scaledGrain) };
    ps.treasury.money = (ps.treasury.money || 0) + ps.monthlyIncome.money;
    ps.treasury.grain = (ps.treasury.grain || 0) + ps.monthlyIncome.grain;

    if (typeof ChangeLog !== 'undefined' && ps.monthlyIncome.money) {
      ChangeLog.record('economy', name, 'money', ps.treasury.money - ps.monthlyIncome.money, ps.treasury.money, '省份收入');
    }
  });
}

SettlementPipeline.register('provinceEconomy', '地方区划', function() {
  calculateProvinceEconomy();
}, 35, 'perturn');

// ============================================================
// 4.3: 战斗系统增强——动量+兵种差异（编辑器配置）
// 兵种从 P.militaryConfig.unitTypes[] 读取，不硬编码
// 围城 progress × timeRatio
// ============================================================
function enhancedResolveBattle(attacker, defender, context) {
  var milCfg = (typeof P !== 'undefined' && P.militaryConfig) ? P.militaryConfig : {};
  var unitTypes = milCfg.unitTypes || [];
  var phases = milCfg.battlePhases || [{ id: 'deploy' }, { id: 'clash' }, { id: 'decisive' }];
  var momCfg = milCfg.momentumConfig || { winGain: 0.15, losePenalty: 0.15, max: 1.5, min: 0.6 };

  // 初始化动量
  if (!attacker.momentum) attacker.momentum = 1.0;
  if (!defender.momentum) defender.momentum = 1.0;

  var result = { phases: [], winner: '', attLoss: 0, defLoss: 0 };

  // 计算兵种战力加成
  function _unitBonus(army, phaseId) {
    if (!army.unitType || !unitTypes.length) return 1.0;
    var ut = unitTypes.find(function(u) { return u.id === army.unitType; });
    if (!ut || !ut.stats) return 1.0;
    return (ut.stats[phaseId] || 5) / 5; // 归一化到基准5
  }

  // 按阶段计算
  for (var i = 0; i < phases.length; i++) {
    var phase = phases[i];
    var attCmd = context && context.attCommander ? (context.attCommander.military || 50) : 50;
    var defCmd = context && context.defCommander ? (context.defCommander.military || 50) : 50;

    var attPower = (attacker.strength || 1000) * (0.5 + attCmd * 0.005) * attacker.momentum * _unitBonus(attacker, phase.id);
    var defPower = (defender.strength || 1000) * (0.5 + defCmd * 0.005) * defender.momentum * _unitBonus(defender, phase.id);

    var phaseWinner = attPower > defPower ? 'attacker' : 'defender';
    var ratio = Math.max(attPower, defPower) / (Math.min(attPower, defPower) || 1);
    var phaseLoss = Math.round(Math.min(attacker.strength, defender.strength) * 0.05 * Math.min(ratio, 3));

    // 更新动量
    if (phaseWinner === 'attacker') {
      attacker.momentum = Math.min(momCfg.max, attacker.momentum + momCfg.winGain);
      defender.momentum = Math.max(momCfg.min, defender.momentum - momCfg.losePenalty);
      result.defLoss += phaseLoss;
    } else {
      defender.momentum = Math.min(momCfg.max, defender.momentum + momCfg.winGain);
      attacker.momentum = Math.max(momCfg.min, attacker.momentum - momCfg.losePenalty);
      result.attLoss += phaseLoss;
    }
    result.phases.push({ phase: phase.id, name: phase.name || phase.id, winner: phaseWinner, attPower: Math.round(attPower), defPower: Math.round(defPower) });
  }

  // 总胜负
  var attWins = result.phases.filter(function(p) { return p.winner === 'attacker'; }).length;
  result.winner = attWins > phases.length / 2 ? 'attacker' : 'defender';

  return result;
}

// 4.3: 围城进度计算（月基准 × timeRatio）
function calculateSiegeProgress(siege) {
  if (!siege || !siege.attackerStrength) return 0;
  var tr = (typeof getTimeRatio === 'function') ? getTimeRatio() : (1 / 12);
  var monthScale = tr * 12;
  var defenderFactor = (siege.population || 10000) / 500 + (siege.defenderStrength || 0) / 10;
  var progress = (siege.attackerStrength / (defenderFactor || 1)) * monthScale;
  return Math.min(100, Math.round(progress * 10) / 10);
}

// ============================================================
// 行政区划更新（每回合）— governor能力影响省份
// ============================================================
function updateAdminHierarchy() {
  if (!P.adminHierarchy || !GM.provinceStats) return;

  var _adminKeys = Object.keys(P.adminHierarchy);
  _adminKeys.forEach(function(k) {
    var ah = P.adminHierarchy[k];
    if (!ah || !ah.divisions) return;

    function _updateDiv(divs) {
      divs.forEach(function(d) {
        var ps = GM.provinceStats[d.name];
        if (ps) {
          if (d.governor) {
            // governor能力影响省份：好官减腐败增稳定，庸官反之
            var gov = GM.chars ? GM.chars.find(function(c) { return c.name === d.governor && c.alive !== false; }) : null;
            if (gov) {
              var adm = gov.administration || 50;
              var loy = gov.loyalty || 50;
              var _gms = (typeof _getDaysPerTurn === 'function' ? _getDaysPerTurn() : 30) / 30;
              if (adm > 60) ps.corruption = Math.max(0, ps.corruption - 0.5 * _gms);
              else if (adm < 30) ps.corruption = Math.min(100, ps.corruption + 0.5 * _gms);
              if (loy > 70) ps.stability = Math.min(100, ps.stability + 0.3 * _gms);
              else if (loy < 30) { ps.stability = Math.max(0, ps.stability - 0.5 * _gms); ps.corruption = Math.min(100, ps.corruption + 0.3 * _gms); }
            } else {
              d.governor = '';
              ps.governor = '';
            }
          } else {
            var _gms2 = (typeof _getDaysPerTurn === 'function' ? _getDaysPerTurn() : 30) / 30;
            ps.corruption = Math.min(100, ps.corruption + 0.5 * _gms2);
          }
          // 双向同步 prosperity ↔ wealth, population
          d.prosperity = ps.wealth;
          if (ps.population && d.population) {
            // 省份人口变化回写到行政区划
            d.population = ps.population;
          }
          // 行政区划地形/特产持续影响省份
          if (d.terrain && !ps.terrain) ps.terrain = d.terrain;
          if (d.specialResources && !ps.specialResources) ps.specialResources = d.specialResources;
          if (d.taxLevel && !ps.taxLevel) ps.taxLevel = d.taxLevel;
          // 同步governor
          ps.governor = d.governor || '';
        }
        if (d.children) _updateDiv(d.children);
      });
    }
    _updateDiv(ah.divisions);
  });
}

// ============================================================
// 皇城宫殿·妃嫔居所分配系统
// ============================================================

/**
 * 获取妃嫔的居所信息
 * @param {Object} character
 * @returns {Object|null} {palace, subHall} or null
 */
function getCharacterResidence(character) {
  if (!character || !character.residence || !P.palaceSystem) return null;
  var palaces = P.palaceSystem.palaces || [];
  var pal = palaces.find(function(p) { return p.id === character.residence.palaceId; });
  if (!pal) return null;
  var sh = null;
  if (character.residence.subHallId && pal.subHalls) {
    sh = pal.subHalls.find(function(s) { return s.id === character.residence.subHallId; });
  }
  return { palace: pal, subHall: sh };
}

/**
 * 按位分自动分配妃嫔居所
 * 规则：高位(皇后/皇贵妃/贵妃)住主殿独居；中位(妃嫔)住偏殿；低位(贵人以下)合住附殿
 */
function autoAssignHaremResidences() {
  if (!P.palaceSystem || !P.palaceSystem.palaces || !P.palaceSystem.palaces.length) return;
  if (!GM.chars) return;
  var palaces = P.palaceSystem.palaces;
  // 获取位分映射（按name查级）
  var ranks = (P.haremConfig && P.haremConfig.rankSystem) || [];
  var rankByName = {};
  ranks.forEach(function(r) { rankByName[r.name] = r; });

  // 筛选所有后妃角色（有 rankLevel 或 haremRank）
  var consorts = GM.chars.filter(function(c) {
    return c.alive !== false && (c.haremRank || c.rankLevel || c.isConsort);
  });
  // 已占用表
  var occupiedSubHalls = {};
  palaces.forEach(function(p) {
    if (!p.subHalls) return;
    p.subHalls.forEach(function(sh) {
      if (sh.occupants && sh.occupants.length) {
        occupiedSubHalls[sh.id] = sh.occupants.slice();
      } else {
        sh.occupants = [];
      }
    });
  });

  // 按位分从高到低排序（level越小越尊）
  consorts.sort(function(a, b) {
    var ra = rankByName[a.haremRank] || rankByName[a.rankLevel];
    var rb = rankByName[b.haremRank] || rankByName[b.rankLevel];
    return ((ra && ra.level) || 99) - ((rb && rb.level) || 99);
  });

  // 逐个分配
  consorts.forEach(function(c) {
    if (c.residence && c.residence.palaceId && c.residence.subHallId) return; // 已有居所
    var rankName = c.haremRank || c.rankLevel;
    var rank = rankByName[rankName];
    // 找符合 rankRestriction 的 subHall
    var candidates = [];
    palaces.forEach(function(p) {
      if (p.type !== 'consort_residence' && p.type !== 'imperial_residence' && p.type !== 'main_hall') return;
      (p.subHalls || []).forEach(function(sh) {
        var occ = sh.occupants || [];
        if (occ.length >= (sh.capacity || 1)) return;
        // 位分限制
        if (sh.rankRestriction && sh.rankRestriction.length > 0) {
          if (sh.rankRestriction.indexOf(rankName) < 0) return;
        }
        // role偏好：高位优先main，低位优先side/attached
        var priority = 0;
        if (rank) {
          if (rank.level <= 2 && sh.role === 'main') priority = 10;
          else if (rank.level >= 3 && rank.level <= 5 && sh.role === 'side') priority = 8;
          else if (rank.level > 5 && (sh.role === 'side' || sh.role === 'attached')) priority = 6;
        }
        candidates.push({ palace: p, subHall: sh, priority: priority });
      });
    });
    candidates.sort(function(a, b) { return b.priority - a.priority; });
    var pick = candidates[0];
    if (pick) {
      c.residence = { palaceId: pick.palace.id, subHallId: pick.subHall.id };
      pick.subHall.occupants = (pick.subHall.occupants || []).concat([c.name]);
    }
  });
}

// ============================================================
// 封建管辖层级系统（中国化）
// ============================================================
// 参考中国古代政治制度：大一统集权为常，分封羁縻为变
// 五级管辖类型，按朝廷对地方的实际控制力由强到弱排列
var AUTONOMY_TYPES = {
  zhixia:   { name: '直辖', label: '京畿直辖', desc: '郡县制，流官三年一迁，税入国库，政令直达' },
  fanguo:   { name: '藩国', label: '分封藩国', desc: '宗室或功臣受封，有实封/虚封之别；诏令须经藩王' },
  fanzhen:  { name: '藩镇', label: '藩镇自治', desc: '军政合一，节度使自任官吏、自征赋税，朝廷册封但难节制' },
  jimi:     { name: '羁縻', label: '羁縻土司', desc: '土司世袭，因俗而治，敕谕形式管辖，可行改土归流' },
  chaogong: { name: '朝贡', label: '朝贡外藩', desc: '属国外藩，仅礼制朝贡，政令不达其内，可遣使册封' }
};

// 权限矩阵：玩家对每种管辖类型的行政区划能行使的权力
// 值 = '直接' | '间接' | '不得' | '须削藩' | '改土归流' | '册封' | '征讨' | '外交' 等中国化动词
var PERMISSION_MATRIX = {
  zhixia: {
    appoint:  { allow: true,  mode: '直接任命流官',  cost: '正常铨选' },
    tax:      { allow: true,  mode: '直接征收',      cost: '由户部规范' },
    edict:    { allow: true,  mode: '诏令直达',      cost: '执行看吏治' },
    reform:   { allow: true,  mode: '可行改革',      cost: '阻力看士绅' }
  },
  fanguo_real: {  // 实封藩国（汉初诸王、明初塞王）
    appoint:  { allow: false, mode: '须削藩',        cost: '叛乱风险极高' },
    tax:      { allow: false, mode: '仅收贡奉',      cost: 'tributeRate比例' },
    edict:    { allow: true,  mode: '诏令须经藩王',  cost: '执行=藩王忠诚×能力' },
    reform:   { allow: false, mode: '不得干涉内政',  cost: '强推引藩乱' }
  },
  fanguo_nominal: {  // 虚封藩国（明中后期、清代宗室爵，食禄不治事）
    appoint:  { allow: true,  mode: '可授属官但受中央节制', cost: '名义上属朝廷' },
    tax:      { allow: true,  mode: '仅食邑N户赋税',  cost: '大头仍归国库' },
    edict:    { allow: true,  mode: '诏令通达',      cost: '藩王听命' },
    reform:   { allow: true,  mode: '可推行',        cost: '碰触食邑引不满' }
  },
  fanzhen: {  // 藩镇（中晚唐河朔三镇）
    appoint:  { allow: false, mode: '节度使自任僚佐',cost: '朝廷事后追认' },
    tax:      { allow: false, mode: '朝廷仅收名义贡',cost: '实赋归节度使' },
    edict:    { allow: true,  mode: '须先请节度使',  cost: '常被阳奉阴违' },
    reform:   { allow: false, mode: '不得置喙',      cost: '强推必反' }
  },
  jimi: {  // 羁縻/土司
    appoint:  { allow: false, mode: '土司世袭承袭',   cost: '仅敕命承认' },
    tax:      { allow: true,  mode: '按土贡定额',    cost: '不计入正赋' },
    edict:    { allow: true,  mode: '敕谕转达',      cost: '土司可拒' },
    reform:   { allow: false, mode: '须改土归流',    cost: '待时机/用兵' }
  },
  chaogong: {  // 朝贡外藩
    appoint:  { allow: false, mode: '不得干预',      cost: '唯有册封其主' },
    tax:      { allow: false, mode: '仅受朝贡贡物',  cost: '无正赋' },
    edict:    { allow: false, mode: '仅为外交辞令',  cost: '实效极低' },
    reform:   { allow: false, mode: '不得干涉',      cost: '出兵征讨方可变革' }
  }
};

/**
 * 派生某行政区划的管辖类型
 * @param {Object} division - 区划对象
 * @param {Object} faction - 所属势力对象
 * @param {string} playerFaction - 玩家势力名
 * @returns {Object} { type, subtype, key, holder, suzerain, ... }
 */
function deriveAutonomy(division, faction, playerFaction) {
  // 如果区划已有显式 autonomy 设置，优先使用
  if (division && division.autonomy && division.autonomy.type) {
    return division.autonomy;
  }
  // 从势力关系推导
  var result = { type: 'zhixia', subtype: null, holder: null, suzerain: null, loyalty: 100, tributeRate: 0 };
  if (!faction) return result;

  // 玩家自己的势力——直辖
  if (faction.name === playerFaction) {
    result.type = 'zhixia';
    return result;
  }
  // 没有liege——独立势力，从玩家视角看就是"外国"（不纳入玩家管辖）
  if (!faction.liege) {
    result.type = null; // 非玩家管辖
    return result;
  }
  // 玩家是宗主
  if (faction.liege === playerFaction) {
    // 根据 relationType 决定
    var rt = faction.relationType || 'vassal';  // 默认封臣
    if (rt === 'tributary' || rt === 'chaogong') {
      result.type = 'chaogong';
    } else if (rt === 'jimi' || rt === 'tusi') {
      result.type = 'jimi';
    } else if (rt === 'fanzhen') {
      result.type = 'fanzhen';
    } else {
      // vassal（封臣）——判断实封/虚封
      result.type = 'fanguo';
      result.subtype = faction.fiefSubtype || 'nominal'; // 默认虚封
    }
    result.holder = faction.name;
    result.suzerain = playerFaction;
    result.loyalty = faction.loyaltyToLiege !== undefined ? faction.loyaltyToLiege : 60;
    result.tributeRate = faction.tributeRate || 0.3;
    return result;
  }
  // 其他势力的附庸——玩家无权管辖
  result.type = null;
  return result;
}

/**
 * 获取某种管辖类型的权限矩阵条目
 */
function getAutonomyPermission(autonomy) {
  if (!autonomy || !autonomy.type) return null;
  var key = autonomy.type;
  if (key === 'fanguo') {
    key = 'fanguo_' + (autonomy.subtype === 'real' ? 'real' : 'nominal');
  }
  return PERMISSION_MATRIX[key] || null;
}

/**
 * 批量派生所有行政区划的管辖类型——在世界加载/势力变更后调用
 */
function applyAutonomyToAllDivisions() {
  if (!P.adminHierarchy) return;
  var playerFaction = (P.playerInfo && P.playerInfo.factionName) || '';
  Object.keys(P.adminHierarchy).forEach(function(fk) {
    var fh = P.adminHierarchy[fk];
    if (!fh || !fh.divisions) return;
    var faction = (GM.facs || []).find(function(f) { return f.name === fh.name || f.name === fk; });
    (function _walkDivs(divs, parentAutonomy) {
      divs.forEach(function(d) {
        // 若已有爵位持有者，保留当前 autonomy；否则从势力派生
        if (!d.autonomy || !d.autonomy.type) {
          d.autonomy = deriveAutonomy(d, faction, playerFaction);
        }
        if (d.divisions && d.divisions.length > 0) _walkDivs(d.divisions, d.autonomy);
      });
    })(fh.divisions, null);
  });
}

// ============================================================
// 封臣系统 - 借鉴 KingOfIreland Court 层级
// ============================================================

// 建立封臣关系
function establishVassalage(vassalName, liegeName, relationType) {
  var vassal = GM._indices.facByName ? GM._indices.facByName.get(vassalName) : null;
  var liege = GM._indices.facByName ? GM._indices.facByName.get(liegeName) : null;

  if (!vassal || !liege) {
    toast('势力不存在');
    return false;
  }

  // 检查是否已经是封臣
  if (vassal.liege === liegeName) {
    toast(vassalName + ' 已经是 ' + liegeName + ' 的封臣');
    return false;
  }

  // 如果已有宗主，先解除旧关系
  if (vassal.liege) {
    var oldLiege = GM._indices.facByName ? GM._indices.facByName.get(vassal.liege) : null;
    if (oldLiege && oldLiege.vassals) {
      oldLiege.vassals = oldLiege.vassals.filter(function(v) { return v !== vassalName; });
    }
  }

  // 建立新关系
  vassal.liege = liegeName;
  // 管辖关系类型：vassal(封臣)/tributary(朝贡)/jimi(羁縻)/fanzhen(藩镇)
  vassal.relationType = relationType || 'vassal';
  if (!liege.vassals) liege.vassals = [];
  if (liege.vassals.indexOf(vassalName) === -1) {
    liege.vassals.push(vassalName);
  }

  // 根据时代状态调整贡奉比例
  if (GM.eraState) {
    var centralization = GM.eraState.centralControl || 0.5;
    // 集权度越高，贡奉比例越高
    vassal.tributeRate = 0.2 + (centralization * 0.4); // 20%-60%
  }
  // 朝贡关系贡奉较低（外藩象征性）
  if (vassal.relationType === 'tributary') vassal.tributeRate = Math.min(vassal.tributeRate, 0.15);
  // 羁縻贡奉极低
  if (vassal.relationType === 'jimi') vassal.tributeRate = Math.min(vassal.tributeRate, 0.1);

  // 联动更新该势力所有区划的管辖类型
  if (typeof applyAutonomyToAllDivisions === 'function') applyAutonomyToAllDivisions();

  var _relLabel = { vassal:'封臣', tributary:'朝贡外藩', jimi:'羁縻土司', fanzhen:'藩镇' }[vassal.relationType] || '封臣';
  toast(vassalName + ' 成为 ' + liegeName + ' 的' + _relLabel);
  return true;
}

// 解除封臣关系
function breakVassalage(vassalName) {
  var vassal = GM._indices.facByName ? GM._indices.facByName.get(vassalName) : null;
  if (!vassal || !vassal.liege) {
    toast('该势力没有宗主');
    return false;
  }

  var liegeName = vassal.liege;
  var liege = GM._indices.facByName ? GM._indices.facByName.get(liegeName) : null;

  // 解除关系
  vassal.liege = null;
  vassal.relationType = null;
  if (liege && liege.vassals) {
    liege.vassals = liege.vassals.filter(function(v) { return v !== vassalName; });
  }
  // 联动刷新管辖
  if (typeof applyAutonomyToAllDivisions === 'function') applyAutonomyToAllDivisions();

  toast(vassalName + ' 脱离 ' + liegeName + ' 的控制');
  return true;
}

// 递归计算势力总收入（包含封臣贡奉）
function calculateTotalIncome(factionName, _visited) {
  var faction = GM._indices.facByName ? GM._indices.facByName.get(factionName) : null;
  if (!faction) return 0;

  // 环检测：防止循环封臣关系导致无限递归
  if (!_visited) _visited = {};
  if (_visited[factionName]) return 0;
  _visited[factionName] = true;

  var totalIncome = 0;

  // 1. 直辖收入（领地建筑收入）
  if (P.buildingSystem && P.buildingSystem.enabled) {
    var buildingEffects = applyBuildingEffectsToFaction(faction);
    totalIncome += buildingEffects.income || 0;
  }

  // 2. 基础收入
  var baseIncome = P.economyConfig ? P.economyConfig.baseIncome : 100;
  if (faction.territories && faction.territories.length > 0) {
    totalIncome += baseIncome * faction.territories.length;
  } else {
    totalIncome += baseIncome;
  }

  // 3. 封臣贡奉（仅计算，不扣除——扣除在 updateVassalSystem 中处理）
  if (faction.vassals && faction.vassals.length > 0) {
    faction.vassals.forEach(function(vassalName) {
      var vassal = GM._indices.facByName ? GM._indices.facByName.get(vassalName) : null;
      if (vassal) {
        var vassalIncome = calculateTotalIncome(vassalName, _visited);
        var tribute = vassalIncome * (vassal.tributeRate || 0.3);
        totalIncome += tribute;
      }
    });
  }

  return totalIncome;
}

// 征召封臣军队
function levyVassalArmies(liegeName) {
  var liege = GM._indices.facByName ? GM._indices.facByName.get(liegeName) : null;
  if (!liege || !liege.vassals || liege.vassals.length === 0) {
    toast('没有可征召的封臣');
    return [];
  }

  var leviedArmies = [];

  liege.vassals.forEach(function(vassalName) {
    var vassal = GM._indices.facByName ? GM._indices.facByName.get(vassalName) : null;
    if (!vassal) return;

    // 根据忠诚度决定征召比例
    var vassalRuler = GM.chars.find(function(c) {
      return c.faction === vassalName && (c.position === '君主' || c.position === '首领');
    });

    var loyalty = vassalRuler ? (vassalRuler.loyalty || 50) : 50;
    var levyRate = 0;

    // 特权检查：levy_all → 无视忠诚度，征召100%
    if (typeof hasPrivilege === 'function' && hasPrivilege(liegeName, 'levy_all')) {
      levyRate = 1.0;
    } else if (loyalty >= 80) {
      levyRate = 0.8;
    } else if (loyalty >= 60) {
      levyRate = 0.6;
    } else if (loyalty >= 40) {
      levyRate = 0.4;
    } else {
      levyRate = 0.2;
    }

    // 查找封臣的军队
    var vassalArmies = GM.armies.filter(function(a) {
      return a.faction === vassalName;
    });

    vassalArmies.forEach(function(army) {
      var leviedSoldiers = Math.floor(army.soldiers * levyRate);
      if (leviedSoldiers > 0) {
        leviedArmies.push({
          name: vassalName + '征召军',
          faction: liegeName,
          soldiers: leviedSoldiers,
          morale: army.morale * 0.8, // 征召军士气降低
          location: army.location,
          source: vassalName
        });

        // 从封臣军队中扣除
        army.soldiers -= leviedSoldiers;
      }
    });
  });

  // 将征召的军队添加到宗主军队中
  leviedArmies.forEach(function(army) {
    GM.armies.push(army);
  });

  toast('征召了 ' + leviedArmies.length + ' 支封臣军队');
  return leviedArmies;
}

// 更新封臣系统（每回合调用）
function updateVassalSystem() {
  if (!GM.facs) return;

  var centralization = (GM.eraState && GM.eraState.centralControl) || 0.5;
  var dynastyPhase = (GM.eraState && GM.eraState.dynastyPhase) || 'peak';

  // 1. 封臣忠诚度动态调整 + 危机检测
  GM.facs.forEach(function(faction) {
    if (!faction.liege) return;

    var ruler = GM.chars ? GM.chars.find(function(c) {
      return c.faction === faction.name && c.alive !== false && (c.position === '\u541B\u4E3B' || c.position === '\u9996\u9886');
    }) : null;

    if (ruler) {
      var _ms = (typeof _getDaysPerTurn === 'function' ? _getDaysPerTurn() : 30) / 30;
      // 集权度影响封臣忠诚度自然漂移
      if (centralization > 0.7) {
        ruler.loyalty = Math.min(100, (ruler.loyalty || 50) + 1 * _ms);
      } else if (centralization < 0.3) {
        ruler.loyalty = Math.max(0, (ruler.loyalty || 50) - 1 * _ms);
      }

      // 王朝衰落期额外降低忠诚
      if (dynastyPhase === 'decline' || dynastyPhase === 'collapse') {
        ruler.loyalty = Math.max(0, (ruler.loyalty || 50) - 1 * _ms);
      }

      // 获取叛乱阈值（从封臣类型定义中取，或默认25）
      var rebellionThreshold = 25;
      if (P.vassalSystem && P.vassalSystem.vassalTypes && faction.vassalType) {
        var vtDef = P.vassalSystem.vassalTypes.find(function(v) { return v.name === faction.vassalType; });
        if (vtDef && vtDef.rebellionThreshold) rebellionThreshold = vtDef.rebellionThreshold;
      }

      // 低忠诚度→封臣危机 / 叛乱执行
      var _rebCfg = (P.vassalSystem && P.vassalSystem.rebellionConfig) || {};
      var _rebCheckInterval = _rebCfg.checkIntervalMonths || 3;
      var _rebCheckTurns = (typeof turnsForMonths === 'function') ? turnsForMonths(_rebCheckInterval) : 3;
      var _shouldCheckReb = (_rebCheckTurns <= 1) || (GM.turn % _rebCheckTurns === 0);

      if (ruler.loyalty < rebellionThreshold && _shouldCheckReb) {
        // 叛乱概率检定
        var _rebBaseChance = _rebCfg.baseChancePerYear || 0.6;
        var _rebTR = (typeof getTimeRatio === 'function') ? getTimeRatio() : (1/12);
        var _rebChance = _rebBaseChance * _rebTR * (_rebCheckInterval / 12);
        // 性格加成：胆大更易叛乱
        if (ruler.ambition) _rebChance += (ruler.ambition / 100) * (_rebCfg.boldnessWeight || 0.15);
        // 忠诚越低越易叛
        _rebChance += (rebellionThreshold - ruler.loyalty) * 0.01;
        _rebChance = Math.min(0.95, Math.max(0.05, _rebChance));

        if ((typeof random === 'function' ? random() : Math.random()) < _rebChance) {
          // ═══ 叛乱发生！═══
          addEB('叛乱', '⚠ ' + faction.name + '首领' + ruler.name + '忠诚仅' + ruler.loyalty + '，愤而举旗叛乱！');

          // 断开封臣关系
          if (_rebCfg.autoBreakVassalage !== false && typeof breakVassalage === 'function') {
            breakVassalage(faction.name);
          }

          // 创建战争记录
          var _liegeFac = (GM.facs || []).find(function(f) { return f.name === faction.liege; });
          if (_liegeFac) {
            if (!GM.activeWars) GM.activeWars = [];
            GM.activeWars.push({
              id: uid(),
              attacker: faction.name,
              defender: _liegeFac.name,
              casusBelli: 'rebellion',
              startTurn: GM.turn,
              warScore: 0
            });
          }

          // 叛军士气加成
          var _rebMoraleBonus = _rebCfg.rebelMoraleBonus || 10;
          (GM.armies || []).forEach(function(a) {
            if (a.faction === faction.name) {
              a.morale = Math.min(100, (a.morale || 50) + _rebMoraleBonus);
            }
          });

          // 记入本回合结果（供AI prompt注入）
          if (!GM._turnRebellionResults) GM._turnRebellionResults = [];
          GM._turnRebellionResults.push({
            rebel: faction.name,
            rebelLeader: ruler.name,
            liege: faction.liege || '中央',
            loyalty: ruler.loyalty,
            turn: GM.turn
          });
        } else {
          addEB('封臣危机', faction.name + '首领' + ruler.name + '忠诚度仅' + ruler.loyalty + '，有叛乱倾向（本回合未发生）');
        }
      } else if (ruler.loyalty < rebellionThreshold + 10 && (centralization < 0.4 || dynastyPhase === 'decline')) {
        addEB('封臣动态', faction.name + '封臣' + ruler.name + '忠诚度' + ruler.loyalty + '，局势不稳');
      }
    }

    // 贡奉比例受集权度影响动态调整
    // 特权检查：tax_exempt → 免除朝贡
    var _vassalRulerName = ruler ? ruler.name : '';
    if (_vassalRulerName && typeof hasPrivilege === 'function' && hasPrivilege(_vassalRulerName, 'tax_exempt')) {
      faction._effectiveTributeRate = 0;
      // 跳过后续贡奉计算（直接设为0已赋值）
    }
    var baseTribute = faction.tributeRate || 0.3;
    var adjustedTribute = baseTribute;
    if (centralization > 0.7) {
      adjustedTribute = Math.min(0.8, baseTribute * 1.1); // 高集权→贡奉略增
    } else if (centralization < 0.3 && ruler && ruler.loyalty < 50) {
      adjustedTribute = Math.max(0.05, baseTribute * 0.7); // 低集权+低忠诚→贡奉减少
    }
    faction._effectiveTributeRate = adjustedTribute;
  });

  // 2. 计算并应用封臣贡奉
  GM.facs.forEach(function(faction) {
    if (!faction.vassals || faction.vassals.length === 0) return;

    var totalTribute = 0;
    faction.vassals.forEach(function(vassalName) {
      var vassal = GM._indices.facByName ? GM._indices.facByName.get(vassalName) : null;
      if (!vassal) return;

      var vassalIncome = calculateTotalIncome(vassalName);
      var effectiveRate = vassal._effectiveTributeRate || vassal.tributeRate || 0.3;
      var tribute = Math.round(vassalIncome * effectiveRate);
      totalTribute += tribute;

      // 从封臣收入中扣除贡奉（确保不为NaN）
      if (typeof vassal.money === 'number') {
        vassal.money -= tribute;
      }
    });

    // 宗主获得贡奉
    if (typeof faction.money === 'number') {
      faction.money += totalTribute;
    }
  });

  // 3. 清理无效封臣引用（封臣势力被灭后自动解除）
  GM.facs.forEach(function(faction) {
    if (faction.vassals && faction.vassals.length > 0) {
      faction.vassals = faction.vassals.filter(function(vn) {
        var vf = GM._indices.facByName ? GM._indices.facByName.get(vn) : null;
        if (!vf || (vf.strength !== undefined && vf.strength <= 0)) {
          return false; // 势力不存在或已覆灭
        }
        return true;
      });
    }
    if (faction.liege) {
      var lf = GM._indices.facByName ? GM._indices.facByName.get(faction.liege) : null;
      if (!lf || (lf.strength !== undefined && lf.strength <= 0)) {
        faction.liege = null; // 宗主不存在或已覆灭，自动脱离
      }
    }
  });
}

// 获取势力的所有封臣（递归）
function getAllVassals(factionName, _visited) {
  if (!_visited) _visited = {};
  if (_visited[factionName]) return []; // 环检测
  _visited[factionName] = true;

  var faction = GM._indices.facByName ? GM._indices.facByName.get(factionName) : null;
  if (!faction || !faction.vassals || faction.vassals.length === 0) {
    return [];
  }

  var allVassals = [];
  faction.vassals.forEach(function(vassalName) {
    allVassals.push(vassalName);
    var subVassals = getAllVassals(vassalName, _visited);
    allVassals = allVassals.concat(subVassals);
  });

  return allVassals;
}

// 获取势力的封建层级（带环检测）
function getFeudalLevel(factionName) {
  var faction = GM._indices.facByName ? GM._indices.facByName.get(factionName) : null;
  if (!faction) return 0;

  var level = 0;
  var current = faction;
  var seen = {};

  while (current.liege) {
    if (seen[current.liege]) break; // 环检测
    seen[current.liege] = true;
    level++;
    current = GM._indices.facByName ? GM._indices.facByName.get(current.liege) : null;
    if (!current) break;
  }

  return level;
}

// ============================================================
// 头衔系统 - 借鉴 KingOfIreland Title 系统
// ============================================================

// 爵位等级（优先从剧本配置P.titleSystem.titleRanks读取，此为通用默认值）
var _DEFAULT_TITLE_LEVELS = {
  emperor: { name: '皇帝', level: 0, privileges: ['supreme_authority', 'appoint_all', 'levy_all'] },
  king: { name: '王', level: 1, privileges: ['regional_authority', 'appoint_officials', 'levy_vassals'] },
  duke: { name: '公', level: 2, privileges: ['local_authority', 'appoint_subordinates', 'levy_limited'] },
  marquis: { name: '侯', level: 3, privileges: ['limited_authority', 'appoint_assistants'] },
  earl: { name: '伯', level: 4, privileges: ['basic_authority'] },
  viscount: { name: '子', level: 5, privileges: [] },
  baron: { name: '男', level: 6, privileges: [] }
};
/** 获取当前剧本的爵位等级定义（统一返回对象格式） */
function getTitleLevels() {
  if (P.titleSystem && P.titleSystem.titleRanks) {
    var ranks = P.titleSystem.titleRanks;
    // 如果是数组（编辑器格式），转为对象
    if (Array.isArray(ranks) && ranks.length > 0) {
      var obj = {};
      ranks.forEach(function(r) {
        var key = (r.name || '').replace(/\s/g, '_').toLowerCase() || ('rank_' + (r.level || 0));
        obj[key] = {
          name: r.name || key, level: r.level || 0,
          privileges: Array.isArray(r.privileges) ? r.privileges : (r.privileges ? [r.privileges] : []),
          salary: r.salary || 0, landGrant: !!r.landGrant,
          maxHolders: r.maxHolders || 0, degradeRule: r.degradeRule || '',
          succession: r.succession || '', category: r.category || '',
          associatedPosts: r.associatedPosts || []
        };
      });
      return obj;
    }
    // 如果已经是对象格式
    if (typeof ranks === 'object' && !Array.isArray(ranks) && Object.keys(ranks).length > 0) {
      return ranks;
    }
  }
  return _DEFAULT_TITLE_LEVELS;
}
var TITLE_LEVELS = _DEFAULT_TITLE_LEVELS; // 兼容直接引用

// 官职品级（优先从剧本配置读取，此为九品制通用默认值）
var _DEFAULT_OFFICIAL_RANKS = {
  rank1: { name: '一品', level: 1, salary: 1000 },
  rank2: { name: '二品', level: 2, salary: 800 },
  rank3: { name: '三品', level: 3, salary: 600 },
  rank4: { name: '四品', level: 4, salary: 400 },
  rank5: { name: '五品', level: 5, salary: 300 },
  rank6: { name: '六品', level: 6, salary: 200 },
  rank7: { name: '七品', level: 7, salary: 150 },
  rank8: { name: '八品', level: 8, salary: 100 },
  rank9: { name: '九品', level: 9, salary: 80 }
};
/** 获取当前剧本的官职品级定义 */
function getOfficialRanks() {
  return (P.officialRanks && Object.keys(P.officialRanks).length > 0)
    ? P.officialRanks : _DEFAULT_OFFICIAL_RANKS;
}
var OFFICIAL_RANKS = _DEFAULT_OFFICIAL_RANKS; // 兼容直接引用

// ============================================================
// 爵位分类（中国古代制度）与封地绑定
// ============================================================
// 爵位类别——决定该爵位是否可持封地、封地类型如何
var TITLE_CLASSES = {
  // 宗室王爵（亲王/郡王）——多为虚封（明代塞王除外有兵权）
  royal_prince: {
    name: '宗室王爵', examples: ['亲王','郡王','嗣王'],
    canHoldFief: true,       // 可持封地
    fiefSubtype: 'nominal',  // 默认虚封（明清制）；特殊时代可实封
    allowRealFief: true,     // 允许改为实封（如明初塞王）
    hereditaryDefault: true,
    autonomyTypeDerived: 'fanguo'
  },
  // 勋贵爵（国公/郡公/县公）——功臣，多虚封食邑
  meritorious_duke: {
    name: '勋贵公爵', examples: ['国公','郡公','县公'],
    canHoldFief: true,
    fiefSubtype: 'nominal',
    allowRealFief: false,
    hereditaryDefault: false, // 流爵为主
    autonomyTypeDerived: 'fanguo'
  },
  // 列侯（彻侯/关内侯/开国县侯）——汉唐制，食邑N户
  marquess: {
    name: '列侯', examples: ['彻侯','关内侯','开国县侯','开国县伯'],
    canHoldFief: true,
    fiefSubtype: 'nominal',
    allowRealFief: false,
    hereditaryDefault: false,
    autonomyTypeDerived: 'fanguo'
  },
  // 周五等爵（公侯伯子男）——古制，周分封
  five_ranks: {
    name: '五等爵', examples: ['公','侯','伯','子','男'],
    canHoldFief: true,
    fiefSubtype: 'real',     // 古制实封
    allowRealFief: true,
    hereditaryDefault: true,
    autonomyTypeDerived: 'fanguo'
  },
  // 土司爵（宣慰司/宣抚司/安抚司/长官司）——边疆羁縻
  tusi: {
    name: '土司爵', examples: ['宣慰使','宣抚使','安抚使','长官司'],
    canHoldFief: true,
    fiefSubtype: null,       // 不适用
    hereditaryDefault: true,  // 世袭
    autonomyTypeDerived: 'jimi'
  },
  // 外藩王（属国国王/部族可汗）——朝贡
  foreign_king: {
    name: '外藩王', examples: ['国王','可汗','单于'],
    canHoldFief: true,
    fiefSubtype: null,
    hereditaryDefault: true,
    autonomyTypeDerived: 'chaogong'
  },
  // 节度使（藩镇主）——军政合一
  military_governor: {
    name: '节度使', examples: ['节度使','经略使','观察使'],
    canHoldFief: true,
    fiefSubtype: null,
    hereditaryDefault: false, // 原不世袭，安史后实际自成体系
    autonomyTypeDerived: 'fanzhen'
  },
  // 无爵位（荣誉/散官）
  honorary: {
    name: '散爵', examples: ['散骑常侍','荣禄大夫','光禄大夫'],
    canHoldFief: false,
    hereditaryDefault: false,
    autonomyTypeDerived: null
  }
};

/**
 * 按爵位名推断其类别
 */
function inferTitleClass(titleName) {
  if (!titleName) return 'honorary';
  var keys = Object.keys(TITLE_CLASSES);
  for (var i = 0; i < keys.length; i++) {
    var cls = TITLE_CLASSES[keys[i]];
    if (cls.examples && cls.examples.some(function(ex) { return titleName.indexOf(ex) >= 0; })) {
      return keys[i];
    }
  }
  return 'honorary';
}

/**
 * 授予封地——将某区划标记为某角色的封地
 * @param {string} characterName - 持爵者
 * @param {string} divisionName - 封地名
 * @param {string} titleType - 关联爵位key
 * @param {string} subtype - 'real' | 'nominal'（实封/虚封）
 */
function grantFief(characterName, divisionName, titleType, subtype) {
  if (!P.adminHierarchy) return false;
  var _found = null, _fh = null;
  Object.keys(P.adminHierarchy).forEach(function(fk) {
    var fh = P.adminHierarchy[fk];
    if (!fh || !fh.divisions) return;
    (function _walk(ds) {
      ds.forEach(function(d) {
        if (d.name === divisionName) { _found = d; _fh = fh; }
        if (d.divisions) _walk(d.divisions);
      });
    })(fh.divisions);
  });
  if (!_found) { toast('未找到区划 ' + divisionName); return false; }
  // 设置 autonomy
  _found.autonomy = {
    type: 'fanguo',
    subtype: subtype || 'nominal',
    holder: characterName,
    suzerain: (P.playerInfo && P.playerInfo.factionName) || '',
    titleType: titleType || null,
    loyalty: 80,
    tributeRate: subtype === 'real' ? 0.5 : 0.15,
    grantedTurn: GM.turn
  };
  addEB('册封', characterName + ' 受封 ' + divisionName + (subtype === 'real' ? '（实封）' : '（虚封/食邑）'));
  toast(characterName + ' 受封 ' + divisionName);
  return true;
}

/**
 * 收回封地——回归直辖
 */
function revokeFief(divisionName) {
  if (!P.adminHierarchy) return false;
  var _found = null;
  Object.keys(P.adminHierarchy).forEach(function(fk) {
    var fh = P.adminHierarchy[fk];
    if (!fh || !fh.divisions) return;
    (function _walk(ds) {
      ds.forEach(function(d) {
        if (d.name === divisionName) _found = d;
        if (d.divisions) _walk(d.divisions);
      });
    })(fh.divisions);
  });
  if (!_found) return false;
  var oldHolder = _found.autonomy && _found.autonomy.holder || '';
  _found.autonomy = { type: 'zhixia', subtype: null, holder: null, suzerain: null, loyalty: 100, tributeRate: 0 };
  if (oldHolder) addEB('回收', oldHolder + ' 之封地 ' + divisionName + ' 回归朝廷直辖');
  return true;
}

// 为角色授予头衔（支持key查找或直接传名称）
function grantTitle(characterName, titleType, titleLevel, hereditary) {
  var character = GM._indices.charByName ? GM._indices.charByName.get(characterName) : null;
  if (!character) {
    toast('角色不存在');
    return false;
  }

  // 从当前爵位定义中查找（兼容key和name两种方式）
  var currentLevels = getTitleLevels();
  var titleInfo = currentLevels[titleType];
  if (!titleInfo) {
    // 按 name 字段查找
    var keys = Object.keys(currentLevels);
    for (var k = 0; k < keys.length; k++) {
      if (currentLevels[keys[k]].name === titleType) {
        titleInfo = currentLevels[keys[k]];
        titleType = keys[k];
        break;
      }
    }
  }
  if (!titleInfo) {
    // 允许自定义头衔名（AI可能传中文名）
    titleInfo = { name: titleType, level: titleLevel || 5, privileges: [] };
  }

  // 初始化头衔字段
  if (!character.titles) character.titles = [];

  // 检查是否已有该头衔
  var existingTitle = character.titles.find(function(t) {
    return t.type === titleType || t.name === titleInfo.name;
  });

  if (existingTitle) {
    toast(characterName + ' 已拥有 ' + titleInfo.name + ' 头衔');
    return false;
  }

  // 推断中国爵位类别（宗室王爵/勋贵公爵/列侯/五等爵/土司/外藩王/节度使/散爵）
  var titleClass = inferTitleClass(titleInfo.name);
  var classDef = TITLE_CLASSES[titleClass] || {};

  // 创建头衔
  var title = {
    type: titleType,
    name: titleInfo.name,
    level: titleInfo.level,
    titleClass: titleClass,                            // 中国爵位类别
    privileges: titleInfo.privileges || [],
    _suppressed: [], // 被集权压制的特权（可恢复）
    hereditary: hereditary !== undefined ? hereditary : (classDef.hereditaryDefault || false),
    canHoldFief: classDef.canHoldFief || false,
    fiefSubtype: classDef.fiefSubtype || null,
    grantedTurn: GM.turn,
    grantedBy: '朝廷'
  };

  character.titles.push(title);

  addEB('册封', characterName + ' 被册封为 ' + titleInfo.name + '(' + (classDef.name || '爵') + ')');
  toast(characterName + ' 被册封为 ' + titleInfo.name);
  return true;
}

// 剥夺头衔
function revokeTitle(characterName, titleType) {
  var character = GM._indices.charByName ? GM._indices.charByName.get(characterName) : null;
  if (!character || !character.titles) {
    toast('角色没有头衔');
    return false;
  }

  var titleIndex = character.titles.findIndex(function(t) {
    return t.type === titleType;
  });

  if (titleIndex === -1) {
    toast('角色没有该头衔');
    return false;
  }

  var title = character.titles[titleIndex];
  character.titles.splice(titleIndex, 1);

  // 联动：回收该爵位下属的封地为直辖
  if (P.adminHierarchy) {
    Object.keys(P.adminHierarchy).forEach(function(fk) {
      var fh = P.adminHierarchy[fk];
      if (!fh || !fh.divisions) return;
      (function _walk(ds) {
        ds.forEach(function(d) {
          if (d.autonomy && d.autonomy.holder === characterName &&
              (!title.type || d.autonomy.titleType === title.type || !d.autonomy.titleType)) {
            if (typeof revokeFief === 'function') revokeFief(d.name);
          }
          if (d.divisions) _walk(d.divisions);
        });
      })(fh.divisions);
    });
  }

  // 记录事件
  addEB('降爵', characterName + ' 的 ' + title.name + ' 头衔被剥夺');

  toast(characterName + ' 的 ' + title.name + ' 头衔被剥夺');
  return true;
}

// 头衔继承
function inheritTitle(deceasedName, heirName, titleType) {
  var deceased = GM._indices.charByName ? GM._indices.charByName.get(deceasedName) : null;
  var heir = GM._indices.charByName ? GM._indices.charByName.get(heirName) : null;

  if (!deceased || !heir) {
    toast('角色不存在');
    return false;
  }

  if (!deceased.titles || deceased.titles.length === 0) {
    return false; // 没有头衔可继承
  }

  // 查找指定头衔
  var title = deceased.titles.find(function(t) {
    return t.type === titleType;
  });

  if (!title) {
    return false;
  }

  // 检查是否可继承
  if (!title.hereditary) {
    // 非世袭头衔，根据时代状态决定是否继承
    if (GM.eraState) {
      var centralization = GM.eraState.centralControl || 0.5;
      // 集权度低时，更容易世袭
      if (centralization > 0.6) {
        toast(title.name + ' 为流官，不可世袭');
        return false;
      }
    }
  }

  // 继承头衔
  if (!heir.titles) heir.titles = [];

  var inheritedTitle = {
    type: title.type,
    name: title.name,
    level: title.level,
    privileges: title.privileges || [],
    hereditary: title.hereditary,
    grantedTurn: GM.turn,
    grantedBy: deceasedName + '（继承）'
  };

  heir.titles.push(inheritedTitle);

  // 联动：将逝者名下的封地过继给继承人
  if (P.adminHierarchy) {
    Object.keys(P.adminHierarchy).forEach(function(fk) {
      var fh = P.adminHierarchy[fk];
      if (!fh || !fh.divisions) return;
      (function _walk(ds) {
        ds.forEach(function(d) {
          if (d.autonomy && d.autonomy.holder === deceasedName) {
            d.autonomy.holder = heirName;
            d.autonomy.grantedTurn = GM.turn;
            // 继承初期忠诚度偏低（新君/旧臣关系）
            d.autonomy.loyalty = Math.max(50, (d.autonomy.loyalty || 70) - 15);
          }
          if (d.divisions) _walk(d.divisions);
        });
      })(fh.divisions);
    });
  }

  // 记录事件
  addEB('继承', heirName + ' 继承了 ' + deceasedName + ' 的 ' + title.name + ' 头衔');

  toast(heirName + ' 继承了 ' + title.name + ' 头衔');
  return true;
}

// 晋升头衔
function promoteTitle(characterName, newTitleType) {
  var character = GM._indices.charByName ? GM._indices.charByName.get(characterName) : null;
  if (!character) {
    toast('角色不存在');
    return false;
  }

  var currentLevels = getTitleLevels();
  var newTitleInfo = currentLevels[newTitleType];
  if (!newTitleInfo) {
    // 按name查找
    var keys = Object.keys(currentLevels);
    for (var k = 0; k < keys.length; k++) {
      if (currentLevels[keys[k]].name === newTitleType) {
        newTitleInfo = currentLevels[keys[k]];
        newTitleType = keys[k];
        break;
      }
    }
  }
  if (!newTitleInfo) {
    toast('头衔类型无效');
    return false;
  }

  // 查找当前最高头衔
  var currentTitle = null;
  var currentTitleIndex = -1;

  if (character.titles && character.titles.length > 0) {
    character.titles.forEach(function(t, index) {
      if (!currentTitle || t.level < currentTitle.level) {
        currentTitle = t;
        currentTitleIndex = index;
      }
    });
  }

  // 检查是否可以晋升
  if (currentTitle && currentTitle.level <= newTitleInfo.level) {
    toast('新头衔等级不高于当前头衔');
    return false;
  }

  // 移除旧头衔
  if (currentTitleIndex !== -1) {
    character.titles.splice(currentTitleIndex, 1);
  }

  // 授予新头衔
  var newTitle = {
    type: newTitleType,
    name: newTitleInfo.name,
    level: newTitleInfo.level,
    privileges: newTitleInfo.privileges || [],
    hereditary: currentTitle ? currentTitle.hereditary : false,
    grantedTurn: GM.turn,
    grantedBy: '朝廷'
  };

  if (!character.titles) character.titles = [];
  character.titles.push(newTitle);

  // 记录事件
  addEB('晋爵', characterName + ' 晋升为 ' + newTitleInfo.name);

  toast(characterName + ' 晋升为 ' + newTitleInfo.name);
  return true;
}

// 检查角色是否拥有特权
function hasPrivilege(characterName, privilege) {
  var character = GM._indices.charByName ? GM._indices.charByName.get(characterName) : null;
  if (!character || !character.titles) {
    return false;
  }

  for (var i = 0; i < character.titles.length; i++) {
    var title = character.titles[i];
    if (title.privileges && title.privileges.indexOf(privilege) !== -1) {
      return true;
    }
  }

  return false;
}

// 获取角色的最高头衔
function getHighestTitle(characterName) {
  var character = GM._indices.charByName ? GM._indices.charByName.get(characterName) : null;
  if (!character || !character.titles || character.titles.length === 0) {
    return null;
  }

  var highestTitle = character.titles[0];
  character.titles.forEach(function(t) {
    if (t.level < highestTitle.level) {
      highestTitle = t;
    }
  });

  return highestTitle;
}

// 为官职添加品级
function assignOfficialRank(characterName, position, rank) {
  var character = GM._indices.charByName ? GM._indices.charByName.get(characterName) : null;
  if (!character) {
    toast('角色不存在');
    return false;
  }

  var rankInfo = OFFICIAL_RANKS[rank];
  if (!rankInfo) {
    toast('品级无效');
    return false;
  }

  // 更新角色的官职信息
  character.position = position;
  character.officialRank = rank;
  character.officialRankName = rankInfo.name;
  character.salary = rankInfo.salary;

  toast(characterName + ' 被任命为 ' + position + '（' + rankInfo.name + '）');
  return true;
}

// 更新头衔系统（每回合调用）
function updateTitleSystem() {
  // 1. 根据时代状态动态调整头衔特权（suppressed标记，可恢复）
  if (GM.eraState) {
    var centralization = GM.eraState.centralControl || 0.5;
    var _suppressTargets = ['appoint_subordinates', 'appoint_assistants', 'levy_limited'];

    GM.chars.forEach(function(character) {
      if (!character.titles || character.titles.length === 0 || character.alive === false) return;
      character.titles.forEach(function(title) {
        if (!title.privileges) title.privileges = [];
        if (!title._suppressed) title._suppressed = [];

        if (centralization > 0.7) {
          // 高集权：压制地方特权（移入_suppressed，不永久删除）
          _suppressTargets.forEach(function(p) {
            var idx = title.privileges.indexOf(p);
            if (idx !== -1) {
              title.privileges.splice(idx, 1);
              if (title._suppressed.indexOf(p) === -1) title._suppressed.push(p);
            }
          });
        } else if (centralization < 0.4) {
          // 低集权：恢复被压制的特权
          if (title._suppressed.length > 0) {
            title._suppressed.forEach(function(p) {
              if (title.privileges.indexOf(p) === -1) title.privileges.push(p);
            });
            title._suppressed = [];
          }
        }
      });
    });
  }

  // 2. 检查头衔限额（maxHolders）
  var currentLevels = getTitleLevels();
  var titleKeys = Object.keys(currentLevels);
  titleKeys.forEach(function(key) {
    var def = currentLevels[key];
    if (def.maxHolders && def.maxHolders > 0) {
      var holders = GM.chars.filter(function(c) {
        return c.alive !== false && c.titles && c.titles.some(function(t) { return t.name === def.name || t.type === key; });
      });
      if (holders.length > def.maxHolders) {
        addEB('\u7235\u4F4D', def.name + '\u6301\u6709\u8005' + holders.length + '\u4EBA\u8D85\u51FA\u9650\u989D' + def.maxHolders);
      }
    }
  });
}

// 更新补给系统
function updateSupplySystem() {
  if (!P.supplySystem || !P.supplySystem.enabled) return;

  // 1. 生产补给（每回合自动生产）
  produceSupplies();

  // 2. 军队消耗补给
  consumeSupplies();

  // 3. 运输补给（沿补给线路）
  transportSupplies();

  // 4. 检查补给不足的军队
  checkSupplyShortage();
}

// 生产补给
function produceSupplies() {
  if (!GM.supplyDepots || !Array.isArray(GM.supplyDepots)) return;
  GM.supplyDepots.forEach(function(depot) {
    var faction = findFacByName(depot.faction);
    if (!faction) return;

    // 基础生产量（基于势力经济，按天数缩放）
    var _sms = (typeof _getDaysPerTurn === 'function' ? _getDaysPerTurn() : 30) / 30;
    var baseProduction = (faction.money || 0) / 100 * _sms;
    var eraState = GM.eraState || P.eraState || {};
    var prosperity = eraState.economicProsperity || 0.5;

    // 生产各类补给
    depot.supplies.food = Math.min(depot.capacity, depot.supplies.food + baseProduction * prosperity * 10);
    depot.supplies.weapon = Math.min(depot.capacity * 0.2, depot.supplies.weapon + baseProduction * 0.5);
    depot.supplies.armor = Math.min(depot.capacity * 0.1, depot.supplies.armor + baseProduction * 0.3);
    depot.supplies.medicine = Math.min(depot.capacity * 0.05, depot.supplies.medicine + baseProduction * 0.2);
    depot.supplies.fodder = Math.min(depot.capacity * 0.15, depot.supplies.fodder + baseProduction * 0.8);
  });
}

// 消耗补给
function consumeSupplies() {
  if (!GM.armies || !Array.isArray(GM.armies)) return;
  GM.armies.forEach(function(army) {
    if (!army.supplyDepotId) {
      // 未指定补给来源，尝试从势力主仓库获取
      var faction = findFacByName(army.faction);
      if (faction && faction.supplyDepots && faction.supplyDepots.length > 0) {
        army.supplyDepotId = faction.supplyDepots[0];
      }
    }

    if (!army.supplyDepotId) return;

    var depot = GM._indices.supplyDepotById.get(army.supplyDepotId);
    if (!depot) return;

    var soldiers = army.soldiers || 0;
    if (soldiers === 0) return;

    // 计算消耗量
    var foodConsume = soldiers * SupplyTypes.food.consumeRate;
    var weaponConsume = soldiers * SupplyTypes.weapon.consumeRate;
    var armorConsume = soldiers * SupplyTypes.armor.consumeRate;
    var medicineConsume = soldiers * SupplyTypes.medicine.consumeRate;

    // 骑兵额外消耗马料
    var cavalryCount = 0;
    if (army.units) {
      army.units.forEach(function(unitId) {
        var unit = GM._indices.unitById.get(unitId);
        if (unit && (unit.type === 'cavalry' || unit.type === 'heavy_cavalry')) {
          cavalryCount += unit.count;
        }
      });
    }
    var fodderConsume = cavalryCount * SupplyTypes.fodder.consumeRate;

    // 从仓库扣除
    var actualFood = Math.min(foodConsume, depot.supplies.food);
    var actualWeapon = Math.min(weaponConsume, depot.supplies.weapon);
    var actualArmor = Math.min(armorConsume, depot.supplies.armor);
    var actualMedicine = Math.min(medicineConsume, depot.supplies.medicine);
    var actualFodder = Math.min(fodderConsume, depot.supplies.fodder);

    depot.supplies.food -= actualFood;
    depot.supplies.weapon -= actualWeapon;
    depot.supplies.armor -= actualArmor;
    depot.supplies.medicine -= actualMedicine;
    depot.supplies.fodder -= actualFodder;

    // 计算补给充足度
    var supplyRatio = (actualFood / foodConsume + actualWeapon / weaponConsume +
                       actualArmor / armorConsume + actualMedicine / medicineConsume) / 4;

    if (cavalryCount > 0) {
      supplyRatio = (supplyRatio * 4 + actualFodder / fodderConsume) / 5;
    }

    // 记录补给状态
    army.supplyRatio = supplyRatio;

    // 补给不足影响士气（按timeRatio缩放）
    var _supTR = (typeof getTimeRatio === 'function') ? getTimeRatio() : (1/12);
    var _supScale = _supTR * 12; // 月度缩放因子（月制=1, 日制≈0.033, 年制=12）
    var _supCfg = (P.battleConfig && P.battleConfig.supplyConfig) || {};
    var _lowLoss = (_supCfg.lowSupplyMoraleLoss || 10) * _supScale;
    var _starveLoss = (_supCfg.starvationMoraleLoss || 20) * _supScale;

    if (supplyRatio < 0.2) {
      // 严重断供/断粮——大幅士气损失+兵力损耗
      army.morale = Math.max(0, (army.morale || 70) - _starveLoss);
      var _attrition = Math.floor(soldiers * 0.02 * _supScale); // 月损2%
      army.soldiers = Math.max(0, soldiers - _attrition);
      // 可能兵变（士气<15时50%概率）
      if ((army.morale || 0) < 15 && (typeof random === 'function' ? random() : Math.random()) < 0.5 * _supScale) {
        addEB('兵变', army.name + '因断粮发生兵变！');
        army.morale = 0;
        army.loyalty = Math.max(0, (army.loyalty || 50) - 30);
      }
    } else if (supplyRatio < 0.5) {
      army.morale = Math.max(0, (army.morale || 70) - _lowLoss);
      var _attrition2 = Math.floor(soldiers * 0.01 * _supScale); // 月损1%
      army.soldiers = Math.max(0, soldiers - _attrition2);
    } else if (supplyRatio < 0.8) {
      army.morale = Math.max(0, (army.morale || 70) - 2 * _supScale);
    }
  });
}

// 运输补给
function transportSupplies() {
  if (!GM.supplyRoutes || GM.supplyRoutes.length === 0) return;

  GM.supplyRoutes.forEach(function(route) {
    if (!route.active) return;

    var sourceDepot = GM._indices.supplyDepotById.get(route.sourceId);
    var targetDepot = GM._indices.supplyDepotById.get(route.targetId);

    if (!sourceDepot || !targetDepot) return;

    // 运输量（每回合固定量）
    var transportAmount = route.capacity || 100;

    // 按比例运输各类补给
    Object.keys(SupplyTypes).forEach(function(type) {
      var amount = Math.min(transportAmount * 0.2, sourceDepot.supplies[type]);
      if (amount > 0 && targetDepot.supplies[type] < targetDepot.capacity) {
        sourceDepot.supplies[type] -= amount;
        targetDepot.supplies[type] = Math.min(targetDepot.capacity, targetDepot.supplies[type] + amount);
      }
    });
  });
}

// 检查补给不足
function checkSupplyShortage() {
  if (!GM.armies || !Array.isArray(GM.armies)) return;
  GM.armies.forEach(function(army) {
    if (army.supplyRatio !== undefined && army.supplyRatio < 0.3) {
      addEB('补给', army.name + ' 补给严重不足（' + (army.supplyRatio * 100).toFixed(0) + '%），士气下降');
    }
  });
}

/**
 * 生成补给状态的AI prompt注入文本
 * @returns {string}
 */
function getSupplyPromptInjection() {
  if (!GM.armies || !Array.isArray(GM.armies)) return '';
  var lines = [];
  GM.armies.forEach(function(army) {
    if (!army.soldiers || army.soldiers <= 0) return;
    if (army.supplyRatio === undefined) return;
    var status = army.supplyRatio >= 0.8 ? '充足' : army.supplyRatio >= 0.5 ? '紧张' : army.supplyRatio >= 0.2 ? '匮乏' : '断粮';
    if (status !== '充足') {
      lines.push('  ' + (army.name||'某军') + ': 补给' + status + '(' + (army.supplyRatio*100).toFixed(0) + '%)' +
        (status === '断粮' ? ' ⚠ 士气骤降，可能兵变' : ''));
    }
  });
  if (lines.length === 0) return '';
  return '【补给状况】\n' + lines.join('\n');
}

// 创建补给线路
function createSupplyRoute(sourceDepotId, targetDepotId, capacity) {
  var route = {
    id: uid(),
    sourceId: sourceDepotId,
    targetId: targetDepotId,
    capacity: capacity || 100,
    active: true,
    createdTurn: GM.turn
  };

  if (!GM.supplyRoutes) GM.supplyRoutes = [];
  GM.supplyRoutes.push(route);

  var sourceDepot = GM._indices.supplyDepotById.get(sourceDepotId);
  var targetDepot = GM._indices.supplyDepotById.get(targetDepotId);

  if (sourceDepot && targetDepot) {
    addEB('补给', '建立补给线路：' + sourceDepot.name + ' → ' + targetDepot.name);
  }

  return route;
}

// 切断补给线路
function cutSupplyRoute(routeId) {
  var route = GM.supplyRoutes.find(function(r) { return r.id === routeId; });
  if (!route) {
    return { success: false, reason: '补给线路不存在' };
  }

  route.active = false;
  addEB('补给', '补给线路已切断');

  return { success: true };
}

// 生成补给报告
function generateSupplyReport(faction) {
  if (!faction) return '无势力数据';

  var report = '【补给报告：' + faction.name + '】\n\n';

  // 仓库列表
  if (faction.supplyDepots && faction.supplyDepots.length > 0) {
    report += '【补给仓库】\n';
    faction.supplyDepots.forEach(function(depotId) {
      var depot = GM._indices.supplyDepotById.get(depotId);
      if (depot) {
        report += '• ' + depot.name + '（' + depot.location + '）\n';
        report += '  容量：' + depot.capacity + '\n';
        report += '  粮草：' + Math.floor(depot.supplies.food) + ' | ';
        report += '武器：' + Math.floor(depot.supplies.weapon) + ' | ';
        report += '盔甲：' + Math.floor(depot.supplies.armor) + '\n';
        report += '  药品：' + Math.floor(depot.supplies.medicine) + ' | ';
        report += '马料：' + Math.floor(depot.supplies.fodder) + '\n';
      }
    });
    report += '\n';
  }

  // 军队补给状态
  var factionArmies = GM.armies.filter(function(a) { return a.faction === faction.name; });
  if (factionArmies.length > 0) {
    report += '【军队补给状态】\n';
    factionArmies.forEach(function(army) {
      report += '• ' + army.name + '（' + (army.soldiers || 0) + ' 人）\n';
      if (army.supplyRatio !== undefined) {
        var ratio = (army.supplyRatio * 100).toFixed(0);
        var status = army.supplyRatio > 0.8 ? '充足' : (army.supplyRatio > 0.5 ? '一般' : '不足');
        report += '  补给状态：' + status + '（' + ratio + '%）\n';
      } else {
        report += '  补给状态：未知\n';
      }
    });
    report += '\n';
  }

  // 补给线路
  if (GM.supplyRoutes && GM.supplyRoutes.length > 0) {
    var factionRoutes = GM.supplyRoutes.filter(function(r) {
      var sourceDepot = GM._indices.supplyDepotById.get(r.sourceId);
      return sourceDepot && sourceDepot.faction === faction.name;
    });

    if (factionRoutes.length > 0) {
      report += '【补给线路】\n';
      factionRoutes.forEach(function(route) {
        var sourceDepot = GM._indices.supplyDepotById.get(route.sourceId);
        var targetDepot = GM._indices.supplyDepotById.get(route.targetId);
        if (sourceDepot && targetDepot) {
          var status = route.active ? '运行中' : '已切断';
          report += '• ' + sourceDepot.name + ' → ' + targetDepot.name + '（' + status + '）\n';
          report += '  运输能力：' + route.capacity + '/回合\n';
        }
      });
    }
  }

  return report;
}

// ============================================================
// 铨选三层候选人分级系统
// ============================================================

// 铨选系统：模拟中国古代官员选拔的三层筛选机制
// 第一层：初筛（资格审查）
// 第二层：精选（能力评估）
// 第三层：最终决策（综合权衡）

// 铨选配置
var QuanxuanConfig = {
  // 初筛标准
  initialScreen: {
    minAge: 20,
    maxAge: 70,
    minLoyalty: 30,
    minIntelligence: 20,
    requiredStatus: ['alive', 'available'] // 必须存活且可用
  },

  // 精选标准
  refinedSelection: {
    excellentThreshold: 0.8,  // 优秀：综合得分 > 0.8
    qualifiedThreshold: 0.5,  // 合格：综合得分 > 0.5
    // 不合格：综合得分 <= 0.5
  },

  // 最终决策权重
  finalDecision: {
    abilityWeight: 0.4,
    loyaltyWeight: 0.3,
    relationshipWeight: 0.2,
    eraFactorWeight: 0.1
  }
};

// 铨选主流程
function performQuanxuan(postId, context) {
  if (!postId || !context) {
    return { success: false, reason: '参数不足' };
  }

  var post = findPostById(postId);
  if (!post) {
    return { success: false, reason: '岗位不存在' };
  }

  // 第一层：初筛
  var initialCandidates = quanxuanInitialScreen(post, context);
  if (initialCandidates.length === 0) {
    return { success: false, reason: '无符合资格的候选人' };
  }

  // 第二层：精选
  var refinedCandidates = quanxuanRefinedSelection(initialCandidates, post, context);

  // 第三层：最终决策
  var finalDecision = quanxuanFinalDecision(refinedCandidates, post, context);

  return {
    success: true,
    initialCount: initialCandidates.length,
    refinedCandidates: refinedCandidates,
    finalDecision: finalDecision
  };
}

// 第一层：初筛（资格审查）
function quanxuanInitialScreen(post, context) {
  if (!GM.chars || GM.chars.length === 0) return [];

  var config = QuanxuanConfig.initialScreen;
  var candidates = [];

  GM.chars.forEach(function(char) {
    // 基本资格检查
    if (char.alive === false) return;
    if (char.isPlayer) return; // 玩家角色不参与铨选

    // 年龄检查
    var age = char.age || 30;
    if (age < config.minAge || age > config.maxAge) return;

    // 忠诚度检查
    var loyalty = char.loyalty || 50;
    if (loyalty < config.minLoyalty) return;

    // 智谋检查
    var intelligence = char.intelligence || 50;
    if (intelligence < config.minIntelligence) return;

    // 岗位特定要求检查
    if (post.requirements) {
      if (post.requirements.minIntelligence && intelligence < post.requirements.minIntelligence) return;
      if (post.requirements.minValor && (char.valor || 50) < post.requirements.minValor) return;
      if (post.requirements.minLoyalty && loyalty < post.requirements.minLoyalty) return;
    }

    // 通过初筛
    candidates.push({
      name: char.name,
      character: char,
      screenLevel: 'initial'
    });
  });

  return candidates;
}

// 第二层：精选（能力评估）
function quanxuanRefinedSelection(initialCandidates, post, context) {
  if (!initialCandidates || initialCandidates.length === 0) return { excellent: [], qualified: [], unqualified: [] };

  var config = QuanxuanConfig.refinedSelection;
  var excellent = [];
  var qualified = [];
  var unqualified = [];

  initialCandidates.forEach(function(candidate) {
    var char = candidate.character;

    // 使用权重计算系统评估候选人
    var weightResult = calculateCandidateWeight({
      name: char.name,
      intelligence: char.intelligence || 50,
      valor: char.valor || 50,
      benevolence: char.benevolence || 50,
      loyalty: char.loyalty || 50,
      faction: char.faction,
      kinship: char.kinship,
      hasOffice: findNpcOffice(char.name) !== null,
      reputation: char.reputation || 50
    }, context);

    // 归一化得分（0-1）
    var normalizedScore = Math.min(1, weightResult.total / 10);

    var refinedCandidate = {
      name: char.name,
      character: char,
      score: normalizedScore,
      weightBreakdown: weightResult.breakdown,
      eraModifier: weightResult.eraModifier
    };

    // 分级
    if (normalizedScore >= config.excellentThreshold) {
      refinedCandidate.grade = 'excellent';
      excellent.push(refinedCandidate);
    } else if (normalizedScore >= config.qualifiedThreshold) {
      refinedCandidate.grade = 'qualified';
      qualified.push(refinedCandidate);
    } else {
      refinedCandidate.grade = 'unqualified';
      unqualified.push(refinedCandidate);
    }
  });

  // 排序
  excellent.sort(function(a, b) { return b.score - a.score; });
  qualified.sort(function(a, b) { return b.score - a.score; });
  unqualified.sort(function(a, b) { return b.score - a.score; });

  return {
    excellent: excellent,
    qualified: qualified,
    unqualified: unqualified
  };
}

// 第三层：最终决策（综合权衡）
function quanxuanFinalDecision(refinedCandidates, post, context) {
  // 优先从优秀候选人中选择
  if (refinedCandidates.excellent && refinedCandidates.excellent.length > 0) {
    var topCandidate = refinedCandidates.excellent[0];
    return {
      selected: topCandidate,
      reason: '优秀候选人，综合得分最高',
      alternatives: refinedCandidates.excellent.slice(1, 3)
    };
  }

  // 其次从合格候选人中选择
  if (refinedCandidates.qualified && refinedCandidates.qualified.length > 0) {
    var topQualified = refinedCandidates.qualified[0];
    return {
      selected: topQualified,
      reason: '合格候选人，能力达标',
      alternatives: refinedCandidates.qualified.slice(1, 3)
    };
  }

  // 无合适候选人
  return {
    selected: null,
    reason: '无合适候选人',
    alternatives: []
  };
}

// 生成铨选报告
function generateQuanxuanReport(quanxuanResult) {
  if (!quanxuanResult.success) {
    return '铨选失败：' + quanxuanResult.reason;
  }

  var report = '【铨选报告】\n\n';

  report += '初筛通过：' + quanxuanResult.initialCount + ' 人\n\n';

  var refined = quanxuanResult.refinedCandidates;

  report += '精选结果：\n';
  report += '  优秀：' + refined.excellent.length + ' 人\n';
  report += '  合格：' + refined.qualified.length + ' 人\n';
  report += '  不合格：' + refined.unqualified.length + ' 人\n\n';

  if (refined.excellent.length > 0) {
    report += '【优秀候选人】\n';
    refined.excellent.slice(0, 5).forEach(function(c, i) {
      report += (i + 1) + '. ' + c.name + '（得分：' + c.score.toFixed(2) + '）\n';
      report += '   智谋：' + (c.character.intelligence || 50) + ' | ';
      report += '忠诚：' + (c.character.loyalty || 50) + ' | ';
      report += '武勇：' + (c.character.valor || 50) + '\n';
    });
    report += '\n';
  }

  if (refined.qualified.length > 0) {
    report += '【合格候选人】\n';
    refined.qualified.slice(0, 3).forEach(function(c, i) {
      report += (i + 1) + '. ' + c.name + '（得分：' + c.score.toFixed(2) + '）\n';
    });
    report += '\n';
  }

  var decision = quanxuanResult.finalDecision;
  if (decision.selected) {
    report += '【最终决策】\n';
    report += '推荐：' + decision.selected.name + '\n';
    report += '理由：' + decision.reason + '\n';

    if (decision.alternatives && decision.alternatives.length > 0) {
      report += '备选：' + decision.alternatives.map(function(a) { return a.name; }).join('、') + '\n';
    }
  } else {
    report += '【最终决策】\n';
    report += '无合适候选人\n';
  }

  return report;
}

// 自动铨选并任命
function autoQuanxuanAndAppoint(postId, context) {
  var result = performQuanxuan(postId, context);

  if (!result.success || !result.finalDecision.selected) {
    return { success: false, reason: '铨选失败或无合适候选人' };
  }

  var selectedCandidate = result.finalDecision.selected;
  var appointResult = appointToPost(postId, selectedCandidate.name);

  if (appointResult.success) {
    addEB('铨选', '通过铨选任命 ' + selectedCandidate.name + ' 到岗位');
    return { success: true, candidate: selectedCandidate, report: generateQuanxuanReport(result) };
  } else {
    return { success: false, reason: '任命失败：' + appointResult.reason };
  }
}


// 更新军事单位
function updateMilitary(timeRatio) {
  var sc = findScenarioById(GM.sid);
  if (!sc || !sc.military || !sc.military.initialTroops) return;

  sc.military.initialTroops.forEach(function(troop) {
    if (!troop || !troop.name) return;

    // 士气变化
    if (troop.morale !== undefined) {
      var oldMorale = troop.morale;
      var change = Math.floor((random() - 0.5) * 6 * timeRatio); // 年度±3
      troop.morale = Math.max(0, Math.min(100, troop.morale + change));

      if (Math.abs(change) > 1) {
        recordChange('military', troop.name, 'morale', oldMorale, troop.morale, '日常波动');
      }
    }

    // 训练度提升
    if (troop.training !== undefined && troop.training < 100) {
      var oldTraining = troop.training;
      var inc = Math.floor(random() * 3 * timeRatio); // 年度+0-2
      troop.training = Math.min(100, troop.training + inc);

      if (inc > 0) {
        recordChange('military', troop.name, 'training', oldTraining, troop.training, '日常训练');
      }
    }

    // 忠诚度微调
    if (troop.loyalty !== undefined) {
      var oldLoyalty = troop.loyalty;
      var change = Math.floor((random() - 0.5) * 4 * timeRatio); // 年度±2
      troop.loyalty = Math.max(0, Math.min(100, troop.loyalty + change));

      if (Math.abs(change) > 1) {
        recordChange('military', troop.name, 'loyalty', oldLoyalty, troop.loyalty, '军心变化');
      }
    }
  });
}

// 更新地图数据
function updateMap(timeRatio) {
  // 支持新的地图数据结构 (P.map.regions)
  if (P.map && P.map.regions && P.map.regions.length > 0) {
    P.map.regions.forEach(function(region) {
      if (!region) return;

      // 1. 发展度自然变化
      var oldDev = region.development || 50;
      var newDev = oldDev;

      // 和平时期缓慢增长
      if (region.owner && random() < 0.3) {
        var growth = (1 + random() * 2) * timeRatio; // 1-3点/年
        newDev = Math.min(100, oldDev + growth);
      }

      // 战争或无主降低发展度
      if (!region.owner && random() < 0.2) {
        var decline = (1 + random() * 3) * timeRatio;
        newDev = Math.max(0, oldDev - decline);
      }

      if (Math.abs(newDev - oldDev) > 0.5) {
        region.development = Math.round(newDev);
        recordChange('map', region.name, 'development', oldDev, region.development,
          newDev > oldDev ? '发展' : '衰退');
      }

      // 2. 驻军自然消耗
      if (region.troops > 0 && random() < 0.1) {
        var oldTroops = region.troops;
        var attrition = Math.floor(region.troops * 0.01 * timeRatio); // 1%损耗/年
        region.troops = Math.max(0, region.troops - attrition);
        if (attrition > 0) {
          recordChange('map', region.name, 'troops', oldTroops, region.troops, '自然损耗');
        }
      }
    });
  }

  // 兼容旧的地图数据结构
  var sc = findScenarioById(GM.sid);
  if (!sc || !sc.map || !sc.map.items) return;

  sc.map.items.forEach(function(item) {
    if (!item || !item.name) return;

    if (item.type === 'city' && item.population) {
      // 城市人口缓慢增长
      var oldPop = item.population;
      // 简化：人口年增长1-3%
      if (random() < 0.5) {
        var growthRate = 0.01 + random() * 0.02; // 1-3%
        var change = growthRate * timeRatio;
        // 这里需要解析人口字符串，简化处理
        recordChange('map', item.name, 'population', oldPop, item.population, '自然增长');
      }
    }
  });
}

// ============================================================
// 战争意愿权重系统（借鉴晚唐风云 warCalc）
// 用权重决定 NPC 宣战意愿，AI 负责叙述理由
// ============================================================
/**
 * 战争意愿权重系统
 * @namespace
 * @property {function(Object, Object, Object=):number} evaluateWarWeight - 宣战意愿(0-100)
 * @property {function(string, string, number=):void} addTruce - 添加停战
 * @property {function(string, string):boolean} hasTruce - 检查停战
 * @property {function():Object} serialize
 * @property {function(Object):void} deserialize
 */
var WarWeightSystem = {
  /** 评估 NPC 宣战意愿权重（0=绝不，100=必战） */
  evaluateWarWeight: function(attacker, defender, context) {
    if (!attacker || !defender) return 0;
    var weight = 0;

    // 基础：默认不倾向战争
    weight -= 10;

    // 军力对比
    var aStr = (attacker.troops || 0) + (attacker.soldiers || 0);
    var dStr = (defender.troops || 0) + (defender.soldiers || 0);
    var ratio = dStr > 0 ? aStr / dStr : 2;
    if (ratio >= 2) weight += 20;
    else if (ratio >= 1.5) weight += 10;
    else if (ratio < 0.5) weight -= 30;
    else if (ratio < 0.8) weight -= 15;

    // 性格影响（如果有）
    if (attacker.ambition) weight += (attacker.ambition - 50) * 0.3;
    if (attacker.loyalty !== undefined) weight -= attacker.loyalty * 0.2;

    // 关系影响
    if (context && context.opinion !== undefined) {
      if (context.opinion > 20) weight -= 30; // 友好不开战
      else if (context.opinion < -30) weight += 15;
    }

    // 时代影响
    if (GM.eraState) {
      var phase = GM.eraState.dynastyPhase || 'peak';
      if (phase === 'collapse') weight += 20;
      else if (phase === 'decline') weight += 10;
      else if (phase === 'peak') weight -= 15;
    }

    // 停战惩罚
    if (WarWeightSystem.hasTruce(attacker.name, defender.name)) {
      weight -= 40;
    }

    return clamp(Math.round(weight), 0, 100);
  },

  // 停战记录 {key: expiryTurn}
  _truces: {},
  TRUCE_DURATION: 24, // 24回合 ≈ 2年

  /** 添加停战 */
  addTruce: function(partyA, partyB, duration) {
    var key = [partyA, partyB].sort().join('|');
    WarWeightSystem._truces[key] = GM.turn + (duration || WarWeightSystem.TRUCE_DURATION);
    _dbg('[War] 停战协议:', partyA, '↔', partyB, '至回合', WarWeightSystem._truces[key]);
  },

  /** 检查停战 */
  hasTruce: function(partyA, partyB) {
    var key = [partyA, partyB].sort().join('|');
    var expiry = WarWeightSystem._truces[key];
    if (!expiry) return false;
    if (GM.turn >= expiry) { delete WarWeightSystem._truces[key]; return false; }
    return true;
  },

  /** 清理过期停战 */
  cleanTruces: function() {
    var keys = Object.keys(WarWeightSystem._truces);
    keys.forEach(function(k) {
      if (GM.turn >= WarWeightSystem._truces[k]) delete WarWeightSystem._truces[k];
    });
  },

  /** 序列化 */
  serialize: function() { return { truces: WarWeightSystem._truces }; },
  deserialize: function(d) { if (d && d.truces) WarWeightSystem._truces = d.truces; }
};

// ============================================================
// D1. 宣战理由(Casus Belli)系统
// ============================================================

var CasusBelliSystem = (function() {
  'use strict';

  function _getTypes() {
    return (P.warConfig && P.warConfig.casusBelliTypes) || [
      {id:'rebellion', name:'平叛讨逆', prestigeCost:0, legitimacyCost:0, truceMonths:12},
      {id:'border', name:'边境争端', prestigeCost:3, legitimacyCost:0, truceMonths:12},
      {id:'claim', name:'宣称领土', prestigeCost:8, legitimacyCost:10, truceMonths:36},
      {id:'holy', name:'天子讨不臣', prestigeCost:0, legitimacyCost:0, truceMonths:36},
      {id:'subjugation', name:'武力征服', prestigeCost:15, legitimacyCost:20, truceMonths:48},
      {id:'none', name:'无端开衅', prestigeCost:25, legitimacyCost:40, truceMonths:60}
    ];
  }

  /**
   * 查找CB定义
   * @param {string} cbId
   * @returns {Object|null}
   */
  function findCB(cbId) {
    return _getTypes().find(function(cb) { return cb.id === cbId; }) || null;
  }

  /**
   * 处理宣战：扣除成本、创建战争记录、添加停战
   * @param {string} attacker - 攻方势力名
   * @param {string} defender - 守方势力名
   * @param {string} cbId - CB类型ID（不提供则套用'none'）
   * @returns {Object} {success, war, cbUsed, message}
   */
  function declareWar(attacker, defender, cbId) {
    var cb = findCB(cbId || 'none') || findCB('none');

    // 检查停战
    if (WarWeightSystem.hasTruce(attacker, defender)) {
      return {success:false, message:'停战期内不可宣战'};
    }

    // 检查已有战争
    var existingWar = (GM.activeWars||[]).find(function(w) {
      return (w.attacker===attacker && w.defender===defender) || (w.attacker===defender && w.defender===attacker);
    });
    if (existingWar) return {success:false, message:'已在交战中'};

    addEB('外交', attacker + '以"' + cb.name + '"为由向' + defender + '宣战');

    // 创建战争记录
    var war = {
      id: uid(),
      attacker: attacker,
      defender: defender,
      casusBelli: cb.id,
      casusBelliName: cb.name,
      startTurn: GM.turn,
      warScore: 0,
      truceMonths: cb.truceMonths || 12
    };
    if (!GM.activeWars) GM.activeWars = [];
    GM.activeWars.push(war);

    return {success:true, war:war, cbUsed:cb};
  }

  /**
   * 结束战争：添加停战期
   */
  function endWar(warId) {
    var idx = (GM.activeWars||[]).findIndex(function(w){return w.id===warId;});
    if (idx < 0) return;
    var war = GM.activeWars[idx];
    // 添加停战
    var truceTurns = (typeof turnsForMonths === 'function') ? turnsForMonths(war.truceMonths||12) : 12;
    WarWeightSystem.addTruce(war.attacker, war.defender, truceTurns);
    // 移除战争
    GM.activeWars.splice(idx, 1);
    addEB('外交', war.attacker + '与' + war.defender + '停战，停战期' + (war.truceMonths||12) + '个月');
  }

  /**
   * 生成AI prompt——可用CB列表+现有战争
   */
  function getPromptInjection() {
    var lines = [];
    // 现有战争
    if (GM.activeWars && GM.activeWars.length > 0) {
      lines.push('【当前战争】');
      GM.activeWars.forEach(function(w) {
        lines.push('  ' + w.attacker + ' vs ' + w.defender + ' (理由:' + (w.casusBelliName||w.casusBelli) + ' 积分:' + (w.warScore||0) + ')');
      });
    }
    // CB约束提示
    var types = _getTypes();
    if (types.length > 0) {
      lines.push('【战争法则】发动战争需指定理由(casusBelli)，否则视为"无端开衅"（最高惩罚）。');
      lines.push('  可用理由: ' + types.map(function(t){return t.name+'(威望-'+t.prestigeCost+')';}).join(' | '));
    }
    return lines.length > 0 ? lines.join('\n') : '';
  }

  return { findCB:findCB, declareWar:declareWar, endWar:endWar, getPromptInjection:getPromptInjection };
})();

// ============================================================
// D2. 盟约条约系统
// ============================================================

var TreatySystem = (function() {
  'use strict';

  function _getTypeTemplates() {
    return (P.diplomacyConfig && P.diplomacyConfig.treatyTypes) || [
      {id:'alliance', name:'同盟', durationMonths:36, mutual_defense:true, breakPenalty:{prestige:-20}},
      {id:'truce', name:'停战', durationMonths:12, breakPenalty:{prestige:-15}},
      {id:'tribute', name:'朝贡', durationMonths:0},
      {id:'marriage', name:'和亲', durationMonths:0, breakPenalty:{prestige:-25}},
      {id:'trade', name:'互市', durationMonths:12}
    ];
  }

  /**
   * 创建条约
   */
  function createTreaty(typeId, partyA, partyB, terms) {
    var template = _getTypeTemplates().find(function(t){return t.id===typeId;});
    if (!template) return null;
    var durationTurns = template.durationMonths > 0 ? ((typeof turnsForMonths==='function') ? turnsForMonths(template.durationMonths) : template.durationMonths) : 0;

    var treaty = {
      id: uid(),
      type: typeId,
      typeName: template.name,
      parties: [partyA, partyB],
      startTurn: GM.turn,
      durationTurns: durationTurns, // 0=永久
      expiryTurn: durationTurns > 0 ? GM.turn + durationTurns : 0,
      terms: terms || template.terms || {},
      breakPenalty: template.breakPenalty || {},
      active: true
    };
    if (!GM.treaties) GM.treaties = [];
    GM.treaties.push(treaty);
    addEB('外交', partyA + '与' + partyB + '缔结' + template.name + (durationTurns>0 ? '（期限'+durationTurns+'回合）' : '（永久）'));
    return treaty;
  }

  /**
   * 违约/废除条约
   */
  function breakTreaty(treatyId, breakerName) {
    var idx = (GM.treaties||[]).findIndex(function(t){return t.id===treatyId;});
    if (idx < 0) return;
    var treaty = GM.treaties[idx];
    addEB('外交', breakerName + '废除了与' + treaty.parties.filter(function(p){return p!==breakerName;}).join('、') + '的' + treaty.typeName + '，信誉受损');
    GM.treaties.splice(idx, 1);
  }

  /**
   * 每回合清理到期条约
   */
  function cleanExpired() {
    if (!GM.treaties) return;
    GM.treaties = GM.treaties.filter(function(t) {
      if (t.expiryTurn > 0 && GM.turn >= t.expiryTurn) {
        addEB('外交', t.parties.join('与') + '的' + t.typeName + '到期解除');
        return false;
      }
      return true;
    });
  }

  /**
   * 检查两方是否有特定类型的条约
   */
  function hasTreaty(partyA, partyB, typeId) {
    return (GM.treaties||[]).some(function(t) {
      var match = t.parties.indexOf(partyA) >= 0 && t.parties.indexOf(partyB) >= 0;
      return match && (!typeId || t.type === typeId) && t.active;
    });
  }

  function getPromptInjection() {
    if (!GM.treaties || GM.treaties.length === 0) return '';
    var lines = ['【现有条约】'];
    GM.treaties.forEach(function(t) {
      var remaining = t.expiryTurn > 0 ? '剩' + (t.expiryTurn - GM.turn) + '回合' : '永久';
      lines.push('  ' + t.parties.join('↔') + ' ' + t.typeName + ' (' + remaining + ')');
    });
    return lines.join('\n');
  }

  /** 检查faction_events中的宣战是否违反现有条约 */
  function checkViolations(factionEvents) {
    if (!GM.treaties || !GM.treaties.length || !factionEvents) return;
    factionEvents.forEach(function(fe) {
      if (!fe.action || fe.action.indexOf('宣战') < 0) return;
      var attacker = fe.actor || '';
      var defender = fe.target || '';
      if (!attacker || !defender) return;
      // 检查是否有和平/联盟条约
      var violated = GM.treaties.filter(function(t) {
        return t.active && t.parties.indexOf(attacker) >= 0 && t.parties.indexOf(defender) >= 0;
      });
      violated.forEach(function(t) {
        t.active = false; // 条约失效
        addEB('违约', attacker + '背弃与' + defender + '的' + t.typeName + '！');
      });
    });
  }

  return { createTreaty:createTreaty, breakTreaty:breakTreaty, cleanExpired:cleanExpired, hasTreaty:hasTreaty, checkViolations:checkViolations, getPromptInjection:getPromptInjection };
})();

// 注册条约清理
SettlementPipeline.register('treatyClean', '条约清理', function() { TreatySystem.cleanExpired(); }, 30, 'perturn');

// ============================================================
// D3. 阴谋系统
// ============================================================

var SchemeSystem = (function() {
  'use strict';

  function _getTypes() {
    return (P.schemeConfig && P.schemeConfig.schemeTypes) || [];
  }

  /**
   * 发起阴谋
   */
  function initiate(schemerId, targetId, typeId) {
    var types = _getTypes();
    var sType = types.find(function(t){return t.id===typeId;});
    if (!sType) return {success:false, message:'未知阴谋类型'};
    if (!P.schemeConfig || !P.schemeConfig.enabled) return {success:false, message:'阴谋系统未启用'};

    // 冷却检查
    if (!GM.schemeCooldowns) GM.schemeCooldowns = {};
    var cdKey = schemerId + '_' + targetId + '_' + typeId;
    var cdTurns = (typeof turnsForMonths === 'function') ? turnsForMonths(sType.cooldownMonths || 24) : 24;
    if (GM.schemeCooldowns[cdKey] && GM.turn - GM.schemeCooldowns[cdKey] < cdTurns) {
      return {success:false, message:'冷却中（剩余' + (cdTurns - (GM.turn - GM.schemeCooldowns[cdKey])) + '回合）'};
    }

    // 计算成功率
    var schemer = findCharByName(schemerId);
    var target = findCharByName(targetId);
    if (!schemer || !target) return {success:false, message:'角色不存在'};

    var successRate = sType.baseSuccess || 0.15;
    successRate += (schemer.intelligence || 50) * (sType.offenseWeight || 0.005);
    if (sType.defenseAttr && sType.defenseWeight) {
      successRate -= (target[sType.defenseAttr] || 50) * sType.defenseWeight;
    }
    successRate = Math.max(0.01, Math.min(0.95, successRate));

    // 2.4: 多阶段支持——从schemeType读取阶段数（默认1）
    var totalPhases = sType.phases || 1;
    var phaseNames = sType.phaseNames || [];
    var phaseProgress = sType.phaseProgress || []; // 每阶段月基准进度

    var scheme = {
      id: uid(),
      typeId: typeId,
      typeName: sType.name,
      schemer: schemerId,
      target: targetId,
      startTurn: GM.turn,
      successRate: Math.round(successRate * 100),
      progress: 0, // 当前阶段进度 0-100
      discovered: false,
      status: 'active', // active|success|failure|exposed
      // 2.4: 多阶段字段
      phase: { current: 1, total: totalPhases },
      phaseNames: phaseNames,
      phaseProgress: phaseProgress,
      // 2.4: 发起时冻结快照（后续阶段不再实时读取能力值）
      snapshot: {
        initiatorIntel: schemer.intelligence || 50,
        targetIntel: target.intelligence || 50,
        baseRate: successRate
      }
    };

    if (!GM.activeSchemes) GM.activeSchemes = [];
    GM.activeSchemes.push(scheme);
    DebugLog.log('scheme', schemerId, '发起', sType.name, '→', targetId,
      '成功率', scheme.successRate + '%', '阶段', '1/' + totalPhases);
    return {success:true, scheme:scheme};
  }

  /**
   * 每回合推进所有活跃阴谋
   */
  function advanceAll() {
    if (!GM.activeSchemes || !GM.activeSchemes.length) return;
    if (!P.schemeConfig || !P.schemeConfig.enabled) return;

    var tr = (typeof getTimeRatio === 'function') ? getTimeRatio() : (1/12);
    var monthScale = tr * 12;

    GM.activeSchemes.forEach(function(scheme) {
      if (scheme.status !== 'active') return;

      // 2.4: 多阶段进度推进
      // 确保phase对象存在（兼容旧存档）
      if (!scheme.phase) scheme.phase = { current: 1, total: 1 };
      var curPhase = scheme.phase.current;
      var totalPhases = scheme.phase.total;

      // 每阶段月基准进度（从配置读取，越后越慢；默认10）
      var baseProgress = 10;
      if (scheme.phaseProgress && scheme.phaseProgress.length >= curPhase) {
        baseProgress = scheme.phaseProgress[curPhase - 1];
      }
      // 最小月进度保障
      var minProg = (typeof getBalanceVal === 'function') ? getBalanceVal('scheme.minProgressPerMonth', 3) : 3;
      baseProgress = Math.max(minProg, baseProgress);

      // 进度增量clamp到合理范围，防止大回合剧本(1年/回合)一回合完成全部进度
      var progressIncrement = Math.min(30, baseProgress * monthScale);
      scheme.progress = Math.min(100, scheme.progress + progressIncrement);

      // 5.5: 阴谋暴露——关系弱的参与者更易告密
      if (scheme.participants && scheme.status === 'active') {
        scheme.participants.forEach(function(pName) {
          if (scheme.status !== 'active') return; // 已被告密则跳过
          var pCh = findCharByName(pName);
          if (!pCh || !pCh._relationships) return;
          var schemerRel = pCh._relationships[scheme.schemer];
          var relStrength = 0;
          if (schemerRel) schemerRel.forEach(function(r){ relStrength += (r.strength||0); });
          // 关系弱→告密概率增加（每回合base 2%，关系每-10增加1%）
          var betrayalChance = 0.02 + Math.max(0, -relStrength) * 0.001;
          if (random() < betrayalChance) {
            scheme.discovered = true;
            scheme.status = 'exposed';
            addEB('\u9634\u8C0B', pName + '\u544A\u53D1\u4E86' + scheme.schemer + '\u7684' + scheme.typeName);
          }
        });
      }

      // 败露检测
      var sType = _getTypes().find(function(t){return t.id===scheme.typeId;});
      var discoveryChance = (sType && sType.discoveryChance) || 0.1;
      // 越后面的阶段败露概率越高
      var phaseDiscoveryMult = 1 + (curPhase - 1) * 0.3;
      // 用补概率模型防止大回合溢出：1-(1-p)^months，而非 p*months
      var effectiveDiscovery = 1 - Math.pow(1 - Math.min(discoveryChance * phaseDiscoveryMult, 0.5), Math.max(1, monthScale));
      if (random() < effectiveDiscovery) {
        scheme.discovered = true;
        scheme.status = 'exposed';
        if (typeof EnYuanSystem !== 'undefined') {
          EnYuanSystem.add('yuan', scheme.target, scheme.schemer, 3, scheme.typeName + '阴谋败露');
        }
        if (typeof FaceSystem !== 'undefined') {
          var schemerChar = findCharByName(scheme.schemer);
          if (schemerChar) FaceSystem.changeFace(schemerChar, -20, scheme.typeName + '败露');
        }
        var phaseName = (scheme.phaseNames && scheme.phaseNames[curPhase-1]) || ('第' + curPhase + '阶段');
        addEB('阴谋', scheme.schemer + '对' + scheme.target + '的' + scheme.typeName + '在' + phaseName + '败露！');
      }

      // 进度满→判断是否进入下一阶段
      if (scheme.progress >= 100 && scheme.status === 'active') {
        if (curPhase < totalPhases) {
          // 进入下一阶段
          scheme.phase.current = curPhase + 1;
          scheme.progress = 0;
          var nextPhaseName = (scheme.phaseNames && scheme.phaseNames[curPhase]) || ('第' + (curPhase+1) + '阶段');
          addEB('阴谋', scheme.schemer + '的' + scheme.typeName + '进入' + nextPhaseName);
          // 写入NPC记忆
          if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.addMemory) {
            NpcMemorySystem.addMemory(scheme.schemer, scheme.typeName + '计划进入' + nextPhaseName, 5, 'scheme');
          }
          // emit事件
          if (typeof GameEventBus !== 'undefined') {
            GameEventBus.emit('scheme:phaseChange', { scheme: scheme, newPhase: curPhase + 1 });
          }
          DebugLog.log('scheme', scheme.schemer, scheme.typeName, '进入阶段', curPhase + 1, '/', totalPhases);
        } else {
          // 最终阶段完成→结算（使用快照中的成功率）
          var finalRate = scheme.successRate;
          var roll = random();
          if (roll < finalRate / 100) {
            scheme.status = 'success';
            addEB('阴谋', scheme.schemer + '对' + scheme.target + '的' + scheme.typeName + '成功！');
          } else {
            scheme.status = 'failure';
            addEB('阴谋', scheme.schemer + '对' + scheme.target + '的' + scheme.typeName + '失败。');
          }
          if (!GM.schemeCooldowns) GM.schemeCooldowns = {};
          GM.schemeCooldowns[scheme.schemer + '_' + scheme.target + '_' + scheme.typeId] = GM.turn;
        }
      }
    });

    // 清理已结算的 + 写入NPC记忆
    var resolved = GM.activeSchemes.filter(function(s){return s.status!=='active';});
    if (!GM._turnSchemeResults) GM._turnSchemeResults = [];
    resolved.forEach(function(s){
      GM._turnSchemeResults.push(s);
      // E3: 阴谋结果写入相关角色记忆
      if (typeof NpcMemorySystem !== 'undefined' && NpcMemorySystem.addMemory) {
        if (s.status === 'success') {
          NpcMemorySystem.addMemory(s.schemer, '对' + s.target + '发起的' + s.typeName + '阴谋得逞', 8, 'scheme');
          NpcMemorySystem.addMemory(s.target, '遭到' + s.typeName + '阴谋，受害严重', 9, 'scheme');
        } else if (s.status === 'exposed') {
          NpcMemorySystem.addMemory(s.schemer, '对' + s.target + '的' + s.typeName + '阴谋败露，身败名裂', 9, 'scheme');
          NpcMemorySystem.addMemory(s.target, '识破了' + s.schemer + '的' + s.typeName + '阴谋', 7, 'scheme');
          // 败露影响派系关系
          var sc = findCharByName(s.schemer), tc = findCharByName(s.target);
          if (sc && tc && sc.faction && tc.faction && sc.faction !== tc.faction) {
            var sf = GM.facs && GM.facs.find(function(f){return f.name===sc.faction;});
            var tf = GM.facs && GM.facs.find(function(f){return f.name===tc.faction;});
            if (sf && tf) {
              if (!sf._factionRelations) sf._factionRelations = {};
              sf._factionRelations[tc.faction] = (sf._factionRelations[tc.faction] || 0) - 15;
            }
          }
        } else if (s.status === 'failure') {
          NpcMemorySystem.addMemory(s.schemer, '对' + s.target + '的' + s.typeName + '阴谋未能成功', 6, 'scheme');
        }
      }
    });
    GM.activeSchemes = GM.activeSchemes.filter(function(s){return s.status==='active';});
  }

  function getPromptInjection() {
    var lines = [];
    if (GM.activeSchemes && GM.activeSchemes.length > 0) {
      lines.push('【进行中的阴谋】');
      GM.activeSchemes.forEach(function(s) {
        // 2.4: 显示阶段信息
        var phaseInfo = '';
        if (s.phase && s.phase.total > 1) {
          var pName = (s.phaseNames && s.phaseNames[s.phase.current-1]) || ('阶段' + s.phase.current);
          phaseInfo = ' 第' + s.phase.current + '/' + s.phase.total + '阶段(' + pName + ')';
        }
        lines.push('  ' + s.schemer + '→' + s.target + ' ' + s.typeName + phaseInfo + ' 进度' + Math.round(s.progress) + '% 成功率' + s.successRate + '%');
      });
    }
    if (GM._turnSchemeResults && GM._turnSchemeResults.length > 0) {
      lines.push('【阴谋结果（不可更改）】');
      GM._turnSchemeResults.forEach(function(s) {
        lines.push('  ' + s.schemer + '→' + s.target + ' ' + s.typeName + ': ' +
          (s.status==='success'?'成功':s.status==='exposed'?'败露':s.status==='failure'?'失败':s.status));
      });
    }
    return lines.length > 0 ? lines.join('\n') : '';
  }

  return { initiate:initiate, advanceAll:advanceAll, getPromptInjection:getPromptInjection };
})();

// 注册阴谋推进
SettlementPipeline.register('scheme', '阴谋推进', function() { SchemeSystem.advanceAll(); }, 38, 'perturn');

// ============================================================
// 5.2: 军队行军与位置系统（基于GM.armies的destination字段）
// 与MarchSystem并行——MarchSystem处理marchOrders，本步骤处理armies的destination
// ============================================================
SettlementPipeline.register('armyMarch', '军队行军', function() {
  if (!GM.armies) GM.armies = [];
  var dpv = (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 30;
  var marchReports = [];

  GM.armies.forEach(function(army) {
    if (!army.destination || army.destination === army.location) return;
    // 行军速度（里/天）
    var speed = 30; // 默认步兵
    if (army.type === 'cavalry' || army.cavalryRatio > 0.5) speed = 60;
    if (army.hasSiege || army.hasSupplyTrain) speed = Math.min(speed, 20);
    // 编辑器可配置
    if (P.mechanicsConfig && P.mechanicsConfig.marchSpeed) speed = P.mechanicsConfig.marchSpeed[army.type] || speed;

    var dailyDistance = speed;
    var turnDistance = dailyDistance * dpv;

    // 有地图时计算实际距离
    var totalDistance = army._remainingDistance || 0;
    if (totalDistance <= 0) {
      // 首次行军——估算距离（有地图用邻接，无地图用默认值）
      if (P.map && P.map.regions) {
        // 简化：邻接步数 × 300里
        totalDistance = 600; // 默认2步邻接
      } else {
        totalDistance = 900; // 无地图默认距离
      }
      army._remainingDistance = totalDistance;
      army._marchStartTurn = GM.turn;
    }

    army._remainingDistance -= turnDistance;

    if (army._remainingDistance <= 0) {
      // 到达目的地
      army.location = army.destination;
      army.destination = '';
      army._remainingDistance = 0;
      marchReports.push(army.name + '\u5DF2\u62B5\u8FBE' + army.location);
      if (typeof addEB === 'function') addEB('\u884C\u519B', army.name + '\u62B5\u8FBE' + army.location);
    } else {
      // 行军中——消耗补给、降低士气
      army.morale = Math.max(10, (army.morale || 70) - 2);
      if (army.supply !== undefined) army.supply = Math.max(0, army.supply - dpv * 0.5);
      var turnsLeft = Math.ceil(army._remainingDistance / turnDistance);
      marchReports.push(army.name + '\u6B63\u5728\u884C\u519B\u2192' + army.destination + '\uFF08\u7EA6' + turnsLeft + '\u56DE\u5408\u5230\u8FBE\uFF09');
    }
  });
  GM._marchReport = marchReports.length > 0 ? marchReports.join('\uFF1B') : '';
}, 37, 'perturn');

// ============================================================
// D4. 称王称帝决策系统
// ============================================================

var DecisionSystem = (function() {
  'use strict';

  function _getDecisions() {
    return (P.decisionConfig && P.decisionConfig.decisions) || [
      {id:'create_emperor', name:'称帝',
       conditions:['eraPhase==乱世','noExistingEmperor','controlRatio>=0.6'],
       cost:{prestige:40, money:10000},
       effects:[{type:'grant_title',level:'emperor'},{type:'set_era',phase:'治世'}],
       description:'登基称帝，开创新朝'},
      {id:'create_kingdom', name:'称王',
       conditions:['controlRatio>=0.5'],
       cost:{prestige:20, money:5000},
       effects:[{type:'grant_title',level:'king'}],
       description:'称王建国'},
      {id:'destroy_title', name:'废黜头衔',
       conditions:['hasHighTitle'],
       cost:{prestige:10},
       effects:[{type:'revoke_title'}],
       description:'废黜某个头衔'}
    ];
  }

  /**
   * 检查决策条件是否满足
   * @returns {{canExecute:boolean, reasons:string[]}}
   */
  function checkConditions(decisionId, actorName) {
    var decision = _getDecisions().find(function(d){return d.id===decisionId;});
    if (!decision) return {canExecute:false, reasons:['决策不存在']};

    var reasons = [];
    (decision.conditions || []).forEach(function(cond) {
      // 简单条件解析
      if (cond === 'noExistingEmperor') {
        var hasEmperor = (GM.chars||[]).some(function(c){return c.alive!==false && c.titles && c.titles.some(function(t){return t.type==='emperor';});});
        if (hasEmperor) reasons.push('已有天子在位');
      }
      if (cond.indexOf('controlRatio>=') === 0) {
        var needed = parseFloat(cond.split('>=')[1]);
        // 简化：检查势力实力占比
        var actor = (GM.facs||[]).find(function(f){return f.name===actorName||f.leader===actorName;});
        var totalStr = 0; (GM.facs||[]).forEach(function(f){totalStr += f.strength||50;});
        var ratio = actor ? (actor.strength||50)/Math.max(totalStr,1) : 0;
        if (ratio < needed) reasons.push('势力占比不足(' + (ratio*100).toFixed(0) + '%<' + (needed*100) + '%)');
      }
      if (cond.indexOf('eraPhase==') === 0) {
        var phase = cond.split('==')[1];
        var cur = GM.eraState ? GM.eraState.dynastyPhase : 'peak';
        // 映射中文
        var phaseMap = {'乱世':'collapse','危世':'decline','治世':'peak'};
        if (phaseMap[phase] && cur !== phaseMap[phase] && cur !== phase) reasons.push('当前非' + phase + '时期');
      }
    });

    return {canExecute: reasons.length === 0, reasons: reasons};
  }

  /**
   * 执行决策
   */
  function execute(decisionId, actorName) {
    var check = checkConditions(decisionId, actorName);
    if (!check.canExecute) return {success:false, reasons:check.reasons};

    var decision = _getDecisions().find(function(d){return d.id===decisionId;});
    // 扣除成本
    if (decision.cost) {
      if (decision.cost.money && P.economyConfig && P.economyConfig.dualTreasury) {
        GM.stateTreasury = (GM.stateTreasury||0) - decision.cost.money;
      }
    }

    // 应用效果
    (decision.effects || []).forEach(function(eff) {
      if (eff.type === 'grant_title' && typeof grantTitle === 'function') {
        grantTitle(actorName, eff.level, 0, true);
      }
      if (eff.type === 'set_era' && GM.eraState) {
        var phaseMap2 = {'治世':'peak','危世':'decline','乱世':'collapse'};
        GM.eraState.dynastyPhase = phaseMap2[eff.phase] || eff.phase;
      }
    });

    addEB('决策', actorName + '执行了"' + decision.name + '"！' + decision.description);
    return {success:true, decision:decision};
  }

  function getPromptInjection() {
    var decs = _getDecisions();
    if (!decs || decs.length === 0) return '';
    var playerName = (P.playerInfo && P.playerInfo.characterName) || '';
    if (!playerName) return '';

    var available = [];
    decs.forEach(function(d) {
      var check = checkConditions(d.id, playerName);
      if (check.canExecute) {
        available.push(d.name + '(威望-' + ((d.cost&&d.cost.prestige)||0) + ')');
      }
    });
    if (available.length === 0) return '';
    return '【可用决策】' + available.join(' | ');
  }

  return { checkConditions:checkConditions, execute:execute, getPromptInjection:getPromptInjection };
})();

// ============================================================
// 注册结算步骤到 SettlementPipeline
// ============================================================
// monthly 步骤：每月子tick执行
SettlementPipeline.register('factions', '势力更新', function(ctx) { updateFactions(ctx.timeRatio); }, 30, 'monthly');
SettlementPipeline.register('parties', '党派更新', function(ctx) { updateParties(ctx.timeRatio); }, 31, 'monthly');
SettlementPipeline.register('classes', '阶层更新', function(ctx) { updateClasses(ctx.timeRatio); }, 32, 'monthly');
SettlementPipeline.register('characters', '角色更新', function(ctx) { updateCharacters(ctx.timeRatio); }, 33, 'monthly');
// daily 步骤：每日子tick执行（军事行动高频更新）
SettlementPipeline.register('military', '军事更新', function(ctx) { updateMilitary(ctx.timeRatio); }, 34, 'daily');
// monthly 步骤
SettlementPipeline.register('map', '地图更新', function(ctx) { updateMap(ctx.timeRatio); }, 35, 'monthly');
SettlementPipeline.register('units', '单位系统', function() { if(typeof updateUnitSystem==='function') updateUnitSystem(); }, 40, 'monthly');
SettlementPipeline.register('supply', '补给系统', function() { if(typeof updateSupplySystem==='function') updateSupplySystem(); }, 41, 'monthly');
SettlementPipeline.register('buildings', '建筑系统', function() { if(typeof updateBuildingSystem==='function') updateBuildingSystem(); }, 42, 'monthly');
SettlementPipeline.register('vassals', '封臣系统', function() { if(typeof updateVassalSystem==='function') updateVassalSystem(); }, 43, 'monthly');
SettlementPipeline.register('titles', '头衔系统', function() { if(typeof updateTitleSystem==='function') updateTitleSystem(); }, 44, 'monthly');
SettlementPipeline.register('adminDivisions', '行政区划', function() { if(typeof updateAdminHierarchy==='function') updateAdminHierarchy(); }, 44.5, 'monthly');
SettlementPipeline.register('mapState', '地图状态', function() { if(typeof updateMapState==='function') updateMapState(); }, 45, 'monthly');

// 生成变化报告（史记第二部分）

// 7.5: Worker管理器
var WorkerPool = (function() {
  var _worker = null;
  var _pending = {};
  var _reqId = 0;
  var _supported = typeof Worker !== 'undefined';

  function _init() {
    if (_worker || !_supported) return;
    try {
      _worker = new Worker('tm-worker.js');
      _worker.onmessage = function(e) {
        var msg = e.data;
        if (msg.requestId && _pending[msg.requestId]) {
          _pending[msg.requestId](msg);
          delete _pending[msg.requestId];
        }
      };
      _worker.onerror = function(e) {
        console.warn('[WorkerPool] error:', e.message);
        _supported = false; // 降级到主线程
      };
    } catch(e) {
      _supported = false;
    }
  }

  return {
    isSupported: function() { return _supported; },

    // 发送计算任务到Worker，返回Promise
    compute: function(taskType, data) {
      return new Promise(function(resolve) {
        if (!_supported) { resolve(null); return; } // 不支持时返回null，主线程自行计算
        _init();
        if (!_worker) { resolve(null); return; }
        var id = 'req_' + (++_reqId);
        data.type = taskType;
        data.requestId = id;
        _pending[id] = function(msg) {
          if (msg.type === 'error') { resolve(null); }
          else { resolve(msg.result); }
        };
        _worker.postMessage(data);
        // 超时保护：3秒内没返回则降级
        setTimeout(function() {
          if (_pending[id]) { delete _pending[id]; resolve(null); }
        }, 3000);
      });
    },

    terminate: function() {
      if (_worker) { _worker.terminate(); _worker = null; }
    }
  };
})();

// 8.2: 填充TM命名空间（tm-utils.js中预留的economy/military子域）
if (typeof TM !== 'undefined') {
  TM.economy = {
    calculateProvinceEconomy: typeof calculateProvinceEconomy === 'function' ? calculateProvinceEconomy : null,
    calculateBuildingOutput: typeof calculateBuildingOutput === 'function' ? calculateBuildingOutput : null,
    applyBuildingEffectsToFaction: typeof applyBuildingEffectsToFaction === 'function' ? applyBuildingEffectsToFaction : null
  };
  TM.military = {
    enhancedResolveBattle: typeof enhancedResolveBattle === 'function' ? enhancedResolveBattle : null,
    calculateSiegeProgress: typeof calculateSiegeProgress === 'function' ? calculateSiegeProgress : null
  };
}
