/**
 * tm-phase-f1-fixes.js — F 阶段 ①：快速修正
 *
 * ⚠ 状态（R116b · 2026-04-24）：**ACCEPTED LAYERING · 暂不合并**
 *    此文件是有意识的 monkey-patch 分层（OVERRIDE AuthorityEngines.tick +
 *    PhaseD.COUNTER_STRATEGIES.rotate_officials）。R26 评估合并工时 15-25h 且必须先
 *    写 10 个 AuthorityEngines.tick 用例 + 行为快照作前置。合并前保留为独立文件是
 *    审慎决定，不是债务。合并 checklist 见下方 R26 原注。
 *
 * ⚠ 补丁分类（2026-04-24 R26 评估）：LAYERED（真 monkey patch）
 *   · APPEND：PhaseF1.init/tick
 *   · OVERRIDE：
 *       · AuthorityEngines.tick（替换 tm-authority-engines.js 的简化版 updatePerceived）
 *       · PhaseD.COUNTER_STRATEGIES.rotate_officials（改权臣反击策略的衰减算法）
 *   · 覆盖链（认识清楚）：
 *       authority-engines.tick v1 → f1-fixes.tick v2（五段粉饰+党羽轮换+三段皇权）
 *   · 合并前必需：
 *       - AuthorityEngines.tick 路径的 smoke test（10 个用例 · 五段粉饰 × 两段党羽）
 *       - PhaseD.COUNTER_STRATEGIES 的行为快照（给原策略和新策略都写 fixture 对比）
 *   · 合并工时估算：15-25h
 *   · 合并策略：
 *       - F1 的 _updatePerceivedHuangwei_full 整段替换 authority-engines 内对应函数
 *       - PhaseD.COUNTER_STRATEGIES.rotate_officials 直接修改 phase-d 源（phase-d 也不是 SELF，此改动相依）
 *
 * 补完：
 *  - D 粉饰度五段位完整修正（暴君/威严/常望/衰微/失威 分别感知调整）
 *  - 党羽"轮换削弱"具体衰减算法
 *  - 皇权三段统一处理器（专制/制衡/权臣）
 *  - B 户口 phase-b 运行时调用：徭役民变/迁徙/年龄金字塔/疫病/作物/税基流失 已接入 endturn，此处补细节
 *  - 诏书五要素接入编辑器实时检查
 */
