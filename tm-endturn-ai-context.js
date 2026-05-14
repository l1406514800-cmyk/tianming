// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// Module: tm-endturn-ai-context.js
// Domain: EndTurn / AI prompt context
// Owns:
//   - End-turn sysP policy/context injections for factions, parties, armies,
//     NPC plans, office appointment rules, output-safety rules, AI plans,
//     and faction matrix summaries.
// Does not own:
//   - Base sysP/narrative/chronicle builders (tm-prompt-composer.js)
//   - LLM dispatch/retry/cache (tm-ai-infra.js)
//   - sc1 writeback or post-call orchestration (tm-endturn-ai-infer.js)
// Public API:
//   - TM.EndTurnAIContext.appendPromptPolicyContext(sysP, ctx)
// Depends on:
//   - global GM/P/TM
//   - optional buildNpcDecisionsForSysP/buildEdictEfficacyFollowUp/buildCharArcsForSysP
// Used by:
//   - tm-endturn-ai-infer.js Region 1
// Tests:
//   - syntax-check / verify-all
// Refactor notes:
//   - Phase 3 R7 Codex slice: first small Region 1 extraction.
// ============================================================

(function(global) {
  'use strict';

  var TM = global.TM = global.TM || {};
  TM.EndTurnAIContext = TM.EndTurnAIContext || {};

  function _capture(err, label) {
    try {
      if (TM && TM.errors && typeof TM.errors.capture === 'function') {
        TM.errors.capture(err, label);
        return;
      }
    } catch (_) {}
    try { console.warn('[' + label + ']', err); } catch (_) {}
  }

  function _slice(v, n) {
    return String(v == null ? '' : v).slice(0, n || 120);
  }

  function appendPromptPolicyContext(sysP, ctx) {
    ctx = ctx || {};
    var GM = ctx.GM || global.GM || {};

    try {
      var stateLines = [];
      if (Array.isArray(GM.facs) && GM.facs.length > 0) {
        stateLines.push('【势力运行时态】');
        GM.facs.forEach(function(f) {
          if (!f || !f.name) return;
          var line = '  - ' + f.name +
            ' 阶段=' + (f.lifePhase || 'stable') +
            ' 实力=' + (f.strength || 0) +
            ' 合法性=' + (f.legitimacy || 0) +
            ' 人口=' + (f.population || 0) +
            ' 民心=' + (f.morale || 0) +
            ' 稳定=' + (f.stability || 0);
          if (f._collapsing) line += ' 【濒临崩溃】';
          if (f.suzerainFaction) line += ' 宗主=' + f.suzerainFaction;
          stateLines.push(line);
        });
      }
      if (GM.partyState && typeof GM.partyState === 'object') {
        stateLines.push('【党派数值】');
        Object.keys(GM.partyState).forEach(function(pn) {
          var ps = GM.partyState[pn];
          if (!ps) return;
          stateLines.push('  - ' + pn +
            ' 影响=' + (ps.influence || 0) +
            ' 凝聚=' + (ps.cohesion || 0) +
            ' 占官=' + (ps.officeCount || 0) +
            ' 清誉=' + (ps.reputationBalance || 0) +
            ((ps.recentImpeachWin || 0) > 0 ? ' 近期弹劾胜=' + Math.round(ps.recentImpeachWin) : '') +
            ((ps.recentImpeachLose || 0) > 0 ? ' 近期弹劾败=' + Math.round(ps.recentImpeachLose) : ''));
        });
      }
      if (Array.isArray(GM.armies) && GM.armies.length > 0) {
        var riskArmies = GM.armies.filter(function(a) {
          return (a.mutinyRisk || 0) >= 50 ||
            (a.supply || 100) < 30 ||
            (a.morale || 100) < 30 ||
            (a.payArrearsMonths || 0) >= 2;
        });
        if (riskArmies.length > 0) {
          stateLines.push('【军情警报】');
          riskArmies.slice(0, 8).forEach(function(a) {
            stateLines.push('  - ' + (a.name || '?') +
              ' 驻=' + (a.garrison || '') +
              (a.state === 'marching' ? ' 赴=' + (a.destination || '') : '') +
              (a.state === 'sieging' ? ' 围城中' : '') +
              ' 粮=' + (a.supply || 0) +
              ' 士气=' + (a.morale || 0) +
              ' 欠饷=' + (a.payArrearsMonths || 0) + '月' +
              ' 兵变险=' + (a.mutinyRisk || 0));
          });
        }
      }
      if (stateLines.length > 0) {
        sysP += '\n\n' + stateLines.join('\n');
        sysP += '\n规则：推演时必须按上述数值展开；势力 lifePhase 决定基调；党派 influence 决定话语权；兵变险 >= 60 必生事件。';
      }
    } catch (err) {
      _capture(err, 'endturn-ai-context.runtime-state');
    }

    try {
      var buildNpcDecisionsForSysP = ctx.buildNpcDecisionsForSysP || global.buildNpcDecisionsForSysP;
      if (typeof buildNpcDecisionsForSysP === 'function') {
        var npcBlock = buildNpcDecisionsForSysP();
        if (npcBlock) {
          sysP += npcBlock;
          sysP += '\n规则：NPC 预规划条目必须按 rationale 展开，不得背离 NPC 已设定动机。';
        }
      }
    } catch (err2) {
      _capture(err2, 'endturn-ai-context.npc-plan');
    }

    sysP += '\n\n【官员任免链则·AI 必守】';
    sysP += '\n1. 推演中的升迁、免职、夺职、调任、新任，必须通过 personnelChanges 输出，字段含 {name, change, fromPost, toPost}。';
    sysP += '\n2. 不得在 shizhengji/zhengwen 中擅称某人为某官，除非 officeTree 已同步换旧任与新任。';
    sysP += '\n3. 同一官职只能有一位正职 holder；换任时要记录前任离任和新任上任。';
    sysP += '\n4. 玩家未颁任免诏令时，AI 不得无前提创造新任命，除非存在空缺、死亡等明确条件。';
    sysP += '\n5. 叙事任命若未通过 personnelChanges 同步，视为推演错误。';

    sysP += '\n\n【输出纯文本链则】';
    sysP += '\n所有叙事字段必须为纯中文文本，不得输出 HTML 标签、onclick、javascript:、URL 或 Markdown 链接。';
    sysP += '\n遇到参考文本中含 HTML 时，原样输出前必须剥离 HTML，只保留中文。';

    try {
      var buildEdictEfficacyFollowUp = ctx.buildEdictEfficacyFollowUp || global.buildEdictEfficacyFollowUp;
      if (typeof buildEdictEfficacyFollowUp === 'function') {
        var edictBlock = buildEdictEfficacyFollowUp();
        if (edictBlock) sysP += edictBlock;
      }
    } catch (err3) {
      _capture(err3, 'endturn-ai-context.edict-followup');
    }

    try {
      var buildCharArcsForSysP = ctx.buildCharArcsForSysP || global.buildCharArcsForSysP;
      if (typeof buildCharArcsForSysP === 'function') {
        var arcBlock = buildCharArcsForSysP();
        if (arcBlock) sysP += arcBlock;
      }
    } catch (err4) {
      _capture(err4, 'endturn-ai-context.char-arcs');
    }

    try {
      var plan = GM._aiInferencePlan;
      if (plan && plan.generatedAt) {
        if (plan.npcHiddenAgenda && Object.keys(plan.npcHiddenAgenda).length > 0) {
          sysP += '\n\n【NPC 隐藏议程】AI 推演 NPC 行为时必须参考，而非只按官职教条推理。';
          Object.keys(plan.npcHiddenAgenda).forEach(function(name) {
            sysP += '\n  - ' + name + ': ' + _slice(plan.npcHiddenAgenda[name], 120);
          });
        }
        if (Array.isArray(plan.crisisBranches) && plan.crisisBranches.length > 0) {
          sysP += '\n\n【危机分岔·剧本可能走向】不要一次演完所有，按玩家实际诏令择路展开。';
          plan.crisisBranches.forEach(function(branch) {
            sysP += '\n  - ' + _slice(branch, 150);
          });
        }
        if (Array.isArray(plan.tippingPoints) && plan.tippingPoints.length > 0) {
          sysP += '\n\n【不可逆临界点】';
          plan.tippingPoints.forEach(function(t) {
            sysP += '\n  - ' + _slice(t, 120);
          });
        }
        if (plan.narrativeTone) {
          var tone = plan.narrativeTone;
          if (tone.sentenceStyle) sysP += '\n\n【行文指令·句式】' + _slice(tone.sentenceStyle, 80);
          if (Array.isArray(tone.vocabulary) && tone.vocabulary.length > 0) sysP += '\n【典型词汇】' + tone.vocabulary.slice(0, 8).join('、');
          if (tone.pacing) sysP += '\n【节奏】' + _slice(tone.pacing, 80);
        }
        if ((GM.turn || 0) <= 2 && plan.npcFirstTurnReaction && Object.keys(plan.npcFirstTurnReaction).length > 0) {
          sysP += '\n\n【首回合 NPC 候选反应·参考】';
          Object.keys(plan.npcFirstTurnReaction).slice(0, 15).forEach(function(name2) {
            sysP += '\n  - ' + name2 + ': ' + _slice(plan.npcFirstTurnReaction[name2], 80);
          });
        }
      }
    } catch (err5) {
      _capture(err5, 'endturn-ai-context.inference-plan');
    }

    try {
      var fm = GM._aiFactionMatrix;
      if (fm && fm.generatedAt) {
        if (Array.isArray(fm.factionMatrix) && fm.factionMatrix.length > 0) {
          sysP += '\n\n【势力关系矩阵】AI 必须按此演绎势力互动，不得凭空突变。';
          fm.factionMatrix.slice(0, 10).forEach(function(m) {
            if (!m || !m.facA || !m.facB) return;
            sysP += '\n  - ' + m.facA + ' -> ' + m.facB + ': ' + (m.currentRelation || '') +
              '；10回合走向=' + _slice(m.trajectoryNext10Turns, 100);
            if (Array.isArray(m.triggersToEscalate) && m.triggersToEscalate.length > 0) {
              sysP += '；升级条件=' + m.triggersToEscalate.slice(0, 2).join('/');
            }
            if (Array.isArray(m.triggersToReconcile) && m.triggersToReconcile.length > 0) {
              sysP += '；和解条件=' + m.triggersToReconcile.slice(0, 2).join('/');
            }
          });
        }
        if (Array.isArray(fm.alliancePotentials) && fm.alliancePotentials.length > 0) {
          sysP += '\n【结盟潜力】' + fm.alliancePotentials.slice(0, 4).join(' | ');
        }
        if (Array.isArray(fm.strategicTriangles) && fm.strategicTriangles.length > 0) {
          sysP += '\n【三角博弈】' + fm.strategicTriangles.slice(0, 3).join(' | ');
        }
        if ((GM.turn || 0) <= 5 && Array.isArray(fm.blackSwans) && fm.blackSwans.length > 0) {
          sysP += '\n【势力黑天鹅·前5回合参考】' + fm.blackSwans.slice(0, 5).join(' | ');
        }
      }
    } catch (err6) {
      _capture(err6, 'endturn-ai-context.faction-matrix');
    }

    return sysP;
  }

  TM.EndTurnAIContext.appendPromptPolicyContext = appendPromptPolicyContext;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TM.EndTurnAIContext;
  }
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
