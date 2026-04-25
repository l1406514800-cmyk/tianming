/**
 * tm-phase-c-patches.js — C 阶段补丁（制度+环境）
 *
 * ⚠ 状态（R116b · 2026-04-24）：**ACCEPTED LAYERING · 暂不合并**
 *    此文件是有意识的 monkey-patch 分层（OVERRIDE EdictParser.processImperialAssent
 *    + EdictParser.tick）。R26 评估合并工时 10-20h 且必须先写 5-8 个 edict-parser
 *    smoke 用例作为前置。在那些前置完成之前保留为独立文件是审慎决定，不是债务。
 *    合并 checklist 见下方 R26 原注。
 *
 * ⚠ 补丁分类（2026-04-24 R26 评估）：LAYERED（真 monkey patch）
 *   · APPEND：PhaseC.init/tick + EdictComplete.openClarificationPanel + QUERY_QUICK_OPTIONS
 *   · OVERRIDE：EdictParser.processImperialAssent（覆盖 edict-complete 原版）
 *               EdictParser.tick（追加 C3 动态机构 + C4 环保 keywords 处理）
 *   · 合并前必需：
 *       - 先写 edict-parser.tick/processImperialAssent 路径 smoke test（5-8 个用例）
 *       - 标注 override 版本相对原版的差异点
 *   · 合并工时估算：10-20h
 *   · 合并后文件名候选：tm-edict-clarification.js（侍臣问疑）+ inline 其余 override
 *
 * 补完：
 *  C1 侍臣问疑 UI（7 快捷选项 + 自填 + 让有司揣摩 + 不予作答）
 *  C2 朱批扩展 7 选项（准/改/圈选/试点/驳/再议/查）+ AI 上下文草稿
 *  C3 动态机构 GM.dynamicInstitutions + 官制二阶段 Phase II
 *  C4 环保 POLICY_KEYWORDS regex 识别
 *  C5 环保 × 权力变量 运行时联动 verify（依靠 tm-env-recovery-fill.js 已有）
 */