(function(global) {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════
  //  D · 粉饰度五段位完整修正（替换 tm-authority-engines.js 中简化版）
  // ═══════════════════════════════════════════════════════════════════

  function _updatePerceivedHuangwei_full(hw) {
    var t = hw.index;
    // 地方粉饰度 = 当前执行层主官（简化：默认全国）
    var corruptMult = 1;
    var G = global.GM;
    if (G && G.corruption && typeof G.corruption === 'object') {
      var corr = G.corruption.overall || 0;
      corruptMult = 1 + corr / 200;  // 腐败 60 → 粉饰 ×1.3
    }
    // 五段分别处理
    if (t >= 90) {
      // 暴君：奏疏 90% 颂圣，perceived 高估
      hw.perceivedIndex = Math.min(100, t + 8 * corruptMult);
    } else if (t >= 70) {
      // 威严：基本真实，轻微粉饰
      hw.perceivedIndex = Math.min(100, t + 2 * corruptMult);
    } else if (t >= 50) {
      // 常望：中等粉饰，低风险段
      hw.perceivedIndex = Math.min(100, t + 3 * corruptMult);
    } else if (t >= 30) {
      // 衰微：粉饰愈急，perceived 被地方官抬升
      hw.perceivedIndex = Math.min(100, t + 6 * corruptMult);
    } else {
      // 失威：抗疏公然，粉饰亦无人理，perceived 接近真实
      hw.perceivedIndex = Math.max(0, t + Math.min(4, corruptMult * 2));
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  D · 党羽轮换衰减算法（修正 tm-phase-d-patches.js 中 rotate_officials）
  // ═══════════════════════════════════════════════════════════════════

  /** 每轮换一人，权臣的 factional_power 按公式衰减 */
  function rotateOfficialsWithDecay(pmName) {
    var G = global.GM;
    if (!G.huangquan || !G.huangquan.powerMinister) return { ok: false };
    var pm = G.huangquan.powerMinister;
    if (pm.name !== pmName) return { ok: false };
    var oldCtrl = pm.controlLevel || 0.3;
    var faction = pm.faction || [];
    if (faction.length === 0) return { ok: true, rotated: 0, note: '党羽已无' };
    // 核心党羽（留京高官）优先外调
    var coreAllies = [];
    var peripheralAllies = [];
    faction.forEach(function(name) {
      var c = (G.chars || []).find(function(x){return x.name===name;});
      if (!c) return;
      var rank = c.rank || 5;
      if (rank <= 3) coreAllies.push(name);
      else peripheralAllies.push(name);
    });
    // 每次外调 2 人核心 + 3 人外围
    var rotatedCore = coreAllies.slice(0, 2);
    var rotatedPeri = peripheralAllies.slice(0, 3);
    var totalRotated = rotatedCore.length + rotatedPeri.length;
    // 衰减：核心 -0.12/个，外围 -0.04/个
    var decay = rotatedCore.length * 0.12 + rotatedPeri.length * 0.04;
    pm.controlLevel = Math.max(0, oldCtrl - decay);
    // 更新 faction
    var rotatedSet = {};
    rotatedCore.concat(rotatedPeri).forEach(function(n){rotatedSet[n]=true;});
    pm.faction = faction.filter(function(n){return !rotatedSet[n];});
    // 被轮换官员：officialTitle 加"(外调)"
    pm.faction.forEach(function(){}); // noop
    rotatedCore.concat(rotatedPeri).forEach(function(name) {
      var c = (G.chars || []).find(function(x){return x.name===name;});
      if (c) {
        c.officialTitle = (c.officialTitle || '') + '(外调)';
        c._rotatedOut = true;
        c._tenureMonths = 0;
      }
    });
    if (global.addEB) global.addEB('轮换', '外调 ' + pmName + ' 之党羽 ' + totalRotated + ' 人（控制力 -' + decay.toFixed(2) + '）');
    return { ok: true, rotated: totalRotated, decay: decay };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  皇权三段统一处理器（解决逻辑分散问题）
  // ═══════════════════════════════════════════════════════════════════

  function getUnifiedHuangquanPhaseHandler() {
    var G = global.GM;
    if (!G.huangquan) return null;
    var idx = G.huangquan.index || 55;
    if (idx >= 70) return {
      phase: 'absolute',
      name: '专制段',
      // 专制段行为
      decreeMode: 'fiveElementsStrict',  // 五要素硬性检查
      ministerBehavior: 'obedient',       // 大臣顺服
      aiObjectionRate: 0.1,
      memorialFilterActive: false,
      executionMult: 1.2,
      description: '皇权在上，纲纪严明；五要素不全则圣裁补全'
    };
    if (idx >= 35) return {
      phase: 'balanced',
      name: '制衡段',
      decreeMode: 'ministerAmplify',     // 大臣补全
      ministerBehavior: 'proactive',     // 大臣主动
      aiObjectionRate: 0.25,
      memorialFilterActive: false,
      executionMult: 1.0,
      description: '上下协力，大臣补全诏命细节'
    };
    return {
      phase: 'minister',
      name: '权臣段',
      decreeMode: 'ministerIntercept',    // 权臣拦截
      ministerBehavior: 'intercept',
      aiObjectionRate: 0.5,
      memorialFilterActive: true,
      executionMult: 0.5,
      description: '权臣坐大，诏命被阻或篡改'
    };
  }

  /** 专制段诏书五要素检查（编辑器实时调用） */
  function checkDecreeRealtime(text) {
    var handler = getUnifiedHuangquanPhaseHandler();
    if (!handler) return { ok: true };
    if (handler.decreeMode !== 'fiveElementsStrict') {
      // 非专制段，不强制检查
      return { ok: true, mode: handler.decreeMode, suggest: 'AI 将按朝代惯例补全' };
    }
    // 五要素
    var elements = {
      time:  /(春|夏|秋|冬|月|日|岁|限|期|即日|立|年底|半年)/,
      place: /(京|省|府|县|道|路|州|全国|天下|边|畿|江南|河北|中原)/,
      who:   /(尚书|侍郎|令|丞|御史|将军|总督|巡抚|知|提督|宣抚|节度|刺史)/,
      money: /(帑|银|钱|粮|布|万|石|支|拨|出|自.*出|由.*支)/,
      audit: /(限|考|核|验|察|赏|罚|功|过|黜陟|迁)/
    };
    var missing = [];
    Object.keys(elements).forEach(function(k) {
      if (!elements[k].test(text)) missing.push({ time:'时日', place:'地点', who:'执行人', money:'经费', audit:'考核' }[k]);
    });
    return {
      ok: missing.length === 0,
      mode: 'fiveElementsStrict',
      missing: missing,
      phase: handler.name,
      suggest: missing.length > 0 ? ('陛下此诏，尚缺 ' + missing.join('、') + '，请圣裁。') : '五要素具备，可即下。'
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  补丁挂载：修正 tm-authority-engines.js 的 _updatePerceivedHuangwei
  // ═══════════════════════════════════════════════════════════════════

  function patch_authority_engines() {
    if (global._f1_patched) return;
    global._f1_patched = true;
    // 猴补 updatePerceivedHuangwei
    if (typeof global.AuthorityEngines !== 'undefined') {
      global.AuthorityEngines._updatePerceivedHuangwei_f1 = _updatePerceivedHuangwei_full;
      // 在 tick 中调用一次修正 perceived
      var origTick = global.AuthorityEngines.tick;
      global.AuthorityEngines.tick = function(ctx) {
        var r = origTick.call(global.AuthorityEngines, ctx);
        try {
          var G = global.GM;
          if (G.huangwei && typeof G.huangwei === 'object') {
            _updatePerceivedHuangwei_full(G.huangwei);
          }
        } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'f1] perceived:') : console.error('[f1] perceived:', e); }
        return r;
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  导出
  // ═══════════════════════════════════════════════════════════════════

  function tick(ctx) {
    // 无需持续 tick（主要是补丁）
  }

  function init() {
    patch_authority_engines();
    // 修正 PhaseD 的 rotate_officials
    if (typeof global.PhaseD !== 'undefined' && global.PhaseD.COUNTER_STRATEGIES) {
      var rot = global.PhaseD.COUNTER_STRATEGIES.rotate_officials;
      if (rot) {
        rot.effect = function(G) {
          var pm = G.huangquan && G.huangquan.powerMinister;
          if (!pm) return { ok: false };
          return rotateOfficialsWithDecay(pm.name);
        };
      }
    }
  }

  global.PhaseF1 = {
    init: init,
    tick: tick,
    updatePerceivedHuangwei: _updatePerceivedHuangwei_full,
    rotateOfficialsWithDecay: rotateOfficialsWithDecay,
    getUnifiedHuangquanPhaseHandler: getUnifiedHuangquanPhaseHandler,
    checkDecreeRealtime: checkDecreeRealtime,
    VERSION: 1
  };

  global.checkDecreeRealtime = checkDecreeRealtime;

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
