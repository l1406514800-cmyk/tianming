// @ts-check
/// <reference path="types.d.ts" />
// ═══════════════════════════════════════════════════════════════
// 帑廪/内帑 最终补完 P6
// 依赖：engine + p2 + p4 + p5 + neitang-p2
//
// ⚠ 状态（R116c · 2026-04-24）：**ACCEPTED LAYERING · 暂不合并**
//    此文件是 5 层叠加链的终端。合并策略见下方 R19 原注，但需先补 tick 行为测试。
//
// ⚠ 补丁分类（2026-04-24 R19 评估）：LAYERED（5 层叠加链终端 · GuokuEngine.tick 最终版）
//   · APPEND：calcCustomTaxes
//   · OVERRIDE：GuokuEngine.tick（终版·覆盖 p5）
//   合并策略：若要真合并 guoku 全链 → 以 p6.tick 为 engine.tick 基础·追加 p4/p5 的 APPEND 方法·保留 p2 的 computeTaxFlow
//
// 实现：
//   - 自定义税种支持（GM.fiscalConfig.customTaxes）
//   - transferLimits（maxPerTransfer / maxPerYear）
//   - fixedDeductions（内帑独立扣项）
//   - AI 漕运预警
//   - AI 税种建议
// ═══════════════════════════════════════════════════════════════

