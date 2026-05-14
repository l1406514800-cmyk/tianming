// ============================================================
// Module: tm-prompt-composer.js
// Domain: AI runtime / sysP 片段复用
// Owns:
//   - 中央化 sysP 通用段 builder·8 builders
//   - buildBase (朝代/剧本/角色/难度/文风)
//   - buildPersonaExtra (sc.persona)
//   - buildBookExtra (剧本书)
//   - buildNarrativeGuide (叙事指引)
//   - buildChronicleStyle (编年体风格)
//   - buildTemporalGranularity (时空粒度)
//   - buildAiPersonaText (NPC 内省·v6 配 batchPersonaMaxLen 截断)
//   - buildRecognitionState (NPC 识别状态)
//   - buildSystemPrefix
//   - buildCommon (汇总入口)
//   - getBatchPersonaMaxLen(sc) reads sc.modelRequirements.batchPersonaMaxLen
// Does not own:
//   - LLM 调度 (tm-ai-infra.js)
//   - prompt 内业务逻辑 (specialty subcalls 各自定义)
//   - sysP 内 schema (各 subcall 仍可加 specialty 段)
// Public API:
//   - TM.PromptComposer.buildBase(ctx)
//   - TM.PromptComposer.buildAiPersonaText(char, options)
//   - TM.PromptComposer.* (全 8 builders + buildCommon)
//   - TM.PromptComposer.getBatchPersonaMaxLen(sc)
// Depends on:
//   - global TM (namespace)
//   - none·pure builder (no DOM·no LLM call)
// Used by:
//   - tm-wendui.js (_wdBuildPrompt)
//   - tm-chaoyi-changchao.js (_cc3_buildSystemPromptStable / buildNpcPrompt·rename Phase 3)
//   - tm-endturn-ai-infer.js (sysP base + systemPrefix + narrative/temporal/chronicle)
//   - tm-tinyi-v3.js (sc18 / NPC decision / char arcs / endturn middle style)
// Tests:
//   - syntax-check (verify-all)
//   - cc3-smoke (covers chaoyi 调用)
// Refactor notes:
//   - Phase 6 系统翻新 我做·v0-v7 evolve
//   - Phase 1·active 唯一 prompt 复用入口·不再新建 prompt builder
//   - Phase 3·考虑增 buildEndturnSystem / buildBattleResolve 等 specialty composer
//   - 见 Desktop/剧本/notes/prompt-composer-v0-spec.md
// ============================================================

