/**
 * tm-edict-parser.js — 诏令识别与制度演化
 *
 * 实施以下 2 个设计文档：
 *  - 设计方案-诏令识别补完.md（P0/P1 五大虚空渠道 UI 路径）
 *  - 设计方案-制度设计与演化.md（诏书六类 + 判定分流 + 二阶段 + 抗疏）
 *
 * 六大诏书类型：
 *  1. 货币改革 2. 税种设立 3. 户籍制度 4. 徭役改革 5. 兵制改革 6. 官制设立
 *
 * 三类分流：
 *  A. AI 可直断（完整度 > 0.6 或紧急度 > 0.7）
 *  B. 意图明确但细节不足（复奏/求见）
 *  C. 意图模糊（AI 追问）
 *
 * 30 条历代典范
 */
(function(global) {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════
  //  六大诏书类型参数 schema
  // ═══════════════════════════════════════════════════════════════════

  var EDICT_TYPES = {
    currency_reform: {
      name: '货币改革',
      requiredFields: ['coinType', 'weight', 'purity', 'mintAgency'],
      critical: ['coinType'],
      drafter: '户部尚书',
      aiEntry: function(params) {
        if (typeof global.CurrencyEngine === 'undefined') return false;
        var preset = (global.CurrencyEngine.REFORM_PRESETS || []).find(function(r) {
          return params.presetId === r.id;
        });
        var ok = preset ? global.CurrencyEngine.applyReform(preset.id, params) : false;
        // 皇威反馈：改革成功 → structuralReform；失败 → brokenPromise
        if (typeof global.AuthorityComplete !== 'undefined') {
          if (ok && ok.success) global.AuthorityComplete.triggerHuangweiEvent('structuralReform');
          else if (ok && !ok.success) global.AuthorityComplete.triggerHuangweiEvent('brokenPromise');
        }
        return ok;
      }
    },
    tax_reform: {
      name: '税种设立',
      requiredFields: ['taxType', 'base', 'rate'],
      critical: ['taxType', 'rate'],
      drafter: '户部尚书',
      aiEntry: function(params) {
        if (!global.GM.fiscalConfig) global.GM.fiscalConfig = {};
        if (!global.GM.fiscalConfig.customTaxes) global.GM.fiscalConfig.customTaxes = [];
        global.GM.fiscalConfig.customTaxes.push({
          id: params.taxId || ('custom_' + (global.GM.turn || 0)),
          name: params.taxName || '新税',
          formulaType: params.formulaType || 'percent',
          rate: params.rate || 0.03,
          base: params.base || 'commerce',
          description: params.description || ''
        });
        // 皇威反馈：加税 → lostVirtueRumor；减税/蠲免 → benevolence
        if (typeof global.AuthorityComplete !== 'undefined') {
          var rate = params.rate || 0.03;
          if (rate > 0.05) global.AuthorityComplete.triggerHuangweiEvent('lostVirtueRumor');
          else if (rate < 0) global.AuthorityComplete.triggerHuangweiEvent('benevolence');
        }
        return true;
      }
    },
    huji_reform: {
      name: '户籍制度',
      requiredFields: ['action', 'target', 'scope'],
      critical: ['action'],
      drafter: '户部尚书',
      aiEntry: function(params) {
        if (typeof global.HujiEngine === 'undefined') return false;
        var P = global.GM.population;
        if (!P) return false;
        var action = params.action || '';
        // recount/重造黄册
        if (action === 'recount' || action === '重造' || action === '大造') {
          P.meta.lastRegistrationTurn = 0;
          return true;
        }
        // 改色目（bianhu → 某色）
        if (action === 'change_category' || action === '转色目') {
          var from = params.fromCategory || 'bianhu';
          var to = params.toCategory;
          var count = params.count || 10000;
          if (P.byCategory[from] && P.byCategory[to]) {
            P.byCategory[from].mouths = Math.max(0, P.byCategory[from].mouths - count);
            P.byCategory[to].mouths += count;
            if (global.addEB) global.addEB('户籍', count + ' 口由 ' + from + ' 转 ' + to);
            return true;
          }
        }
        // 清查隐户
        if (action === 'purge_hidden' || action === '清查隐户') {
          var purged = Math.round((P.hiddenCount || 0) * 0.5);
          P.hiddenCount = Math.max(0, P.hiddenCount - purged);
          if (P.byLegalStatus.huangji) P.byLegalStatus.huangji.households += purged;
          if (global.addEB) global.addEB('户籍', '清查隐户 ' + purged + ' 户');
          return true;
        }
        // 招抚流民
        if (action === 'resettle_refugees' || action === '招抚流民') {
          var taohu = P.byLegalStatus.taoohu || {};
          var resettled = Math.round((taohu.mouths || 0) * 0.3);
          if (resettled > 0) {
            taohu.mouths -= resettled;
            taohu.households = Math.max(0, (taohu.households || 0) - Math.round(resettled / 5));
            taohu.ding = Math.max(0, (taohu.ding || 0) - Math.round(resettled * 0.3));
            if (P.byLegalStatus.huangji) {
              P.byLegalStatus.huangji.mouths += resettled;
              P.byLegalStatus.huangji.households += Math.round(resettled / 5);
              P.byLegalStatus.huangji.ding += Math.round(resettled * 0.3);
            }
            P.fugitives = Math.max(0, (P.fugitives || 0) - resettled);
            if (global.addEB) global.addEB('招抚', '流民 ' + resettled + ' 口复业');
            // 皇威：德政
            if (typeof global.AuthorityComplete !== 'undefined') global.AuthorityComplete.triggerHuangweiEvent('benevolence');
            return true;
          }
        }
        // 保甲编设
        if (action === 'baojia_setup' || action === '编设保甲') {
          Object.keys(P.byRegion || {}).forEach(function(rid) {
            var r = P.byRegion[rid];
            r.baojiaUnits = Math.round(r.households / 10);
            r.lijiaUnits = Math.round(r.households / 110);
          });
          if (global.addEB) global.addEB('户籍', '全国编设保甲');
          return true;
        }
        return false;
      }
    },
    corvee_reform: {
      name: '徭役改革',
      requiredFields: ['mode', 'commutationRate'],
      critical: ['mode'],
      drafter: '户部尚书',
      aiEntry: function(params) {
        var P = global.GM.population;
        if (!P || !P.corvee) return false;
        var ok = false;
        if (params.mode === 'fully_commuted' || params.preset === 'yitiao_bian') {
          P.corvee.fullyCommuted = true;
          if (global.addEB) global.addEB('徭役', '役银合一（一条鞭法）');
          ok = true;
        } else if (typeof params.commutationRate === 'number') {
          P.corvee.commutationRate = params.commutationRate;
          ok = true;
        }
        // 皇威：重大改革成功 → structuralReform
        if (ok && typeof global.AuthorityComplete !== 'undefined') global.AuthorityComplete.triggerHuangweiEvent('structuralReform');
        return ok;
      }
    },
    military_reform: {
      name: '兵制改革',
      requiredFields: ['system', 'scale'],
      critical: ['system'],
      drafter: '兵部尚书',
      aiEntry: function(params) {
        var P = global.GM.population;
        if (!P || !P.military) return false;
        var ok = false;
        if (params.enable && P.military.types[params.enable]) {
          P.military.types[params.enable].enabled = true;
          if (global.addEB) global.addEB('兵制', '启用 ' + params.enable);
          ok = true;
        } else if (params.disable && P.military.types[params.disable]) {
          P.military.types[params.disable].enabled = false;
          if (global.addEB) global.addEB('兵制', '废止 ' + params.disable);
          ok = true;
        }
        // 皇威：兵制改革+皇权军权集中
        if (ok && typeof global.AuthorityComplete !== 'undefined') {
          global.AuthorityComplete.triggerHuangweiEvent('structuralReform');
          global.AuthorityComplete.triggerHuangquanEvent('militaryCentral');
        }
        return ok;
      }
    },
    office_reform: {
      name: '官制设立',
      requiredFields: ['officeName', 'rank', 'duties'],
      critical: ['officeName'],
      drafter: '吏部尚书',
      aiEntry: function(params) {
        if (!global.GM.officeTree) return false;
        if (!global.GM.customOffices) global.GM.customOffices = [];
        global.GM.customOffices.push({
          name: params.officeName,
          rank: params.rank || 5,
          duties: params.duties || '',
          createdTurn: global.GM.turn || 0
        });
        if (global.addEB) global.addEB('官制', '新设 ' + params.officeName + '（品级 ' + (params.rank||5) + '）');
        // 皇威：制度改革 + 皇权：结构改革
        if (typeof global.AuthorityComplete !== 'undefined') {
          global.AuthorityComplete.triggerHuangweiEvent('structuralReform');
          global.AuthorityComplete.triggerHuangquanEvent('structureReform');
        }
        return true;
      }
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  //  30 条历代典范
  // ═══════════════════════════════════════════════════════════════════

  var HISTORICAL_EDICT_PRESETS = [
    // 货币改革 (5)
    { id:'qin_banliang', type:'currency_reform', dynasty:'秦', text:'统一币制，废六国异币，铸圆方孔半两' },
    { id:'han_wuzhu', type:'currency_reform', dynasty:'汉', text:'铸五铢钱，禁郡国铸' },
    { id:'tang_kaiyuan', type:'currency_reform', dynasty:'唐', text:'废五铢，立开元通宝' },
    { id:'song_jiaozi', type:'currency_reform', dynasty:'宋', text:'发交子于蜀' },
    { id:'ming_baochao', type:'currency_reform', dynasty:'明', text:'发大明宝钞' },
    // 税种设立 (5)
    { id:'han_suanfu', type:'tax_reform', dynasty:'汉', text:'立算赋，每人每年一百二十钱' },
    { id:'tang_zuyongdiao', type:'tax_reform', dynasty:'唐', text:'租庸调：丁岁粟二石、绢二丈、役二十日' },
    { id:'liangshui', type:'tax_reform', dynasty:'唐', text:'行两税法，夏秋两征' },
    { id:'wang_junshushi', type:'tax_reform', dynasty:'唐', text:'立均输实钱' },
    { id:'yitiao_bian', type:'tax_reform', dynasty:'明', text:'一条鞭法：赋役合一折银' },
    // 户籍制度 (4)
    { id:'qin_bianhu', type:'huji_reform', dynasty:'秦', text:'编户齐民，什伍连坐' },
    { id:'ming_huangce', type:'huji_reform', dynasty:'明', text:'造黄册，十年一大造' },
    { id:'qing_baojia', type:'huji_reform', dynasty:'清', text:'推行保甲，十户一牌，十牌一甲' },
    { id:'tandin_rumu', type:'huji_reform', dynasty:'清', text:'摊丁入亩，永不加赋' },
    // 徭役改革 (5)
    { id:'qin_gengyi', type:'corvee_reform', dynasty:'秦', text:'立更役，丁岁一月' },
    { id:'tang_yongzhi', type:'corvee_reform', dynasty:'唐', text:'庸役折绢，岁二丈' },
    { id:'ming_junyao', type:'corvee_reform', dynasty:'明', text:'均徭，按丁田轮派' },
    { id:'yitiao_bian_corvee', type:'corvee_reform', dynasty:'明', text:'役银合一，摊入田赋' },
    { id:'qing_huomao', type:'corvee_reform', dynasty:'清', text:'火耗归公，养廉银制' },
    // 兵制改革 (6)
    { id:'fubing', type:'military_reform', dynasty:'唐', text:'立府兵，府兵轮番宿卫' },
    { id:'mubing', type:'military_reform', dynasty:'宋', text:'行募兵制' },
    { id:'weisuo', type:'military_reform', dynasty:'明', text:'立卫所，军户世袭' },
    { id:'baqi', type:'military_reform', dynasty:'清', text:'立八旗，兵民合一' },
    { id:'luying', type:'military_reform', dynasty:'清', text:'立绿营，募汉人' },
    { id:'xiangyong', type:'military_reform', dynasty:'清', text:'湘军淮军，团练练勇' },
    // 官制设立 (5)
    { id:'qin_sangong', type:'office_reform', dynasty:'秦', text:'立三公九卿' },
    { id:'han_cishi', type:'office_reform', dynasty:'汉', text:'立刺史部十三州' },
    { id:'tang_sansheng', type:'office_reform', dynasty:'唐', text:'立三省六部' },
    { id:'song_zhonshu', type:'office_reform', dynasty:'宋', text:'立中书门下政事堂' },
    { id:'ming_neige', type:'office_reform', dynasty:'明', text:'立内阁大学士' }
  ];

  // ═══════════════════════════════════════════════════════════════════
  //  三维评估
  // ═══════════════════════════════════════════════════════════════════

  function _assessCompleteness(text, typeKey) {
    var type = EDICT_TYPES[typeKey];
    if (!type || !type.requiredFields) return 0.5;
    // 按关键字检测
    var keywordMap = {
      coinType: /铜钱|银|金|铁钱|纸|钞|通宝|重宝|元宝/,
      weight: /重\s*[一二三四五六七八九十百千]|\d+\s*铢|\d+\s*两/,
      purity: /成色|足色|精铸|减铸|减重/,
      mintAgency: /户部|宝泉局|宝源局|铸所|造币|铸钱/,
      taxType: /商税|盐税|茶税|市舶|关税|算赋|田租/,
      base: /按人|按丁|按亩|按户|按产/,
      rate: /\d+\s*文|\d+%|百分之|什一|十分之/,
      action: /清查|重造|改色|变籍|入编/,
      target: /逃户|隐户|僧道|军户|编户/,
      scope: /全国|天下|某省|某府|某县/,
      mode: /折银|钱粮|半折|全折|常额|均派/,
      commutationRate: /折\s*[五六七八九]\s*分/,
      system: /府兵|募兵|卫所|八旗|绿营|团练/,
      scale: /\d+\s*万|五万|十万/,
      officeName: /设.*司|立.*部|置.*院|创.*监/,
      rank: /[一二三四五六七八九]品/,
      duties: /掌|辖|管|司/
    };
    var filled = 0;
    type.requiredFields.forEach(function(f) {
      if (keywordMap[f] && keywordMap[f].test(text)) filled++;
    });
    return filled / Math.max(1, type.requiredFields.length);
  }

  function _assessUrgency(text, ctx) {
    var u = 0;
    ctx = ctx || {};
    var G = global.GM;
    if (G.activeWars && G.activeWars.length > 0) u += 0.4;
    if (G.activeFamine || (G.vars && G.vars.disasterLevel > 0.3)) u += 0.4;
    if (G.activeRevolt || (typeof G.unrest === 'number' && G.unrest > 70)) u += 0.5;
    var sc = (typeof global.findScenarioById === 'function') ? global.findScenarioById(G.sid) : null;
    var dpt = (sc && sc.timeConfig && sc.timeConfig.daysPerTurn) || 30;
    if (dpt <= 3) u += 0.3;
    else if (dpt <= 30) u += 0.1;
    else if (dpt > 180) u -= 0.2;
    if (/赈|救|急|速|速办|立即/.test(text)) u += 0.3;
    if (/朕欲.*改.*制/.test(text)) u -= 0.2;
    return Math.max(0, Math.min(1, u));
  }

  function _assessImportance(text, typeKey) {
    var i = 0;
    if (/全国|天下/.test(text)) i += 0.7;
    else if (/某省|某路|某道/.test(text)) i += 0.5;
    else i += 0.2;
    if (typeKey === 'currency_reform' || typeKey === 'military_reform' || typeKey === 'office_reform') i += 0.3;
    if (/改制|变法|创新/.test(text)) i += 0.2;
    return Math.max(0, Math.min(1, i));
  }

  function _detectType(text) {
    if (/铜钱|银本|金本|铸.*通宝|发.*钞|币制|钱法|币改/.test(text)) return 'currency_reform';
    if (/税|赋|榷|课|饷/.test(text)) return 'tax_reform';
    if (/户籍|户等|黄册|白册|保甲|里甲|编户|色目/.test(text)) return 'huji_reform';
    if (/徭役|役法|差役|均徭|一条鞭|摊丁|役银/.test(text)) return 'corvee_reform';
    if (/府兵|募兵|卫所|八旗|绿营|兵制|军制|常备/.test(text)) return 'military_reform';
    if (/设.*司|立.*部|置.*院|创.*监|官制|职官|机构/.test(text)) return 'office_reform';
    return null;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  判定分流主函数
  // ═══════════════════════════════════════════════════════════════════

  function classify(text, ctx) {
    ctx = ctx || {};
    var typeKey = ctx.typeOverride || _detectType(text);
    if (!typeKey) {
      return { pathway: 'other', typeKey: null, reason: '未识别为制度类诏书' };
    }
    var completeness = _assessCompleteness(text, typeKey);
    var urgency = _assessUrgency(text, ctx);
    var importance = _assessImportance(text, typeKey);

    var pathway;
    if (urgency > 0.7) pathway = 'direct';                    // 紧急强制直断
    else if (completeness > 0.6) pathway = 'direct';          // 完整度高直断
    else if (completeness < 0.1) pathway = 'ask';             // 意图模糊追问
    else if (completeness < 0.3 && importance > 0.7 && urgency < 0.5) pathway = 'memorial'; // 复奏
    else pathway = 'direct';                                  // 默认直断（AI 补缺）

    var drafter = EDICT_TYPES[typeKey].drafter;
    var objectionRisk = (1 - completeness) * importance * 0.5;

    return {
      pathway: pathway,
      typeKey: typeKey,
      typeName: EDICT_TYPES[typeKey].name,
      completeness: completeness,
      urgency: urgency,
      importance: importance,
      drafter: drafter,
      objectionRisk: objectionRisk
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  解析 + 执行（直断路径）
  // ═══════════════════════════════════════════════════════════════════

  function tryExecute(text, params, ctx) {
    var cls = classify(text, ctx);
    if (cls.pathway !== 'direct') {
      return { ok: false, pathway: cls.pathway, classification: cls };
    }
    var type = EDICT_TYPES[cls.typeKey];
    if (!type || !type.aiEntry) return { ok: false, reason: '类型无执行入口' };
    var exec = false;
    try { exec = type.aiEntry(params || {}); } catch(e) { console.error('[edict] exec', e); exec = false; }
    return { ok: exec, pathway: 'direct', classification: cls };
  }

  /** 将意图明确但细节不足的诏书转奏疏（二阶段） */
  function submitToMemorial(text, cls) {
    var G = global.GM;
    if (!G._pendingMemorials) G._pendingMemorials = [];
    var memo = {
      id: 'memo_' + (G.turn || 0) + '_' + Math.floor(Math.random()*10000),
      originalEdictText: text,
      typeKey: cls.typeKey,
      typeName: cls.typeName,
      drafter: cls.drafter,
      turn: G.turn || 0,
      expectedReturnTurn: (G.turn || 0) + 1,
      completeness: cls.completeness,
      importance: cls.importance,
      urgency: cls.urgency,
      status: 'pending_draft'
    };
    G._pendingMemorials.push(memo);
    if (global.addEB) global.addEB('诏令', '意旨已下，' + cls.drafter + ' 将于下回合具奏');
    return memo;
  }

  /** AI 侍臣问疑（类 C 追问） */
  function askForClarification(text, cls) {
    var G = global.GM;
    if (!G._pendingClarifications) G._pendingClarifications = [];
    var clar = {
      id: 'clar_' + (G.turn || 0) + '_' + Math.floor(Math.random()*10000),
      originalText: text,
      turn: G.turn || 0,
      questions: _generateQuestions(text, cls),
      status: 'awaiting_answer'
    };
    G._pendingClarifications.push(clar);
    if (global.addEB) global.addEB('诏令', '侍臣问疑：' + clar.questions[0]);
    return clar;
  }

  function _generateQuestions(text, cls) {
    var type = EDICT_TYPES[cls.typeKey] || {};
    var qs = [];
    (type.critical || []).forEach(function(f) {
      var fMap = {
        coinType: '欲铸何币（铜/银/铁/纸）？',
        taxType: '征何税（商/盐/茶/市舶）？',
        rate: '税率几何？',
        action: '欲行何事（清查/重造/变籍）？',
        mode: '役法何制（折银/钱粮/均派）？',
        system: '兵何制（府兵/募兵/卫所）？',
        officeName: '欲设何官司？'
      };
      if (fMap[f]) qs.push(fMap[f]);
    });
    if (qs.length === 0) qs.push('圣意具体如何？');
    return qs;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  每回合处理奏疏/抗疏
  // ═══════════════════════════════════════════════════════════════════

  function _tickPendingMemorials(ctx) {
    var G = global.GM;
    if (!G._pendingMemorials) return;
    G._pendingMemorials.forEach(function(memo) {
      if (memo.status === 'pending_draft' && (ctx.turn || 0) >= memo.expectedReturnTurn) {
        memo.status = 'drafted';
        memo.draftText = _generateDraft(memo);
        // 加入 notifications / qiju
        if (!G._memorialNotifications) G._memorialNotifications = [];
        G._memorialNotifications.push({ id: memo.id, drafter: memo.drafter, summary: (memo.draftText || '').slice(0, 80) });
        if (global.addEB) global.addEB('奏疏', memo.drafter + '呈奏：' + (memo.draftText || '').slice(0, 30) + '…');
        // 重大奏疏触发抗疏
        try { _checkAbduction(memo, ctx); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'edict] abduction:') : console.error('[edict] abduction:', e); }
      }
    });
    // 清理 30 回合前的
    G._pendingMemorials = G._pendingMemorials.filter(function(m) { return (ctx.turn || 0) - m.turn < 30; });
  }

  function _generateDraft(memo) {
    // 简化：按类型生成默认提案
    var templates = {
      currency_reform: '臣奉旨议币改。拟铸新钱，重三铢五分，官铸户部，岁铸百万贯，禁私铸。伏乞圣裁。',
      tax_reform: '臣奉旨议立新税。拟于通关要道征税，百抽三，商户登记。伏乞圣裁。',
      huji_reform: '臣奉旨议户籍整饬。拟重造黄册，限三年清查，罚匿户仗八十。伏乞圣裁。',
      corvee_reform: '臣奉旨议役法。拟行折银，每丁岁一钱五分，灾年减半。伏乞圣裁。',
      military_reform: '臣奉旨议兵制。拟募兵五万，月饷二两，岁训春秋。伏乞圣裁。',
      office_reform: '臣奉旨议官制。拟设新司，正五品衙，员额二十，辖各属。伏乞圣裁。'
    };
    return templates[memo.typeKey] || '臣奉旨谨议。伏乞圣裁。';
  }

  /** 皇帝朱批（approve/reject/modify）*/
  function processImperialAssent(memoId, decision, modifications) {
    var G = global.GM;
    if (!G._pendingMemorials) return { ok: false };
    var memo = G._pendingMemorials.find(function(m) { return m.id === memoId; });
    if (!memo) return { ok: false, reason: '未找到奏疏' };
    if (decision === 'approve') {
      memo.status = 'approved';
      // 执行
      var type = EDICT_TYPES[memo.typeKey];
      if (type && type.aiEntry) {
        var params = Object.assign({}, memo.draftParams || {}, modifications || {});
        type.aiEntry(params);
      }
      if (global.addEB) global.addEB('诏令', memo.typeName + ' 已施行');
    } else if (decision === 'reject') {
      memo.status = 'rejected';
      if (global.addEB) global.addEB('诏令', memo.typeName + ' 诏议搁置');
    } else if (decision === 'modify') {
      memo.status = 'modified';
      memo.draftParams = Object.assign({}, memo.draftParams || {}, modifications || {});
      // 下回合再议
      memo.expectedReturnTurn = (G.turn || 0) + 1;
    }
    return { ok: true, status: memo.status };
  }

  /** 抗疏 — 重大制度诏书触发 */
  function _checkAbduction(memo, ctx) {
    var G = global.GM;
    if (!memo || memo.objectionRisk < 0.5) return null;
    // 抗疏概率 = importance × (1 - completeness) × 抵抗因子
    var risk = (memo.importance || 0.5) * (1 - (memo.completeness || 0.5));
    // 有清流大臣可能抗疏
    var objector = (G.chars || []).find(function(c) {
      if (c.alive === false) return false;
      var integrity = c.integrity || c.benevolence || 50;
      return integrity > 70 && c.loyalty > 60 && (c.officialTitle || '').match(/御史|谏议|拾遗|补阙/);
    });
    if (!objector) return null;
    if (Math.random() < risk) {
      // 触发抗疏
      var obj = {
        id: 'obj_' + (ctx.turn || 0) + '_' + Math.floor(Math.random()*10000),
        turn: ctx.turn || 0,
        objector: objector.name,
        target: memo.id,
        content: '臣 ' + objector.name + ' 死谏：' + memo.typeName + ' 不可行也。'
      };
      if (!G._abductions) G._abductions = [];
      G._abductions.push(obj);
      if (global.addEB) global.addEB('抗疏', objector.name + ' 抗疏：' + memo.typeName);
      return obj;
    }
    return null;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  主 tick
  // ═══════════════════════════════════════════════════════════════════

  function tick(ctx) {
    ctx = ctx || {};
    try { _tickPendingMemorials(ctx); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'edict] memo:') : console.error('[edict] memo:', e); }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  AI 上下文
  // ═══════════════════════════════════════════════════════════════════

  function getAIContext() {
    var G = global.GM;
    if (!G) return '';
    var lines = [];
    if (G._pendingMemorials && G._pendingMemorials.length > 0) {
      var pending = G._pendingMemorials.filter(function(m) { return m.status === 'drafted'; });
      if (pending.length > 0) {
        lines.push('【奏疏】已拟就待朱批 ' + pending.length + ' 本：' + pending.slice(0,3).map(function(m) { return m.typeName; }).join('、'));
      }
    }
    if (G._pendingClarifications && G._pendingClarifications.length > 0) {
      lines.push('【问疑】侍臣待回答 ' + G._pendingClarifications.length + ' 项');
    }
    if (G._abductions && G._abductions.length > 0) {
      var recent = G._abductions.filter(function(o) { return (G.turn || 0) - o.turn < 5; });
      if (recent.length > 0) lines.push('【抗疏】近有 ' + recent.length + ' 起');
    }
    return lines.length > 0 ? lines.join('\n') : '';
  }

  // ═══════════════════════════════════════════════════════════════════
  //  导出
  // ═══════════════════════════════════════════════════════════════════

  global.EdictParser = {
    classify: classify,
    tryExecute: tryExecute,
    submitToMemorial: submitToMemorial,
    askForClarification: askForClarification,
    processImperialAssent: processImperialAssent,
    tick: tick,
    getAIContext: getAIContext,
    EDICT_TYPES: EDICT_TYPES,
    HISTORICAL_EDICT_PRESETS: HISTORICAL_EDICT_PRESETS,
    // 动态访问（支持 scriptData.customPresets.edictPresets 覆盖/追加）
    getHistoricalEdictPresets: function() {
      var sd = global.scriptData || {};
      var cps = sd.customPresets || {};
      var overrides = cps.edictPresets || cps.classicalEdicts;  // 两个键都支持
      if (!Array.isArray(overrides) || overrides.length === 0) return HISTORICAL_EDICT_PRESETS;
      var map = {};
      HISTORICAL_EDICT_PRESETS.forEach(function(x){ if (x && x.id) map[x.id] = x; });
      overrides.forEach(function(x){ if (x && x.id) map[x.id] = Object.assign({}, map[x.id]||{}, x); });
      return Object.keys(map).map(function(k){ return map[k]; });
    },
    VERSION: 1
  };

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