(function(global) {
  'use strict';

  if (typeof GuokuEngine === 'undefined') {
    console.warn('[guoku-p6] GuokuEngine 未加载'); return;
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function safe(v, d) { return (v === undefined || v === null) ? (d || 0) : v; }
  function isAIAvailable() {
    return (typeof callAI === 'function') && (typeof P !== 'undefined') && P.ai && P.ai.key;
  }

  // ═════════════════════════════════════════════════════════════
  // 自定义税种
  // P.fiscalConfig.customTaxes = [
  //   { id:'xx', name:'某税', formulaType:'perCapita|flat|percent',
  //     rate:0.05, base:'population'|'land'|'commerce', description }
  // ]
  // ═════════════════════════════════════════════════════════════

  function calcCustomTaxes() {
    var cfg = ((typeof P !== 'undefined' && P.fiscalConfig) || {}).customTaxes;
    if (!Array.isArray(cfg) || cfg.length === 0) return {};
    var results = {};
    cfg.forEach(function(tax) {
      if (!tax.id) return;
      var val = 0;
      var regTotal = safe((GM.hukou || {}).registeredTotal, 1e7);
      try {
        if (tax.formulaType === 'perCapita') {
          val = regTotal * (tax.rate || 0.01);
        } else if (tax.formulaType === 'flat') {
          val = tax.amount || 0;
        } else if (tax.formulaType === 'percent') {
          var baseVal = tax.base === 'commerce' ? regTotal * 0.1 :
                        tax.base === 'land' ? regTotal * 0.05 : regTotal;
          val = baseVal * (tax.rate || 0.01);
        }
      } catch(e) { val = 0; }
      results[tax.id] = { amount: val, name: tax.name || tax.id };
    });
    return results;
  }

  // 将自定义税种累加到帑廪 "qita"（其他）
  var _origQita = GuokuEngine.Sources.qita;
  GuokuEngine.Sources.qita = function() {
    var base = _origQita() || 0;
    var custom = calcCustomTaxes();
    var total = base;
    for (var k in custom) total += custom[k].amount;
    // 记录到全局供 UI 展示
    if (!GM.guoku._customTaxStats) GM.guoku._customTaxStats = {};
    GM.guoku._customTaxStats = custom;
    return total;
  };

  // ═════════════════════════════════════════════════════════════
  // transferLimits (F.9)
  // neicangRules.transferLimits = {
  //   guokuToNeicang: { maxPerTransfer, maxPerYear },
  //   neicangToGuoku: { maxPerTransfer, maxPerYear }
  // }
  // ═════════════════════════════════════════════════════════════

  function _yearKey() {
    return typeof getCurrentYear === 'function' ? getCurrentYear() : Math.floor(GM.turn / 12);
  }

  function _getYearCum(direction) {
    if (!GM.neitang._transferYearCum) GM.neitang._transferYearCum = {};
    var y = _yearKey();
    if (GM.neitang._transferYearCum.year !== y) {
      GM.neitang._transferYearCum = { year: y, guokuToNeicang: 0, neicangToGuoku: 0 };
    }
    return GM.neitang._transferYearCum[direction] || 0;
  }

  function _addYearCum(direction, amount) {
    if (!GM.neitang._transferYearCum) GM.neitang._transferYearCum = {};
    var y = _yearKey();
    if (GM.neitang._transferYearCum.year !== y) {
      GM.neitang._transferYearCum = { year: y, guokuToNeicang: 0, neicangToGuoku: 0 };
    }
    GM.neitang._transferYearCum[direction] = (GM.neitang._transferYearCum[direction] || 0) + amount;
  }

  if (typeof NeitangEngine !== 'undefined' && NeitangEngine.Actions) {
    var _origTransferIn = NeitangEngine.Actions.transferFromGuoku;
    NeitangEngine.Actions.transferFromGuoku = function(amount) {
      var rules = (GM.neitang && GM.neitang.neicangRules) || {};
      var limits = (rules.transferLimits || {}).guokuToNeicang || {};
      if (limits.maxPerTransfer && amount > limits.maxPerTransfer) {
        return { success: false, reason: '单次调拨上限 ' + limits.maxPerTransfer + ' 两' };
      }
      if (limits.maxPerYear) {
        var cum = _getYearCum('guokuToNeicang');
        if (cum + amount > limits.maxPerYear) {
          return { success: false, reason: '年度调拨上限 ' + limits.maxPerYear + ' · 本年已 ' + cum };
        }
      }
      var r = _origTransferIn.call(this, amount);
      if (r.success) _addYearCum('guokuToNeicang', amount);
      return r;
    };

    var _origRescue = NeitangEngine.Actions.rescueGuoku;
    NeitangEngine.Actions.rescueGuoku = function(amount) {
      var rules = (GM.neitang && GM.neitang.neicangRules) || {};
      var limits = (rules.transferLimits || {}).neicangToGuoku || {};
      if (limits.maxPerTransfer && amount > limits.maxPerTransfer) {
        return { success: false, reason: '单次捐输上限 ' + limits.maxPerTransfer + ' 两' };
      }
      if (limits.maxPerYear) {
        var cum = _getYearCum('neicangToGuoku');
        if (cum + amount > limits.maxPerYear) {
          return { success: false, reason: '年度捐输上限 ' + limits.maxPerYear + ' · 本年已 ' + cum };
        }
      }
      var r = _origRescue.call(this, amount);
      if (r.success) _addYearCum('neicangToGuoku', amount);
      return r;
    };
  }

  // ═════════════════════════════════════════════════════════════
  // fixedDeductions (F.10 独立扣项)
  // neicangRules.fixedDeductions = [
  //   { id, name, amount, cadence:'monthly|annual', account:'guoku'|'neicang', destination }
  // ]
  // ═════════════════════════════════════════════════════════════

  function processFixedDeductions(mr) {
    if (!GM.neitang || !GM.neitang.neicangRules) return;
    var deds = GM.neitang.neicangRules.fixedDeductions;
    if (!Array.isArray(deds) || deds.length === 0) return;
    deds.forEach(function(d) {
      var amt = 0;
      if (d.cadence === 'monthly') amt = (d.amount || 0) * mr;
      else if (d.cadence === 'annual') amt = (d.amount || 0) * mr / 12;
      if (amt <= 0) return;

      var fromAcc = d.account === 'neicang' ? 'neitang' : 'guoku';
      var toAcc = d.destination === 'neicang' ? 'neitang' :
                  d.destination === 'guoku' ? 'guoku' : null;

      if (fromAcc === 'neitang' && GM.neitang) GM.neitang.balance -= amt;
      if (fromAcc === 'guoku' && GM.guoku) GM.guoku.balance -= amt;
      if (toAcc === 'neitang' && GM.neitang) GM.neitang.balance += amt;
      if (toAcc === 'guoku' && GM.guoku) GM.guoku.balance += amt;
      // 若无 destination 则为纯消费
    });
  }

  // 接入 tick
  var _origGuokuTick = GuokuEngine.tick;
  GuokuEngine.tick = function(context) {
    _origGuokuTick.call(this, context);
    var mr = (context && context._monthRatio) ||
             (GuokuEngine.getMonthRatio ? GuokuEngine.getMonthRatio() : 1);
    try { processFixedDeductions(mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'guoku-p6] fixedDed:') : console.error('[guoku-p6] fixedDed:', e); }
  };

  // ═════════════════════════════════════════════════════════════
  // AI 漕运预警
  // ═════════════════════════════════════════════════════════════

  async function aiCaoyunWarning() {
    var lossRate = GuokuEngine.calcCaoyunLossRate();
    var stats = (GM.guoku && GM.guoku._caoyunStats) || {};
    if (lossRate < 0.15) {
      return { available: false, analysis: '漕运损耗正常，未有预警。' };
    }

    if (!isAIAvailable()) {
      return { available: false, analysis: _ruleCaoyunWarning(lossRate) };
    }

    var fc = safe((GM.corruption && GM.corruption.subDepts.fiscal || {}).true, 0);
    var pc = safe((GM.corruption && GM.corruption.subDepts.provincial || {}).true, 0);
    var hasCaoyunCabal = ((GM.corruption && GM.corruption.entrenchedFactions) || [])
      .some(function(f) { return (f.name||'').indexOf('漕') !== -1; });

    var prompt = '你扮演漕运总督，奏疏体（150 字内）为陛下预警漕运危机：\n' +
      '- 漕运损耗率 ' + Math.round(lossRate*100) + '%\n' +
      '- 税司腐败 ' + Math.round(fc) + '，地方腐败 ' + Math.round(pc) + '\n' +
      '- 漕帮党：' + (hasCaoyunCabal ? '已成气候' : '未现') + '\n' +
      '- 名义岁漕 ' + Math.round(stats.nominal||0) + ' 两，实入 ' + Math.round(stats.actual||0) + ' 两\n\n' +
      '请分析风险（漕船沉没/漕丁哗变/漕帮把持）并建言。直接输出奏疏。';

    try {
      var text = await callAI(prompt, 400);
      return { available: true, analysis: (text || '').trim() };
    } catch(e) {
      return { available: false, analysis: _ruleCaoyunWarning(lossRate), error: e.message };
    }
  }

  function _ruleCaoyunWarning(lossRate) {
    var lines = ['【断言】漕运损耗 ' + Math.round(lossRate*100) + '%，'];
    lines[0] += lossRate > 0.4 ? '危在旦夕。' :
                lossRate > 0.25 ? '颓势明显。' : '尚可维持。';
    var reasons = [];
    var fc = safe((GM.corruption && GM.corruption.subDepts.fiscal || {}).true, 0);
    var pc = safe((GM.corruption && GM.corruption.subDepts.provincial || {}).true, 0);
    if (fc > 50) reasons.push('税司贪墨 ' + Math.round(fc));
    if (pc > 50) reasons.push('地方苛征 ' + Math.round(pc));
    var hasCabal = ((GM.corruption && GM.corruption.entrenchedFactions) || [])
      .some(function(f) { return (f.name||'').indexOf('漕') !== -1; });
    if (hasCabal) reasons.push('漕帮党盘踞');
    if (reasons.length > 0) lines.push('【源】' + reasons.join('；'));

    var actions = [];
    if (fc > 50 || pc > 50) actions.push('派钦差稽查漕线');
    if (hasCabal) actions.push('肃贪运动清漕帮');
    actions.push('新铸"漕帑"印钞监督损耗');
    lines.push('【臣请】' + actions.join('；'));

    return lines.join('\n\n');
  }

  // ═════════════════════════════════════════════════════════════
  // AI 税种建议
  // ═════════════════════════════════════════════════════════════

  async function aiTaxAdvisor() {
    var analysis;
    if (!isAIAvailable()) {
      return { available: false, analysis: _ruleTaxAdvisor() };
    }

    var g = GM.guoku || {};
    var sources = g.sources || {};
    var srcLines = [];
    var srcLabels = { tianfu:'田赋', dingshui:'丁税', caoliang:'漕粮',
      yanlizhuan:'专卖', shipaiShui:'市舶', quanShui:'榷税', juanNa:'捐纳', qita:'其他' };
    for (var k in sources) {
      srcLines.push((srcLabels[k]||k) + ' ' + Math.round(sources[k]||0));
    }

    var prompt = '你扮演户部左侍郎，奏疏体（200 字内）为陛下分析税种结构并建议：\n' +
      '- 本岁各税：' + srcLines.join('，') + '\n' +
      '- 民心 ' + Math.round((GM.minxin||{}).trueIndex || 50) + '，粮价 ' + (((GM.prices||{}).grain)||1).toFixed(2) + '倍\n' +
      '- 改革：' + (((g.completedReforms||[]).length ? '已' : '未') + '行大改') + '\n\n' +
      '请指出当今税制弊端（如税种单一/重农轻商/丁税过重等），并建议增减/改革。直接输出奏疏。';

    try {
      var text = await callAI(prompt, 500);
      return { available: true, analysis: (text || '').trim() };
    } catch(e) {
      return { available: false, analysis: _ruleTaxAdvisor(), error: e.message };
    }
  }

  function _ruleTaxAdvisor() {
    var g = GM.guoku || {};
    var sources = g.sources || {};
    var lines = [];
    var total = 0;
    for (var k in sources) total += (sources[k]||0);

    // 分析各税占比
    if (total > 0) {
      var tianfuPct = (sources.tianfu||0) / total;
      var dingPct = (sources.dingshui||0) / total;
      var yanPct = (sources.yanlizhuan||0) / total;
      var juanPct = (sources.juanNa||0) / total;

      var notes = [];
      if (tianfuPct > 0.6) notes.push('田赋占 ' + Math.round(tianfuPct*100) + '%，过重农于民');
      if (dingPct > 0.1) notes.push('丁税 ' + Math.round(dingPct*100) + '%，压贫厚富');
      if (yanPct < 0.08 && !((typeof P!=='undefined') && P.fiscalConfig && P.fiscalConfig.taxesEnabled && P.fiscalConfig.taxesEnabled.yanlizhuan === false)) notes.push('盐铁专卖未尽其利');
      if (juanPct > 0.15) notes.push('捐纳 ' + Math.round(juanPct*100) + '%，官源弊端');
      if ((sources.shipaiShui||0) === 0) notes.push('市舶未开，失海外之利');

      if (notes.length > 0) lines.push('【臣议】' + notes.join('；'));
    }

    var actions = [];
    if ((sources.dingshui||0) / Math.max(1,total) > 0.08 && !(g.completedReforms||[]).includes('tanDingRuMu')) {
      actions.push('推摊丁入亩以废丁税');
    }
    if ((sources.dingshui||0) > 0 && !(g.completedReforms||[]).includes('oneWhip')) {
      actions.push('行一条鞭合并征银');
    }
    if ((sources.shipaiShui||0) === 0 && !(g.completedReforms||[]).includes('twoTax')) {
      actions.push('开海市舶以博商利');
    }
    if (actions.length > 0) lines.push('【建言】' + actions.join('；'));
    else lines.push('【建言】税制渐成，徐图之。');

    return lines.join('\n\n');
  }

  // ═════════════════════════════════════════════════════════════
  // 导出
  // ═════════════════════════════════════════════════════════════

  GuokuEngine.calcCustomTaxes = calcCustomTaxes;
  GuokuEngine.aiCaoyunWarning = aiCaoyunWarning;
  GuokuEngine.aiTaxAdvisor = aiTaxAdvisor;
  GuokuEngine.processFixedDeductions = processFixedDeductions;

  console.log('[guoku-p6] 最终补完：自定义税种 + transferLimits + fixedDeductions + AI 漕运预警 + AI 税种建议');

})(typeof window !== 'undefined' ? window : this);