(function(global) {
  'use strict';

  var TM = global.TM = global.TM || {};

  function _str(v) { return v == null ? '' : String(v); }

  /**
   * Base sysP·朝代 + 剧本 + 角色 + 难度 + 文风 + gameMode + historicalLimit
   * 多数 specialty subcall 都需要这段
   */
  function buildBase(ctx) {
    ctx = ctx || {};
    var sc = ctx.sc || {};
    var P = ctx.P || {};
    if (P.ai && P.ai.prompt) return P.ai.prompt;
    var s = '你是历史模拟AI。剧本:' + _str(sc.name) +
            '时代:' + _str(sc.era) +
            '角色:' + _str(sc.role) +
            '\n难度:' + _str(P.conf && P.conf.difficulty) +
            '文风:' + _str(P.conf && P.conf.style);
    if (ctx.gameModeDesc) s += ctx.gameModeDesc;
    if (ctx.historicalCharLimit) s += ctx.historicalCharLimit;
    return s;
  }

  /**
   * 玩家附注·P.conf.aiPersona / P.conf.systemPrompt
   * cc3 / 多数 NPC subcall 需要这段
   */
  function buildPersonaExtra(P) {
    P = P || {};
    var v = (P.conf && (P.conf.aiPersona || P.conf.systemPrompt)) || '';
    return v ? '【陛下附注】' + v + '\n' : '';
  }

  /**
   * 剧本本朝特设·sc.chaoyi.systemPromptExtra (剧本可加自定义本朝规约)
   * cc3 (chaoyi) 用·其他 specialty 也可复用
   */
  function buildBookExtra(sc) {
    sc = sc || {};
    var v = sc.chaoyi && sc.chaoyi.systemPromptExtra;
    return v ? '【本朝特设】' + v + '\n' : '';
  }

  /**
   * 叙事风格·按 modeParams.narrativeStyle 选 资治通鉴/半文言/演义
   * + chronicleConfig.styleSample (剧本风格范文)
   * 主 endturn / 多数 specialty 需要
   */
  function buildNarrativeGuide(modeParams, chronicleConfig) {
    modeParams = modeParams || {};
    var s = '';
    var ns = modeParams.narrativeStyle || '';
    if (ns.indexOf('资治通鉴') >= 0) {
      s = '\n【叙事风格·严格文言】仿《资治通鉴》体例。用词典雅·句式简洁。禁用一切现代词汇 (如·OK / 搞定 / 给力)。对话用"曰""言""谓"引述。';
    } else if (ns.indexOf('半文言') >= 0) {
      s = '\n【叙事风格·半文言】融合文言与白话。叙事用文言·对话可用浅显白话。禁用网络用语和明显现代词汇。';
    } else {
      s = '\n【叙事风格·演义体】仿《三国演义》章回体风格。叙事可白话·但保留古典韵味。禁用网络用语。';
    }
    if (chronicleConfig && chronicleConfig.styleSample) {
      s += '\n【风格范文 (参照此文风)】' + chronicleConfig.styleSample;
    }
    return s;
  }

  /**
   * 编年史笔法·biannian/shilu/jizhuan/jishi/biji/custom
   * 主 endturn / specialty 都可复用
   */
  function buildChronicleStyle(chronicleConfig) {
    if (!chronicleConfig || !chronicleConfig.style) return '';
    var styleNames = {
      biannian: '编年体 (仿《资治通鉴》)',
      shilu: '实录体 (仿各朝实录)',
      jizhuan: '纪传体 (仿《史记》)',
      jishi: '纪事本末体 (仿《通鉴纪事本末》)',
      biji: '笔记体 (仿《世说新语》)',
      custom: chronicleConfig.customStyleDesc || '自定义'
    };
    return '\n叙事笔法：' + (styleNames[chronicleConfig.style] || chronicleConfig.style);
  }

  /**
   * 时间粒度·dpv 决定 micro/meso/macro
   * 主 endturn 用·specialty 一般不需 (回合内 subcall 已知粒度)
   */
  function buildTemporalGranularity(dpv) {
    if (dpv === undefined || dpv === null) return '';
    var granLabel = dpv <= 7 ? '微观（日/周）' : dpv <= 60 ? '中观（月）' : '宏观（季/年）';
    var s = '\n\n【时间粒度·每回合' + dpv + '天 (' + granLabel + '叙事)】';
    if (dpv <= 7) {
      s += '\n叙事如"起居注"——精确到日';
      s += '\nNPC 行动描述微观·变量变化幅度小（每回合 ±1~3 为正常）';
    } else if (dpv <= 60) {
      s += '\n叙事如"月报"';
      s += '\nNPC 行动描述中观·概括一段时间内的行为趋势';
    } else {
      s += '\n叙事如"编年史"';
      s += '\nNPC 行动描述宏观·变量变化可较大';
    }
    return s;
  }

  /**
   * NPC.aiPersonaText 注入·specialty NPC subcall (cc3/sc18) 用
   * char 是 GM.chars[i]·若有 aiPersonaText 则注入
   */
function buildAiPersonaText(char, options) {
    options = options || {};
    if (!char || !char.aiPersonaText) return '';
    var text = _str(char.aiPersonaText);
    var maxLen = Number(options.maxLen) || 0;
    if (maxLen > 0 && text.length > maxLen) {
      text = text.slice(0, maxLen) + '...(截断)';
    }
    return '\n【NPC 内省·' + (char.name || '') + '】\n' + text + '\n';
  }

  function getBatchPersonaMaxLen(sc, fallback) {
    var n = fallback == null ? 200 : Number(fallback);
    if (!isFinite(n) || n < 0) n = 200;
    var req = sc && sc.modelRequirements;
    var v = req && Number(req.batchPersonaMaxLen);
    return isFinite(v) && v >= 0 ? v : n;
  }

  /**
   * recognitionState 注入·phase 6 NPC 识别状态
   * char.recognitionState = { subject, familiarity, level, lastTurn, lastEvent, lastEmotion, lastType, lastSource, lastWho, summary, history[] }
   * specialty NPC subcall (cc3/sc18) 按需注入
   */
  function buildRecognitionState(char) {
    if (!char || !char.recognitionState) return '';
    var rs = char.recognitionState;
    var s = '\n【NPC 识别状态·' + (char.name || rs.subject || '') + '】';
    if (rs.level) s += '\n  · 熟识等级·' + rs.level + (rs.familiarity != null ? ' (' + rs.familiarity + ')' : '');
    if (rs.lastTurn) s += '\n  · 上次见·T' + rs.lastTurn + (rs.lastEvent ? '·因' + rs.lastEvent : '');
    if (rs.lastEmotion) s += '\n  · 上次情感·' + rs.lastEmotion;
    if (rs.lastWho) s += '\n  · 上次互动者·' + rs.lastWho;
    if (rs.summary) s += '\n  · 关系摘要·' + rs.summary;
    return s;
  }

  /**
   * promptOverrides.systemPrefix·前置 override
   * 主 endturn / specialty 都可前置·返回字符串供 caller prepend
   */
  function buildSystemPrefix(P) {
    if (!P || !P.promptOverrides || !P.promptOverrides.systemPrefix) return '';
    return P.promptOverrides.systemPrefix;
  }

  /**
   * 一站式·主 endturn 不用 (因有 15+ specialty 段)·specialty subcall 用
   * 组合·base + persona + book + narrativeGuide + chronicleStyle (按需)
   * 不含·temporal granularity / specialty (NPC decisions / char arcs / etc)
   */
  function buildCommon(ctx) {
    ctx = ctx || {};
    var sc = ctx.sc || {};
    var P = ctx.P || {};
    var parts = [];

    var prefix = buildSystemPrefix(P);
    var base = buildBase(ctx);
    if (prefix) {
      parts.push(prefix);
      parts.push(base);
    } else {
      parts.push(base);
    }

    var book = buildBookExtra(sc);
    if (book) parts.push(book);

    var persona = buildPersonaExtra(P);
    if (persona) parts.push(persona);

    var ng = buildNarrativeGuide(ctx.modeParams, P.chronicleConfig);
    if (ng) parts.push(ng);

    var cs = buildChronicleStyle(P.chronicleConfig);
    if (cs) parts.push(cs);

    return parts.filter(function(p) { return p; }).join('\n');
  }

  TM.PromptComposer = {
    buildBase: buildBase,
    buildPersonaExtra: buildPersonaExtra,
    buildBookExtra: buildBookExtra,
    buildNarrativeGuide: buildNarrativeGuide,
    buildChronicleStyle: buildChronicleStyle,
    buildTemporalGranularity: buildTemporalGranularity,
    buildAiPersonaText: buildAiPersonaText,
    getBatchPersonaMaxLen: getBatchPersonaMaxLen,
    buildRecognitionState: buildRecognitionState,
    buildSystemPrefix: buildSystemPrefix,
    buildCommon: buildCommon,
    _version: 'v7'
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TM.PromptComposer;
  }

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