(function(global) {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════
  //  C1 · 侍臣问疑 UI
  // ═══════════════════════════════════════════════════════════════════

  var QUERY_QUICK_OPTIONS = [
    { id:'admin',    label:'吏治 · 整顿官场',  route:'integrity', fill:'整顿吏治，清查墨吏' },
    { id:'civil',    label:'民生 · 赈济教化',  route:'welfare',   fill:'赈济灾民，劝农桑' },
    { id:'fiscal',   label:'财政 · 税赋徭役',  route:'tax_reform',fill:'议税法徭役，宽民力' },
    { id:'frontier', label:'边防 · 御敌守疆',  route:'military',  fill:'整饬边备，强边军' },
    { id:'water',    label:'水利 · 治河疏渠',  route:'public_works',fill:'兴水利，疏浚河道' },
    { id:'military', label:'军政 · 兵制武备',  route:'military_reform',fill:'议兵制，明武备' },
    { id:'judicial', label:'刑狱 · 司法清明',  route:'legal',     fill:'清理狱讼，平冤抑' }
  ];

  function openClarificationPanel(clarId) {
    var G = global.GM;
    if (!G._pendingClarifications) return;
    var clar = clarId ? G._pendingClarifications.find(function(c){return c.id===clarId;}) : G._pendingClarifications.filter(function(c){return c.status==='awaiting_answer';})[0];
    if (!clar) {
      if (global.toast) global.toast('无待答问疑');
      return;
    }
    var body = '<div style="max-width:540px;font-family:inherit;">';
    body += '<div style="font-size:1.0rem;color:var(--gold-300);margin-bottom:0.4rem;letter-spacing:0.1em;">🤵 臣愚钝，斗胆请示</div>';
    body += '<div style="font-size:0.78rem;color:var(--ink-300);padding:8px 10px;background:var(--bg-2);border-radius:4px;margin-bottom:0.8rem;font-style:italic;">';
    body += '陛下所谕"' + _escapeHtml((clar.originalText||'').slice(0,80)) + '"——' + (clar.questions && clar.questions[0] ? '<br>' + _escapeHtml(clar.questions[0]) : '其所指为何方？');
    body += '</div>';
    // 七快捷选项
    body += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:0.6rem;">';
    QUERY_QUICK_OPTIONS.forEach(function(opt) {
      body += '<button class="btn" style="font-size:0.72rem;padding:8px;text-align:left;" onclick="EdictComplete._answerClarification(\''+clar.id+'\',\'quick\',\''+opt.id+'\')">' + _escapeHtml(opt.label) + '</button>';
    });
    body += '</div>';
    // 自填
    body += '<div style="margin-bottom:0.4rem;">';
    body += '<input id="_clar_fill_' + clar.id + '" type="text" placeholder="自填补充……" style="width:100%;padding:6px;background:var(--bg-2);border:1px solid var(--bdr);color:var(--ink-100);font-family:inherit;font-size:0.78rem;">';
    body += '<button class="btn" style="font-size:0.72rem;padding:4px 10px;margin-top:4px;" onclick="EdictComplete._answerClarification(\''+clar.id+'\',\'fill\',document.getElementById(\'_clar_fill_'+clar.id+'\').value)">提交补诏</button>';
    body += '</div>';
    body += '<hr style="border:0;border-top:1px dashed var(--bdr);margin:0.6rem 0;">';
    // 降级/作罢
    body += '<div style="display:flex;gap:4px;">';
    body += '<button class="btn" style="font-size:0.72rem;padding:6px 12px;" onclick="EdictComplete._answerClarification(\''+clar.id+'\',\'delegate\')">让有司揣摩圣意</button>';
    body += '<button class="btn" style="font-size:0.72rem;padding:6px 12px;" onclick="EdictComplete._answerClarification(\''+clar.id+'\',\'abandon\')">不予作答</button>';
    body += '</div>';
    body += '</div>';
    var ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:19010;display:flex;align-items:center;justify-content:center;';
    ov.innerHTML = '<div style="background:var(--bg-1);border:1px solid var(--gold);border-radius:6px;padding:1.0rem;width:92%;max-width:560px;max-height:88vh;overflow-y:auto;">' + body + '<button class="btn" style="margin-top:0.6rem;" onclick="this.parentNode.parentNode.remove()">关闭</button></div>';
    ov.addEventListener('click', function(e) { if (e.target === ov) ov.remove(); });
    document.body.appendChild(ov);
    // 关闭后清理
    ov._clarId = clar.id;
  }

  function _answerClarification(clarId, mode, payload) {
    var G = global.GM;
    var clar = (G._pendingClarifications || []).find(function(c){return c.id===clarId;});
    if (!clar) return;
    var ovs = document.querySelectorAll('div[style*="z-index:19010"]');
    ovs.forEach(function(o){ if (o._clarId === clarId) o.remove(); });
    var rewrite = clar.originalText || '';
    if (mode === 'quick') {
      var opt = QUERY_QUICK_OPTIONS.find(function(o){return o.id===payload;});
      if (opt) rewrite = rewrite + '——' + opt.fill;
    } else if (mode === 'fill') {
      if (!payload || !payload.trim()) { if (global.toast) global.toast('未补充'); return; }
      rewrite = rewrite + '：' + payload.trim();
    } else if (mode === 'delegate') {
      // 降级为复奏，主官揣摩
      clar.status = 'delegated';
      if (typeof global.EdictParser !== 'undefined') {
        var cls = global.EdictParser.classify(rewrite, {});
        cls.pathway = 'memorial';
        cls.drafter = cls.drafter || '宰相';
        var memo = global.EdictParser.submitToMemorial(rewrite, cls);
        if (memo) memo._delegatedFromClarification = true;
        if (global.addEB) global.addEB('诏令', '令有司揣摩圣意，下回合具奏');
      }
      if (global.toast) global.toast('已令有司揣摩');
      return;
    } else if (mode === 'abandon') {
      clar.status = 'abandoned';
      if (global.addEB) global.addEB('诏令', '诏议作罢');
      if (global.toast) global.toast('诏议作罢');
      return;
    }
    // quick/fill：重新解析
    clar.status = 'answered';
    if (typeof global.EdictParser !== 'undefined') {
      var result = global.EdictParser.tryExecute(rewrite, {}, {});
      if (global.addEB) global.addEB('诏令', '补诏重议：' + (result.pathway || '未定'));
      if (global.toast) global.toast('已重议：' + (result.pathway === 'direct' ? '直断' : result.pathway === 'memorial' ? '转复奏' : result.pathway === 'ask' ? '仍需再问' : '未识别'));
    }
  }

  function _escapeHtml(s) { return (typeof escHtml === 'function') ? escHtml(s) : (s||'').toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  // ═══════════════════════════════════════════════════════════════════
  //  C2 · 扩朱批 7 选项 + AI 草稿质量
  // ═══════════════════════════════════════════════════════════════════

  /**
   * 增强朱批选项：
   *  approve        → 准奏实施
   *  modify_field   → 改某字段
   *  pick_official  → 圈定主官
   *  trial_region   → 部分先行（试点）
   *  reject         → 否决
   *  redraft        → 再议（换人起草）
   *  investigate    → 查其奏疏实情（派御史）
   */
  function processImperialAssentExtended(memoId, action, opts) {
    var G = global.GM;
    opts = opts || {};
    if (!G._pendingMemorials) return { ok: false };
    var memo = G._pendingMemorials.find(function(m){return m.id===memoId;});
    if (!memo) return { ok: false, reason: '未找到奏疏' };
    if (action === 'approve') {
      return typeof global.EdictParser !== 'undefined' ? global.EdictParser.processImperialAssent(memoId, 'approve', opts.modifications) : { ok: false };
    }
    if (action === 'modify_field') {
      memo.draftParams = Object.assign({}, memo.draftParams || {}, opts.fields || {});
      memo.status = 'modified';
      memo.expectedReturnTurn = (G.turn || 0) + 1;
      if (global.addEB) global.addEB('朱批', memo.typeName + '改' + Object.keys(opts.fields||{}).join('、') + '后再议');
      return { ok: true, status: 'modified' };
    }
    if (action === 'pick_official') {
      memo.draftParams = Object.assign({}, memo.draftParams || {}, { assignedOfficial: opts.officialName });
      memo.status = 'drafted';
      if (global.addEB) global.addEB('朱批', memo.typeName + '主官改选为 ' + opts.officialName);
      return { ok: true, status: 'drafted' };
    }
    if (action === 'trial_region') {
      memo.draftParams = Object.assign({}, memo.draftParams || {}, { trialRegion: opts.regionId, scope: 'trial' });
      memo.status = 'approved';
      memo.trialMode = true;
      if (typeof global.EdictParser !== 'undefined') {
        var EP = global.EdictParser;
        var type = EP.EDICT_TYPES && EP.EDICT_TYPES[memo.typeKey];
        if (type && type.aiEntry) type.aiEntry(memo.draftParams);
      }
      if (global.addEB) global.addEB('朱批', memo.typeName + ' 试点于 ' + opts.regionId);
      return { ok: true, status: 'trial' };
    }
    if (action === 'reject') {
      memo.status = 'rejected';
      if (global.addEB) global.addEB('朱批', memo.typeName + ' 诏议搁置');
      return { ok: true, status: 'rejected' };
    }
    if (action === 'redraft') {
      memo.status = 'redraft_pending';
      memo.drafter = opts.newDrafter || memo.drafter;
      memo.expectedReturnTurn = (G.turn || 0) + 1;
      if (global.addEB) global.addEB('朱批', memo.typeName + '换 ' + memo.drafter + ' 再议');
      return { ok: true, status: 'redraft_pending' };
    }
    if (action === 'investigate') {
      // 派御史核查
      if (!G._investigations) G._investigations = [];
      G._investigations.push({
        id: 'invest_' + (G.turn||0) + '_' + Math.floor(Math.random()*10000),
        target: memoId,
        drafter: memo.drafter,
        startTurn: G.turn || 0,
        expectedReturnTurn: (G.turn || 0) + 2,
        cost: 5000
      });
      if (G.guoku) G.guoku.money = Math.max(0, G.guoku.money - 5000);
      memo.status = 'under_investigation';
      if (global.addEB) global.addEB('监察', '派御史核查 ' + memo.drafter + ' 奏疏');
      return { ok: true, status: 'investigating' };
    }
    return { ok: false, reason: '未知动作' };
  }

  /** 让 _tickInvestigations 在每回合检测完成 */
  function _tickInvestigations(ctx) {
    var G = global.GM;
    if (!G._investigations) return;
    G._investigations.forEach(function(inv) {
      if (inv.status === 'done') return;
      if ((ctx.turn || 0) < inv.expectedReturnTurn) return;
      // 出具结果
      var drafter = (G.chars || []).find(function(c){return c.name===inv.drafter;});
      var fraudScore = drafter ? Math.max(0, 100 - (drafter.integrity || 60)) / 100 : 0.3;
      // 若腐败，找出"贪腐条款"
      var flaws = [];
      if (fraudScore > 0.5) flaws.push('工料费夹带');
      if (fraudScore > 0.7) flaws.push('门生亲族列于人选');
      if (fraudScore > 0.6 && Math.random() < 0.5) flaws.push('虚报工程量');
      inv.result = { fraudScore: fraudScore, flaws: flaws, reportedTurn: ctx.turn };
      inv.status = 'done';
      if (global.addEB) global.addEB('监察', '御史回奏：' + inv.drafter + (flaws.length > 0 ? ' 涉 ' + flaws.join('、') : ' 奏疏清白'));
    });
    G._investigations = G._investigations.filter(function(i){return (ctx.turn - i.startTurn) < 12;});
  }

  // ═══════════════════════════════════════════════════════════════════
  //  C3 · 动态机构 GM.dynamicInstitutions
  // ═══════════════════════════════════════════════════════════════════

  function registerDynamicInstitution(spec) {
    var G = global.GM;
    if (!G.dynamicInstitutions) G.dynamicInstitutions = [];
    var hq = (G.huangquan && G.huangquan.index) || 50;
    var inst = {
      id: 'inst_' + (G.turn || 0) + '_' + Math.floor(Math.random()*10000),
      name: spec.name || '新设衙门',
      rank: spec.rank || 5,
      duties: spec.duties || '',
      region: spec.region || 'central',
      subordinateTo: spec.subordinateTo || null,
      staffSize: spec.staffSize || 20,
      publicTreasuryBinding: spec.fundingSource || 'guoku.central',
      annualBudget: spec.annualBudget || 50000,
      headOfficial: spec.headOfficial || null,
      createdTurn: G.turn || 0,
      createdBy: spec.createdBy || 'edict',
      stage: 'proposal',
      effectiveness: hq < 40 ? 0.4 : hq < 70 ? 0.75 : 1.0,
      corruption: hq < 40 ? 40 : 15,
      history: []
    };
    G.dynamicInstitutions.push(inst);
    // 消耗皇权（创设成本）
    if (hq > 75 && typeof G.huangquan === 'object') G.huangquan.index = Math.max(0, G.huangquan.index - 5);
    // 扣除首年预算
    if (G.guoku && G.guoku.money >= inst.annualBudget) {
      G.guoku.money -= inst.annualBudget;
    } else {
      inst.stage = 'underfunded';
      inst.effectiveness *= 0.5;
    }
    if (global.addEB) global.addEB('机构', '新设 ' + inst.name + '（品 ' + inst.rank + '，岁支 ' + inst.annualBudget + '）');
    return inst;
  }

  /** 每回合机构拨款/衰退 */
  function _tickDynamicInstitutions(ctx, mr) {
    var G = global.GM;
    if (!G.dynamicInstitutions) return;
    var isFiscalYear = (G.month || 1) === 1 && G.turn > 0;
    G.dynamicInstitutions.forEach(function(inst) {
      if (inst.stage === 'abolished') return;
      // 年度拨款
      if (isFiscalYear && G.guoku) {
        if (G.guoku.money >= inst.annualBudget) {
          G.guoku.money -= inst.annualBudget;
          inst.stage = 'running';
        } else {
          inst.stage = 'underfunded';
          inst.effectiveness *= 0.8;
          if (global.addEB) global.addEB('机构', inst.name + ' 拨款不足，裁员');
        }
      }
      // 腐败增长
      inst.corruption = Math.min(100, inst.corruption + 0.1 * mr);
      // 若腐败满 → 影响全国腐败
      if (inst.corruption > 80 && G.corruption) {
        G.corruption.overall = Math.min(100, (G.corruption.overall || 0) + 0.05 * mr);
      }
    });
    // 废除老朽的机构
    G.dynamicInstitutions = G.dynamicInstitutions.filter(function(inst) {
      if (inst.stage === 'abolished' && (ctx.turn - inst.abolishedTurn) > 60) return false;
      return true;
    });
  }

  function abolishInstitution(instId) {
    var G = global.GM;
    if (!G.dynamicInstitutions) return;
    var inst = G.dynamicInstitutions.find(function(i){return i.id===instId;});
    if (!inst) return;
    inst.stage = 'abolished';
    inst.abolishedTurn = G.turn || 0;
    if (global.addEB) global.addEB('机构', inst.name + ' 已废');
    return inst;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  C3.5 · 官制二阶段 Phase II (奏疏补细节)
  // ═══════════════════════════════════════════════════════════════════

  /** 当 office_reform 走复奏路径时，生成含编制/驻地/拨款/人选的详奏 */
  function enhanceOfficeReformDraft(memo) {
    if (!memo || memo.typeKey !== 'office_reform') return;
    var G = global.GM;
    var params = memo.draftParams || {};
    var candidates = (G.chars || []).filter(function(c) {
      return c.alive !== false && c.officialTitle && (c.rank || 5) <= 4;
    }).slice(0, 3).map(function(c){return c.name;});
    var fundingSources = ['帑廪', '户部度支', '节余', '新加税赋'];
    params.details = {
      staffSize: 20 + Math.floor(Math.random() * 80),
      region: params.region || 'central',
      annualBudget: 50000 + Math.floor(Math.random() * 100000),
      fundingSource: fundingSources[Math.floor(Math.random() * fundingSources.length)],
      candidates: candidates,
      rank: params.rank || 5
    };
    memo.draftParams = params;
    memo.draftText = (params.officeName ? '设 ' + params.officeName + ' ' : '') + '拟：员额 ' + params.details.staffSize + '；驻 ' + params.details.region + '；岁支 ' + params.details.annualBudget + '；款出 ' + params.details.fundingSource + '；举 ' + params.details.candidates.join('、') + ' 候选。伏乞圣裁。';
    return memo;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  C4 · 环保 POLICY_KEYWORDS regex + 自动路由
  // ═══════════════════════════════════════════════════════════════════

  var POLICY_KEYWORDS = [
    { id:'feng_shan_mu',     re:/封山|育林|育木|禁樵/,                   kind:'env' },
    { id:'jin_hu_kui',       re:/禁伐|禁樵采/,                            kind:'env' },
    { id:'yi_he_shui',       re:/疏浚|浚河|浚渠/,                         kind:'env' },
    { id:'ke_gao',           re:/治碱|治盐|压盐/,                          kind:'env' },
    { id:'tun_tian',         re:/屯田|军屯|民屯/,                         kind:'env' },
    { id:'fan_gu',           re:/休耕|轮作|反古/,                          kind:'env' },
    { id:'jie_yong',         re:/节用|节俭|省费/,                          kind:'env' },
    { id:'zhi_tian_yu',      re:/治田|修田|田赋/,                          kind:'env' },
    { id:'jin_dian_hun',     re:/禁猎|保畜|禁网/,                          kind:'env' },
    { id:'shui_li',          re:/兴修水利|水利|修渠/,                       kind:'env' },
    { id:'ken_huang',        re:/垦荒|开荒|垦殖/,                           kind:'env' },
    { id:'yu_huang',         re:/育林|皇林|育木/,                           kind:'env' },
    { id:'jing_wei',         re:/清污|清河|净流/,                           kind:'env' },
    { id:'reforest',         re:/植树|造林|栽植/,                           kind:'recovery' },
    { id:'soil_terrace',     re:/梯田|等高/,                                kind:'recovery' },
    { id:'leach_salt',       re:/引水压盐|淋盐/,                            kind:'recovery' },
    { id:'green_belt',       re:/固沙|沙堤|防沙/,                           kind:'recovery' },
    { id:'well_deepen',      re:/深井|凿井/,                                kind:'recovery' },
    { id:'dredge',           re:/大浚|浚渠|疏河/,                           kind:'recovery' },
    { id:'reserve_park',     re:/设围场|保护|禁猎场/,                       kind:'recovery' },
    { id:'fallow_rotate',    re:/休耕|轮休|歇地/,                           kind:'recovery' },
    { id:'sewage_clean',     re:/清沟|沟渠|排污/,                           kind:'recovery' },
    { id:'disaster_relief_eco',re:/救荒|复原|复耕/,                         kind:'recovery' },
    // 禁海类（史实）
    { id:'jin_hai',          re:/禁海|海禁|下海禁/,                          kind:'special', specialHandler:'applyHaijin' },
    { id:'yu_jin',           re:/鱼禁|禁渔|休渔/,                            kind:'special', specialHandler:'applyYujin' }
  ];

  function detectEnvPolicy(text) {
    var matched = [];
    POLICY_KEYWORDS.forEach(function(p) {
      if (p.re.test(text)) matched.push(p);
    });
    return matched;
  }

  function routeEnvPolicy(text, ctx) {
    var G = global.GM;
    ctx = ctx || {};
    var matched = detectEnvPolicy(text);
    if (matched.length === 0) return { ok: false, reason: '无环保关键词' };
    var results = [];
    matched.forEach(function(p) {
      if (p.kind === 'recovery' && typeof global.EnvRecoveryFill !== 'undefined') {
        var r = global.EnvRecoveryFill.enactRecovery(p.id, ctx.regionId);
        results.push({ policy: p.id, ok: r.ok, reason: r.reason });
      } else if (p.kind === 'env' && typeof global.EnvCapacityEngine !== 'undefined' && typeof global.EnvCapacityEngine.enactPolicy === 'function') {
        var r2 = global.EnvCapacityEngine.enactPolicy(p.id, ctx.regionId);
        results.push({ policy: p.id, ok: r2 && r2.ok !== false, reason: r2 && r2.reason });
      } else if (p.kind === 'special') {
        // 禁海/鱼禁
        if (p.id === 'jin_hai') {
          G._maritimeBan = { active: true, turn: G.turn || 0 };
          if (G.fiscal && G.fiscal.regions) {
            Object.keys(G.fiscal.regions).forEach(function(rid) {
              var reg = G.fiscal.regions[rid];
              if ((reg.name || rid).match(/闽|粤|浙|沪|沿海/)) {
                reg.compliance = Math.max(0.1, (reg.compliance || 0.7) - 0.05);
              }
            });
          }
          if (global.addEB) global.addEB('海禁', '行禁海，沿海商船归港');
          // 对民心：沿海民怨，内地略安
          if (global._adjAuthority) global._adjAuthority('minxin', -2);
          results.push({ policy: 'jin_hai', ok: true });
        } else if (p.id === 'yu_jin') {
          G._fishingBan = { active: true, turn: G.turn || 0, duration: 12 };
          if (global.addEB) global.addEB('鱼禁', '春夏禁渔，养殖鱼类');
          results.push({ policy: 'yu_jin', ok: true });
        }
      }
    });
    return { ok: true, matched: matched.map(function(p){return p.id;}), results: results };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  挂载 tick：integrate with EdictComplete 或独立 tick
  // ═══════════════════════════════════════════════════════════════════

  function tick(ctx) {
    ctx = ctx || {};
    try { _tickInvestigations(ctx); } catch(e) { console.error('[phaseC] inv:', e); }
    try { _tickDynamicInstitutions(ctx, ctx.monthRatio || 1); } catch(e) { console.error('[phaseC] inst:', e); }
  }

  function init() {
    // 补 EdictParser._generateDraft：在官制类型时加细节
    if (typeof global.EdictParser !== 'undefined' && !global.EdictParser._phaseC_patched) {
      var origAssent = global.EdictParser.processImperialAssent;
      global.EdictParser.processImperialAssent = function(memoId, decision, modifications) {
        var G = global.GM;
        var memo = (G._pendingMemorials || []).find(function(m){return m.id===memoId;});
        // 当奏疏是官制类且 approve 时，自动注册动态机构
        if (memo && memo.typeKey === 'office_reform' && decision === 'approve') {
          var params = Object.assign({}, memo.draftParams || {}, modifications || {});
          if (params.officeName) {
            registerDynamicInstitution({
              name: params.officeName,
              rank: params.rank || 5,
              duties: params.duties || '',
              region: (params.details && params.details.region) || 'central',
              staffSize: (params.details && params.details.staffSize) || 20,
              fundingSource: (params.details && params.details.fundingSource) || 'guoku.central',
              annualBudget: (params.details && params.details.annualBudget) || 50000,
              createdBy: 'memorial_approved_' + memoId
            });
          }
        }
        return origAssent.call(global.EdictParser, memoId, decision, modifications);
      };
      global.EdictParser._phaseC_patched = true;
    }
    // 每次 submitToMemorial 时如是 office_reform，增强 Phase II
    if (typeof global.EdictParser !== 'undefined' && !global.EdictParser._phaseC_memo_patched) {
      var origTick = global.EdictParser.tick;
      global.EdictParser.tick = function(ctx) {
        var G = global.GM;
        // 在 drafted 前 enhance
        (G._pendingMemorials || []).forEach(function(m) {
          if (m.typeKey === 'office_reform' && m.status === 'pending_draft' && (ctx.turn || 0) >= m.expectedReturnTurn && !m._enhanced) {
            m._enhanced = true;
            enhanceOfficeReformDraft(m);
          }
        });
        return origTick.call(global.EdictParser, ctx);
      };
      global.EdictParser._phaseC_memo_patched = true;
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  导出
  // ═══════════════════════════════════════════════════════════════════

  global.EdictComplete = global.EdictComplete || {};
  global.EdictComplete.openClarificationPanel = openClarificationPanel;
  global.EdictComplete._answerClarification = _answerClarification;
  global.EdictComplete.processImperialAssentExtended = processImperialAssentExtended;
  global.EdictComplete.QUERY_QUICK_OPTIONS = QUERY_QUICK_OPTIONS;

  global.PhaseC = {
    init: init,
    tick: tick,
    registerDynamicInstitution: registerDynamicInstitution,
    abolishInstitution: abolishInstitution,
    detectEnvPolicy: detectEnvPolicy,
    routeEnvPolicy: routeEnvPolicy,
    enhanceOfficeReformDraft: enhanceOfficeReformDraft,
    openClarificationPanel: openClarificationPanel,
    processImperialAssentExtended: processImperialAssentExtended,
    POLICY_KEYWORDS: POLICY_KEYWORDS,
    VERSION: 1
  };

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
