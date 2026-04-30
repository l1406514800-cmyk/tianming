// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// tm-endturn-core.js — 回合结算入口 (R110 从 tm-endturn.js L12712-end 拆出)
// 职责: endTurn(入口)·_endTurnInternal·_endTurnCore (主管道·调 prep + ai-infer + 写回)
// 姊妹: tm-endturn-prep.js + tm-endturn-ai-infer.js
// ============================================================

async function _endTurnInternal() {
  // 原 endTurn 的完整内容移入此处，方便并发调用
  return await _endTurnCore();
}

async function endTurn(){
  // 入口：显示"是否例行朝会"弹窗
  if (GM.busy) return;
  _showPostTurnCourtPromptAndStartEndTurn();
}

async function _endTurnCore(){
  try{
  // 兼容新旧UI：老诏令面板按钮是btn-end，新UI右侧按钮是btn-end-turn
  var btn=_$("btn-end")||_$("btn-end-turn");
  if(GM.busy)return;
  GM.busy=true;
  GM._endTurnBusy=true;
  if(btn){ btn.textContent="\u63A8\u6F14\u4E2D...";btn.style.opacity="0.6"; }
  // 后朝中不用 showLoading（会遮挡朝会）
  if (!(GM._pendingShijiModal && GM._pendingShijiModal.courtDone === false)) {
    showLoading("\u65F6\u79FB\u4E8B\u53BB",10);
  }

  // ★ 过回合前自动存档·防 AI 长推演崩溃丢失本回合操作(诏令/奏疏批复/对话/调动)
  // 写入独立 IDB key 'pre_endturn'·与正常 autosave/slot_0 分离·不污染案卷目录
  // 写入 localStorage 标记 tm_pre_endturn_mark·页面刷新后可检测
  // 异步·失败静默·不阻塞推演
  try {
    if (typeof TM_SaveDB !== 'undefined' && typeof _prepareGMForSave === 'function') {
      _prepareGMForSave();
      var _preState = { GM: deepClone(GM), P: deepClone(P) };
      var _scPre = (typeof findScenarioById === 'function' && GM.sid) ? findScenarioById(GM.sid) : null;
      var _preMeta = {
        name: '过回合前·' + (typeof getTSText === 'function' ? getTSText(GM.turn) : 'T' + GM.turn),
        type: 'pre_endturn',
        turn: GM.turn,
        scenarioName: _scPre ? _scPre.name : '',
        eraName: GM.eraName || '',
        savedAt: Date.now()
      };
      // 先同步写 localStorage mark·再异步写 IDB·防止 IDB 在途崩溃丢失恢复信号
      // mark 存在但 IDB 缺失 → 恢复弹窗已有 fallback("过回合前快照已损坏·尝试加载常规自动存档")
      try {
        localStorage.setItem('tm_pre_endturn_mark', JSON.stringify({
          turn: GM.turn, timestamp: Date.now(),
          scenarioName: _preMeta.scenarioName,
          eraName: _preMeta.eraName,
          saveName: GM.saveName || ''
        }));
      } catch(_lsE){try{window.TM&&TM.errors&&TM.errors.captureSilent(_lsE,'pre_endturn ls mark');}catch(_){}}
      TM_SaveDB.save('pre_endturn', _preState, _preMeta).catch(function(e){
        (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'PreEndTurnSave]') : console.warn('[PreEndTurnSave]', e);
      });
    }
  } catch(_psE) {
    (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_psE, 'PreEndTurnSave outer') : console.warn('[PreEndTurnSave outer]', _psE);
  }

  await EndTurnHooks.execute('before');

  // Phase 0-A·情节弧兜底·若 >=4 回合未更新则触发后台推进(不等待·不阻塞)
  try {
    if (typeof ensureCharArcsBeforeEndturn === 'function') {
      ensureCharArcsBeforeEndturn();
    }
  } catch(_arcBE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_arcBE, 'endTurn] 情节弧兜底失败') : console.warn('[endTurn] 情节弧兜底失败', _arcBE); }

  // Phase 0-0·清理本回合待下诏书快照（任免已正式颁布·不再可撤销）
  try {
    (function _clearPE(nodes){
      (nodes||[]).forEach(function(n){
        (n.positions||[]).forEach(function(p){ if (p && p._pendingEdict) { try { delete p._pendingEdict; } catch(_){} } });
        if (n.subs) _clearPE(n.subs);
      });
    })(GM.officeTree||[]);
  } catch(_peE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_peE, 'endTurn] clear _pendingEdict') : console.warn('[endTurn] clear _pendingEdict', _peE); }

  // Phase 0-0b·兜底 sweep：清死亡/消失角色遗留 holder（防 character:death 事件漏发）
  try {
    if (typeof _offSweepGhostHolders === 'function') {
      var _swR = _offSweepGhostHolders();
      if (_swR && _swR.swept && _swR.swept.length > 0) {
        console.log('[endTurn] ghost holder sweep:', _swR.swept.length, '条');
        if (!GM._edictTracker) GM._edictTracker = [];
        _swR.swept.forEach(function(g){
          GM._edictTracker.push({
            id: 'vacancy_sweep_' + Date.now() + '_' + g.name + '_' + g.pos,
            content: g.dept + '\u00B7' + g.pos + '\u00B7' + g.name + ' \u5DF2\u975E\u5728\u4E16\u00B7\u804C\u4F4D\u81EA\u52A8\u7F3A\u5458\u3002',
            category: '官缺', turn: GM.turn || 0, status: 'pending',
            _vacancyFromSweep: g
          });
        });
      }
    }
  } catch(_swE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_swE, 'endTurn] ghost sweep') : console.warn('[endTurn] ghost sweep', _swE); }

  // Phase 0-0c·NPC 势力自动补任·扫外部派系控制的空缺官职·AI 代替 NPC 提名
  try {
    if (typeof _npcAutoAppointVacancies === 'function') {
      var _napR = _npcAutoAppointVacancies();
      if (_napR && _napR.appointed && _napR.appointed.length > 0) {
        if (!GM._chronicle) GM._chronicle = [];
        _napR.appointed.forEach(function(a){
          GM._chronicle.push({
            turn: GM.turn || 0, date: GM._gameDate || '',
            type: 'NPC\u4EFB\u547D',
            text: a.faction + ' \u5185\u90E8\u4EFB\u547D\uFF1A' + a.dept + '\u00B7' + a.pos + ' \u4EE5 ' + a.charName + ' \u5145\u3002',
            tags: ['官职','NPC','任命']
          });
        });
      }
    }
  } catch(_napE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_napE, 'endTurn] npc auto-appoint') : console.warn('[endTurn] npc auto-appoint', _napE); }

  // Phase 0-0: 提交本回合所有奏疏决定的副作用（NPC 记忆 + 朱批回传）
  try { if (typeof _commitMemorialDecisions === 'function') _commitMemorialDecisions(); } catch(_cmE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_cmE, 'endTurn] _commitMemorialDecisions') : console.warn('[endTurn] _commitMemorialDecisions', _cmE); }

  // Phase 0-1: 初始化 + 收集输入
  var npcContext = _endTurn_init();
  var input = _endTurn_collectInput();
  var edicts=input.edicts, xinglu=input.xinglu, memRes=input.memRes, oldVars=input.oldVars;

  // 暂存昏君活动供 AI 推演使用
  GM._turnTyrantActivities = input.tyrantActivities || [];

  // Phase 1.7·三系统状态更新(势力/党争/军事)·让 AI 看到最新数值状态
  try {
    if (typeof updateThreeSystemsOnEndTurn === 'function') {
      updateThreeSystemsOnEndTurn();
    }
  } catch(_tseE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_tseE, 'endTurn] 三系统更新失败') : console.warn('[endTurn] 三系统更新失败', _tseE); }

  // Phase 1.75·NPC AI 决策器(每 3 回合·批量势力/党派/将领预规划)
  var _preThreeSystemsP = null;
  var _preLongTermP = null;
  try {
    if (typeof scThreeSystemsAI === 'function') {
      _preThreeSystemsP = Promise.resolve(scThreeSystemsAI()).catch(function(e){
        (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'endTurn] pre three systems AI') : console.warn('[endTurn] pre three systems AI failed', e);
      });
    }
  } catch(_nDE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_nDE, 'endTurn] NPC 决策器失败') : console.warn('[endTurn] NPC 决策器失败', _nDE); }

  // Phase 1.8·长期行动摘要 AI 调用（过回合前读取全部长期诏书+编年·防长期项被推演遗忘）
  try {
    if (typeof aiDigestLongTermActions === 'function' && P.ai && P.ai.key) {
      _preLongTermP = Promise.resolve(aiDigestLongTermActions()).catch(function(e){
        (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'endTurn] long-term digest') : console.warn('[endTurn] long-term digest failed', e);
      });
    }
  } catch(_ltdE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_ltdE, 'endTurn] 长期摘要失败') : console.warn('[endTurn] 长期摘要失败', _ltdE); }

  // Phase 2: AI 推演
  try { if (_preThreeSystemsP) await _preThreeSystemsP; } catch(_nDE2) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_nDE2, 'endTurn] pre three systems AI') : console.warn('[endTurn] pre three systems AI failed', _nDE2); }
  try { if (_preLongTermP) await _preLongTermP; } catch(_ltdE2) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_ltdE2, 'endTurn] long-term digest') : console.warn('[endTurn] long-term digest failed', _ltdE2); }

  var aiResult = await _endTurn_aiInfer(edicts, xinglu, memRes, oldVars);
  var shizhengji=aiResult.shizhengji, zhengwen=aiResult.zhengwen, playerStatus=aiResult.playerStatus, playerInner=aiResult.playerInner||'', turnSummary=aiResult.turnSummary||'';
  // 新增：实录、时政记标题/总结、人事变动、后人戏说
  var shiluText=aiResult.shiluText||'', szjTitle=aiResult.szjTitle||'', szjSummary=aiResult.szjSummary||'';
  var personnelChanges=aiResult.personnelChanges||[], hourenXishuo=aiResult.hourenXishuo||aiResult.zhengwen||'';
  var timeRatio=aiResult.timeRatio;

  // Phase 2.5: AI推演后执行玩家诏令（AI已看到意图并在推演中反应）
  if (input.edictActions && (input.edictActions.appointments.length || input.edictActions.dismissals.length || input.edictActions.deaths.length)) {
    applyEdictActions(input.edictActions);
  }

  // Phase 2.6: 应用昏君活动效果
  var tyrantResult = null;
  if (typeof TyrantActivitySystem !== 'undefined' && GM._turnTyrantActivities && GM._turnTyrantActivities.length > 0) {
    tyrantResult = TyrantActivitySystem.applyEffects(GM._turnTyrantActivities);
  }

  // Phase 3: 系统更新
  var queueResult = await _endTurn_updateSystems(timeRatio, zhengwen);

  // Phase 3.5·御批回听·对玩家诏令执行情况问责(post-inference·2000 tokens)
  try {
    if (typeof aiEdictEfficacyAudit === 'function' && P.ai && P.ai.key) {
      await aiEdictEfficacyAudit(aiResult, edicts);
    }
  } catch(_efE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_efE, 'endTurn] 御批回听失败') : console.warn('[endTurn] 御批回听失败', _efE); }

  // 生成变化报告
  var changeReportHtml = generateChangeReport();
  var changes=[];Object.entries(GM.vars).forEach(function(e){var d=e[1].value-oldVars[e[0]];if(d!==0)changes.push({name:e[0],old:oldVars[e[0]],val:e[1].value,delta:d});});

  // Phase 4: 渲染 + 存档 —— 若后朝仍在进行则延后到朝会结束
  var _renderArgs = [shizhengji, zhengwen, playerStatus, playerInner, edicts, xinglu, oldVars, changeReportHtml, queueResult, aiResult.suggestions, tyrantResult, turnSummary, shiluText, szjTitle, szjSummary, personnelChanges, hourenXishuo];
  if (GM._pendingShijiModal && GM._pendingShijiModal.courtDone === false) {
    // 后朝进行中——暂存 payload，AI 完成但不弹史记；刷新底栏进度绿 banner
    GM._pendingShijiModal.aiReady = true;
    GM._pendingShijiModal.payload = _renderArgs;
    if (typeof _updatePostTurnCourtBanner === 'function') _updatePostTurnCourtBanner('aiReady');
    hideLoading();
  } else {
    _endTurn_render.apply(null, _renderArgs);
    if (GM._pendingShijiModal) { GM._pendingShijiModal.aiReady = false; GM._pendingShijiModal.payload = null; }
  }

  // Phase 4.5: 勤政 streak 结算
  try { if (typeof _settleCourtMeter === 'function') _settleCourtMeter(); } catch(_ccE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_ccE, 'endTurn] courtMeter') : console.warn('[endTurn] courtMeter', _ccE); }

  // Phase 4.6: 角色路程推进·到达自动就任（AI 至高权力·Step 4）
  try { if (typeof advanceCharTravelByDays === 'function') advanceCharTravelByDays((P.time && P.time.daysPerTurn) || 30); } catch(_trvE){ (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_trvE, 'endTurn] char travel tick') : console.warn('[endTurn] char travel tick', _trvE); }

  // Phase 5: 后续钩子——后朝进行中则全部延后（避免 keju 等弹窗覆盖朝会）
  if (GM._pendingShijiModal && GM._pendingShijiModal.courtDone === false) {
    GM._pendingShijiModal.deferredPhase5 = async function() {
      try { await EndTurnHooks.execute('after'); } catch(_ph5e){ (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_ph5e, 'postTurn] phase5 hooks') : console.warn('[postTurn] phase5 hooks', _ph5e); }
      // v5·科举时间化推进（每回合累天数）
      if (P.keju && (P.keju.currentExam || P.keju.currentEnke) && typeof advanceKejuByDays === 'function') {
        try { advanceKejuByDays((P.time && P.time.daysPerTurn) || 30); } catch(_kjA){ (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_kjA, 'postTurn] keju advance') : console.warn('[postTurn] keju advance', _kjA); }
      }
      if (P.keju && P.keju.enabled && !P.keju.currentExam) {
        try { await checkKejuTrigger(); } catch(_kj){ (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_kj, 'postTurn] keju') : console.warn('[postTurn] keju', _kj); }
      }
    };
  } else {
    await EndTurnHooks.execute('after');
    // v5·科举时间化推进
    if (P.keju && (P.keju.currentExam || P.keju.currentEnke) && typeof advanceKejuByDays === 'function') {
      try { advanceKejuByDays((P.time && P.time.daysPerTurn) || 30); } catch(_kjA){ (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_kjA, 'endTurn] keju advance') : console.warn('[endTurn] keju advance', _kjA); }
    }
    if (P.keju && P.keju.enabled && !P.keju.currentExam) {
      await checkKejuTrigger();
    }
  }

  // Phase 5.3: 跨回合记忆摘要（1.3）——每5回合压缩近期事件为200字摘要
  (function _aiMemoryCompress() {
    var interval = 5; // 每5回合压缩一次
    if (GM.turn % interval !== 0 || !P.ai || !P.ai.key) return;
    if (!GM._aiMemorySummaries) GM._aiMemorySummaries = [];

    // 收集近5回合的关键事件
    var _recentEvents = (GM.evtLog || []).filter(function(e) {
      return e.turn > GM.turn - interval;
    }).slice(-30);
    if (_recentEvents.length < 3) return;

    var _evtText = _recentEvents.map(function(e) { return '[' + e.type + '] ' + e.text; }).join('\n');
    var _prevSummary = GM._aiMemorySummaries.length > 0 ? GM._aiMemorySummaries[GM._aiMemorySummaries.length - 1].summary : '';

    // 异步压缩（不阻塞）
    var _compressPrompt = '请将以下游戏事件压缩为200字以内的摘要，格式：「第X-Y回合概要：[关键事件]、[势力变动]、[未解决冲突]、[伏笔]」\n\n'
      + '回合范围：第' + (GM.turn - interval + 1) + '-' + GM.turn + '回合\n'
      + (_prevSummary ? '上一段摘要：' + _prevSummary.slice(-100) + '\n\n' : '')
      + '事件列表：\n' + _evtText + '\n\n请直接输出摘要正文：';

    // 使用callAI而非raw fetch——自动适配所有模型（OpenAI/Anthropic/本地）
    if (typeof callAI === 'function') {
      callAI(_compressPrompt, 500).then(function(txt) {
        if (txt && txt.length > 30) {
          GM._aiMemorySummaries.push({ turn: GM.turn, summary: txt.substring(0, 400) });
          if (GM._aiMemorySummaries.length > 10) GM._aiMemorySummaries = GM._aiMemorySummaries.slice(-10);
          DebugLog.log('ai', '记忆摘要生成完成:', txt.length, '字');
        }
      }).catch(function(err) { DebugLog.warn('ai', '记忆摘要生成失败:', err.message); });
    }
  })();

  // 1.6: 记录回合token消耗·G4 预算检查
  if (typeof TokenUsageTracker !== 'undefined') {
    var _turnTokens = TokenUsageTracker.getTurnUsage();
    if (_turnTokens > 0) DebugLog.log('ai', '本回合token消耗:', _turnTokens);
    // G4·Token 预算预警：若玩家设了单回合预算且超支·给出建议
    if (P.conf.turnTokenBudget && P.conf.turnTokenBudget > 0 && _turnTokens > P.conf.turnTokenBudget) {
      var _ratio = (_turnTokens / P.conf.turnTokenBudget).toFixed(1);
      if (typeof toast === 'function') toast('⚠ 本回合用 ' + _turnTokens.toLocaleString() + ' tokens·超预算 ' + _ratio + '×·建议在设置启用降档模式或减少 NPC 数');
      if (typeof addEB === 'function') addEB('AI预算', '超支 ' + _ratio + '×·考虑压缩 prompt / 换便宜模型 / 减少 NPC');
    }
  }

  // Phase 5.4: 月度纪事异步生成（3.2）
  // 用 turnsForDuration('month') 判断月边界，大回合剧本(>30天/回合)跳过月度层
  (function _monthlyChronicle() {
    var _monthTurns = (typeof turnsForDuration === 'function') ? turnsForDuration('month') : 0;
    var _dpv = (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 30;
    // 月度层仅在一回合≤30天时有意义；大回合(季度/年度)跳过月度层直接走年度
    if (_monthTurns < 1 || _dpv >= 90 || !P.ai || !P.ai.key) return;
    if (GM.turn % _monthTurns !== 0) return;

    var _mCfg = (P.mechanicsConfig && P.mechanicsConfig.chronicleConfig) || {};
    var _wordLimit = _mCfg.monthlyWordLimit || 200;
    var _narrator = _mCfg.narratorRole || '史官';
    var _style = (P.conf && P.conf.style) || '';

    // 收集本月事件
    var _monthEvents = (GM.evtLog || []).filter(function(e) {
      return e.turn > GM.turn - _monthTurns && e.turn <= GM.turn;
    });
    if (_monthEvents.length === 0) return;

    var _monthSummary = _monthEvents.map(function(e) {
      return '[' + e.type + '] ' + e.text;
    }).join('\n');

    // 上月纪事（连贯性）
    var _prevMonthly = '';
    if (GM.monthlyChronicles && GM.monthlyChronicles.length > 0) {
      _prevMonthly = GM.monthlyChronicles[GM.monthlyChronicles.length - 1].text || '';
      _prevMonthly = _prevMonthly.slice(-100);
    }

    // 异步生成（不阻塞回合）
    var _mPrompt = '你是' + (P.dynasty || '') + _narrator + '。'
      + (_style ? '以' + _style + '风格，' : '')
      + '请根据以下本月事件，撰写' + _wordLimit + '字以内的月度纪事。\n\n'
      + '【本月事件】\n' + _monthSummary + '\n';
    if (_prevMonthly) _mPrompt += '\n【上月纪事末尾】' + _prevMonthly + '\n';
    _mPrompt += '\n请直接输出纪事正文（不要JSON包裹）：';

    // 异步调用，不await——不阻塞后续逻辑
    var _mUrl = P.ai.url;
    if (_mUrl.indexOf('/chat/completions') < 0) _mUrl = _mUrl.replace(/\/+$/, '') + '/chat/completions';
    fetch(_mUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + P.ai.key },
      body: JSON.stringify({
        model: P.ai.model || 'gpt-4o',
        messages: [
          { role: 'system', content: '你是' + (P.dynasty || '') + _narrator },
          { role: 'user', content: _mPrompt }
        ],
        temperature: 0.7,
        max_tokens: Math.min(800, _wordLimit * 3)
      })
    }).then(function(resp) {
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      return resp.json();
    }).then(function(j) {
      var txt = (j.choices && j.choices[0] && j.choices[0].message) ? j.choices[0].message.content : '';
      if (txt && txt.length > 20) {
        if (!GM.monthlyChronicles) GM.monthlyChronicles = [];
        GM.monthlyChronicles.push({
          turn: GM.turn,
          date: (typeof getTSText === 'function') ? getTSText(GM.turn) : 'T' + GM.turn,
          text: txt.substring(0, _wordLimit * 2),
          generatedAt: Date.now()
        });
        // 保留最近24个月
        if (GM.monthlyChronicles.length > 24) GM.monthlyChronicles = GM.monthlyChronicles.slice(-24);
        DebugLog.log('settlement', '月度纪事生成完成:', txt.length, '字');
      }
    }).catch(function(err) {
      // 失败fallback：用事件日志直接拼接
      DebugLog.warn('settlement', '月度纪事AI生成失败，使用事件拼接:', err.message);
      if (!GM.monthlyChronicles) GM.monthlyChronicles = [];
      var fallbackText = _monthEvents.map(function(e) { return e.text; }).join('\u3002') + '\u3002';
      GM.monthlyChronicles.push({
        turn: GM.turn,
        date: (typeof getTSText === 'function') ? getTSText(GM.turn) : 'T' + GM.turn,
        text: fallbackText.substring(0, _wordLimit),
        generatedAt: Date.now(),
        isFallback: true
      });
    });
  })();

  // Phase 5.5: 年度汇总（跨年时触发）——统一委托给 ChronicleSystem
  if (typeof isYearBoundary === 'function' && isYearBoundary()) {
    // 重置事件年度计数
    if (typeof EventConstraintSystem !== 'undefined') EventConstraintSystem.resetYearlyCounts();
    // 年度编年史由 ChronicleSystem._tryGenerateYearChronicle 异步生成（含6.1伏笔/6.5摘要整合）
    // 不在此处重复生成——ChronicleSystem.addMonthDraft 的跨年检测会自动触发
    _dbg('[Chronicle] \u8DE8\u5E74\u68C0\u6D4B\uFF0C\u5E74\u5EA6\u7F16\u5E74\u53F2\u7531ChronicleSystem\u5F02\u6B65\u751F\u6210');
  }

  // 清理回合临时上下文
  delete GM._turnContext;
  delete GM._turnTyrantActivities;
  if (!GM._postTurnJobs || !Array.isArray(GM._postTurnJobs.pending) || GM._postTurnJobs.pending.length === 0) {
    delete GM._turnAiResults;
  }

  // 玩家角色死亡 → 显示游戏结束画面
  if (GM._playerDead) {
    GM.busy = false;
    GM.running = false;
    var _pdName = P.playerInfo ? P.playerInfo.characterName : '玩家';
    var _pdReason = GM._playerDeathReason || '不明原因';
    var _pdHtml = '<div style="text-align:center;padding:3rem 2rem;">';
    _pdHtml += '<div style="font-size:2.5rem;color:var(--red,#c44);margin-bottom:1rem;">天命已尽</div>';
    _pdHtml += '<div style="font-size:1.1rem;color:var(--txt-s);margin-bottom:0.5rem;">' + escHtml(_pdName) + ' 薨逝</div>';
    _pdHtml += '<div style="font-size:0.9rem;color:var(--txt-d);margin-bottom:2rem;">' + escHtml(_pdReason) + '</div>';
    _pdHtml += '<div style="font-size:0.85rem;color:var(--txt-d);margin-bottom:2rem;">历经 ' + GM.turn + ' 回合 · ' + getTSText(GM.turn) + '</div>';
    _pdHtml += '<div style="display:flex;gap:1rem;justify-content:center;">';
    _pdHtml += '<button class="bt bp" onclick="doSaveGame()">保存存档</button>';
    _pdHtml += '<button class="bt bs" onclick="showMain()">返回主菜单</button>';
    _pdHtml += '</div></div>';
    showTurnResult(_pdHtml);
    delete GM._playerDead;
    delete GM._playerDeathReason;
    return;
  }

  // 回合结束前最后一次聚合：确保 七变量(national) 严格等于 各区划叶子之和
  // （因 AI 推演/各 engine.tick 都可能修改 division.population.mouths，需重新累计）
  try { if (typeof IntegrationBridge !== 'undefined' && typeof IntegrationBridge.aggregateRegionsToVariables === 'function') IntegrationBridge.aggregateRegionsToVariables(); } catch(_aggFinalE) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_aggFinalE, 'endTurn] final aggregate') : console.warn('[endTurn] final aggregate', _aggFinalE); }

  GM.busy=false;
  GM._endTurnBusy=false;
  } catch (error) {
    console.error('endTurn error:', error);
    toast('回合处理出错: ' + error.message);
    GM.busy = false;
    GM._endTurnBusy=false;
    var btn = _$("btn-end")||_$("btn-end-turn");
    if (btn) {
      btn.textContent = "\u9759\u5F85\u65F6\u53D8";
      btn.style.opacity = "1";
    }
    hideLoading();
  }
}

// ══════ 史记+起居注列表渲染已迁移到 tm-shiji-qiju-ui.js (R97) ══════
// - var _sjl*/_qiju* 状态变量
// - renderShijiList / _sjlExtractDeltas / _sjlExport / _sjlDownload
// - _qijuNormalize / _qijuCatClass / _qijuCatKey / _qijuHighlight
// - renderQiju / _qijuAnnotate / _qijuZoom / _qijuExport / _qijuDownload
// ═══════════════════════════════════════════════════════

// ============================================================
//  Part 3：高级系统
// ============================================================

// ══════ 侧栏面板 UI 已迁移到 tm-sidebar-ui.js (R99) ══════
// - enterGame:after hook 重渲染 renderSidePanels
// - renderGameTech / unlockTech / renderGameCivic / adoptCivic
// - openClassDetailPanel / openPartyDetailPanel / openMilitaryDetailPanel
// - renderSidePanels (侧栏主渲染)
// - openPalacePanel + 6 _palace* 辅助
// ═══════════════════════════════════════════════════════

// ============================================================
//  注册 endTurn 钩子（替代原有的包装链）
// ============================================================

// 钩子 1: 官制消耗（原 _origEndTurn）
EndTurnHooks.register('before', function() {
  if(P.officeConfig&&P.officeConfig.costVariables&&P.officeConfig.costVariables.length>0&&GM.officeTree){
    var td=0,to=0;
    function countOff(tree){tree.forEach(function(d){td++;to+=(d.positions||[]).filter(function(p){return p.holder;}).length;if(d.subs)countOff(d.subs);});}
    countOff(GM.officeTree);
    var shortfall=[];
    P.officeConfig.costVariables.forEach(function(cv){
      var cost=(cv.perDept||0)*td+(cv.perOfficial||0)*to;
      if(GM.vars[cv.variable]){
        GM.vars[cv.variable].value=clamp(GM.vars[cv.variable].value-cost,GM.vars[cv.variable].min,GM.vars[cv.variable].max);
        if(GM.vars[cv.variable].value<=GM.vars[cv.variable].min+5)shortfall.push(cv.variable);
      }
    });
    if(shortfall.length>0)addEB("官制危机",shortfall.join(",")+"不足");
  }
}, '官制消耗');

// 钩子 2: 奏议批复（原 _origEndTurn2）
EndTurnHooks.register('before', function() {
  if(GM.memorials&&GM.memorials.length>0){
    GM.memorials.forEach(function(m){
      var statusText=m.status==="approved"?"准奏":m.status==="rejected"?"驳回":"未批复";
      var exists=GM.jishiRecords.find(function(r){return r.turn===GM.turn&&r.char===m.from&&r.playerSaid&&r.playerSaid.indexOf("奏疏")>=0;});
      if(!exists)GM.jishiRecords.push({turn:GM.turn,char:m.from,playerSaid:"\u594F\u758F("+m.type+"): "+m.content,npcSaid:"\u6279\u590D: "+statusText+(m.reply?" | "+m.reply:"")});
    });
    renderJishi();
  }
}, '奏议批复');

// 钩子 3: AI上下文注入 - 剧本文风（原 _origEndTurn3）
EndTurnHooks.register('before', function() {
  if(P.ai.key){
    GM._origPrompt=P.ai.prompt;
    var fullPrompt=P.ai.prompt||DEFAULT_PROMPT;
    var sc=findScenarioById(GM.sid);

    if(sc&&sc.scnStyle)fullPrompt+="\n本剧本文风: "+sc.scnStyle;
    if(sc&&sc.scnStyleRule)fullPrompt+="\n文风规则: "+sc.scnStyleRule;
    // 4.3b: 文风指令映射
    var _styleMap = {
      '文学化': '文辞优美，善用比喻和意象，情感充沛',
      '史书体': '仿《资治通鉴》纪事本末体，言简意赅，重事实轻渲染',
      '戏剧化': '矛盾冲突尖锐，人物对话生动，善用悬念和反转',
      '章回体': '仿《三国演义》章回体小说，每段开头可用对仗回目，文白夹杂',
      '纪传体': '仿《史记》纪传体，以人物为中心，"太史公曰"式评论',
      '白话文': '现代白话文风格，通俗易懂，节奏明快'
    };
    if(P.conf.style&&_styleMap[P.conf.style])fullPrompt+="\n叙事文风: "+_styleMap[P.conf.style];
    if(P.conf.customStyle)fullPrompt+="\n自定义文风: "+P.conf.customStyle;

    if(sc&&sc.refText)fullPrompt+="\n\u53C2\u8003: "+sc.refText;
    if(P.conf.refText)fullPrompt+="\n\u5168\u5C40\u53C2\u8003: "+P.conf.refText;

    if(P.world.entries&&P.world.entries.length>0){
      fullPrompt+="\n\n=== 世界设定 ===";
      P.world.entries.forEach(function(e){
        if(e.category&&e.title&&e.content)fullPrompt+="\n["+e.category+"] "+e.title+": "+e.content;
      });
    }

    P.ai.prompt=fullPrompt;
  }
}, 'AI上下文-剧本文风');

// 钩子 4: 恢复原始prompt
EndTurnHooks.register('after', function() {
  if(GM._origPrompt!==undefined){
    P.ai.prompt=GM._origPrompt;
    delete GM._origPrompt;
  }
}, '恢复原始prompt');

// 钩子 5: AI上下文注入 - 起居注（原 _origEndTurn5）
EndTurnHooks.register('before', function() {
  if(P.ai.key&&GM.conv.length>0){
    var qijuLb=P.conf.qijuLookback||5;
    var recentQ=GM.qijuHistory.slice(-qijuLb);
    if(recentQ.length>0){
      var qijuText="\n\n=== 近"+qijuLb+"回合起居注 ===\n";
      recentQ.forEach(function(q){
        qijuText+="T"+q.turn+" "+q.time+":\n";
        if(q.edicts){
          if(q.edicts.political)qijuText+="  政: "+q.edicts.political+"\n";
          if(q.edicts.military)qijuText+="  军: "+q.edicts.military+"\n";
          if(q.edicts.diplomatic)qijuText+="  外: "+q.edicts.diplomatic+"\n";
          if(q.edicts.economic)qijuText+="  经: "+q.edicts.economic+"\n";
        }
        if(q.xinglu)qijuText+="  行: "+q.xinglu+"\n";
      });
      if(!GM._origPrompt2)GM._origPrompt2=P.ai.prompt;
      P.ai.prompt=(P.ai.prompt||"")+qijuText;
    }
  }
}, 'AI上下文-起居注');

// 钩子 6: 恢复prompt
EndTurnHooks.register('after', function() {
  if(GM._origPrompt2!==undefined){
    P.ai.prompt=GM._origPrompt2;
    delete GM._origPrompt2;
  }
}, '恢复prompt-起居注');

// 钩子 6.5: AI 上下文注入 - 史记 N 回合(shijiLookback 唤醒)
EndTurnHooks.register('before', function() {
  if (P.ai && P.ai.key && GM.shijiHistory && GM.shijiHistory.length > 0) {
    var shijiLb = (P.conf && P.conf.shijiLookback) || 5;
    var recentS = GM.shijiHistory.slice(-shijiLb);
    if (recentS.length > 0) {
      var shijiText = "\n\n=== 近" + shijiLb + "回合史记·时政记/正文摘要 ===\n";
      recentS.forEach(function(s) {
        shijiText += "T" + (s.turn || '?') + "·" + (s.time || '') + "\n";
        if (s.szjTitle) shijiText += "  题：" + s.szjTitle + "\n";
        if (s.shizhengji) shijiText += "  政：" + String(s.shizhengji).replace(/\s+/g, ' ').slice(0, 280) + "\n";
        if (s.turnSummary) shijiText += "  要：" + String(s.turnSummary).slice(0, 120) + "\n";
      });
      if (!GM._origPromptShiji) GM._origPromptShiji = P.ai.prompt;
      P.ai.prompt = (P.ai.prompt || "") + shijiText;
    }
  }
}, 'AI上下文-史记');

EndTurnHooks.register('after', function() {
  if (GM._origPromptShiji !== undefined) {
    P.ai.prompt = GM._origPromptShiji;
    delete GM._origPromptShiji;
  }
}, '恢复prompt-史记');

// 钩子 6.6: AI 上下文注入 - 玩家总结规则(summaryRule 唤醒)
EndTurnHooks.register('before', function() {
  if (P.ai && P.ai.key && P.conf && P.conf.summaryRule && String(P.conf.summaryRule).trim()) {
    if (!GM._origPromptSumRule) GM._origPromptSumRule = P.ai.prompt;
    P.ai.prompt = (P.ai.prompt || "") + "\n\n=== 玩家总结风格与特殊指令（优先级高） ===\n" + P.conf.summaryRule.trim() + "\n——按此风格/指令总结本回合shizhengji/zhengwen·不得违背。";
  }
}, 'AI上下文-玩家总结规则');

EndTurnHooks.register('after', function() {
  if (GM._origPromptSumRule !== undefined) {
    P.ai.prompt = GM._origPromptSumRule;
    delete GM._origPromptSumRule;
  }
}, '恢复prompt-总结规则');

// 钩子 6.7: AI 上下文注入 - 近期鸿雁传书摘要(letter 内容影响推演)
EndTurnHooks.register('before', function() {
  if (P.ai && P.ai.key && Array.isArray(GM.letters) && GM.letters.length > 0) {
    var curT = GM.turn || 1;
    // 近 3 回合往来信件·含玩家去信+NPC 来信
    var recentLs = GM.letters.filter(function(l) {
      return l && (curT - (l.sentTurn || l.deliveryTurn || 0)) <= 3;
    }).slice(-10);
    if (recentLs.length > 0) {
      var lettersText = "\n\n=== 近期鸿雁传书摘要（推演需延续其情·不可忘）===\n";
      recentLs.forEach(function(l) {
        var dir = l._npcInitiated ? (l.from + '→皇帝') : ('皇帝→' + l.to);
        var typeL = (l.letterType || 'personal');
        var urg = l.urgency === 'extreme' ? '(八百里加急)' : l.urgency === 'urgent' ? '(加急)' : '';
        var sentAt = 'T' + (l.sentTurn || '?');
        lettersText += '[' + sentAt + '·' + dir + '·' + typeL + urg + '] ';
        if (l.subjectLine) lettersText += '《' + l.subjectLine.slice(0, 26) + '》';
        lettersText += ' 内容摘：' + String(l.content || '').replace(/\s+/g, ' ').slice(0, 140);
        if (l.reply && !l._npcInitiated) lettersText += '·[回：' + String(l.reply).slice(0, 80) + ']';
        if (l.suggestion) lettersText += '·建：' + String(l.suggestion).slice(0, 60);
        lettersText += '\n';
      });
      if (!GM._origPromptLtr) GM._origPromptLtr = P.ai.prompt;
      P.ai.prompt = (P.ai.prompt || "") + lettersText;
    }
  }
}, 'AI上下文-鸿雁传书摘要');

EndTurnHooks.register('after', function() {
  if (GM._origPromptLtr !== undefined) {
    P.ai.prompt = GM._origPromptLtr;
    delete GM._origPromptLtr;
  }
}, '恢复prompt-鸿雁');

// 钩子 7: AI上下文注入 - 规则（原 _origEndTurn6）
EndTurnHooks.register('before', function() {
  if(P.ai.key&&P.ai.rules){
    if(!GM._origPrompt3)GM._origPrompt3=P.ai.prompt;
    P.ai.prompt=(P.ai.prompt||"")+"\n\n=== 规则 ===\n"+P.ai.rules;
  }
}, 'AI上下文-规则');

// 钩子 8: 恢复prompt
EndTurnHooks.register('after', function() {
  if(GM._origPrompt3!==undefined){
    P.ai.prompt=GM._origPrompt3;
    delete GM._origPrompt3;
  }
}, '恢复prompt-规则');

// 钩子 9: 历史检查（原 _origEndTurn7）
EndTurnHooks.register('after', async function() {
  var mode=P.conf.gameMode||"yanyi";
  if(mode==="yanyi"||!P.ai.key)return;

  var sc=findScenarioById(GM.sid);
  if(!sc)return;

  showLoading("历史检查...",50);
  try{
    var checkPrompt="检查以下推演是否符合历史。时代:"+sc.era+" 角色:"+sc.role+"\n";
    if(GM.shijiHistory&&GM.shijiHistory.length>0){
      var latest=GM.shijiHistory[GM.shijiHistory.length-1];
      checkPrompt+="\u63A8\u6F14: "+(latest.zhengwen||"");
    }
    if(mode==="strict_hist"&&P.conf.refText)checkPrompt+="\n\u53C2\u8003: "+P.conf.refText;
    checkPrompt+="\n返回JSON:{\"accurate\":true/false,\"issues\":[],\"historical_note\":\"\"}";

    var resp=await callAISmart(checkPrompt,500,{temperature:0.3,maxRetries:2,validator:function(c){try{var j=extractJSON(c);return j&&typeof j.accurate==='boolean';}catch(e){return false;}}});
    var parsed=extractJSON(resp);
    if(parsed&&!parsed.accurate){
      var msg="历史偏离: "+(parsed.historical_note||"");
      if(parsed.issues&&parsed.issues.length>0)msg+="\n问题: "+parsed.issues.join("; ");
      addEB("史实检查",msg);
    }
  }catch(e){
    console.warn("历史检查失败:",e);
  }
}, '历史检查');

// 钩子 10: 音效（原 _origEndTurn - 音频系统）
EndTurnHooks.register('after', function() {
  if(typeof AudioSystem !== 'undefined' && AudioSystem.playSfx) {
    AudioSystem.playSfx('turnEnd');
  }
}, '回合结束音效');

// 钩子 11: 游戏模式注入（原 _origEndTurn11）
EndTurnHooks.register('before', function() {
  var mode = (typeof P !== 'undefined' && P.conf && P.conf.gameMode) || 'yanyi';
  var origPrompt = (typeof P !== 'undefined' && P.ai && P.ai.prompt != null) ? P.ai.prompt : null;

  if (origPrompt !== null) {
    GM._origPrompt11 = origPrompt;
    var modePrefix = '';
    if (mode === 'yanyi') {
      modePrefix = '【演义模式】请以演义小说风格推演，允许虚构情节和战征细节，强调戳剧冲突。';
    } else if (mode === 'light_hist') {
      modePrefix = '【轻度史实模式】请大体符合历史走向，允许适度演绎，主要人物和事件应有史实依据。';
    } else if (mode === 'strict_hist') {
      var refText = (P.conf && P.conf.refText) ? P.conf.refText : '';
      modePrefix = '\u3010\u4E25\u683C\u53F2\u5B9E\u6A21\u5F0F\u3011\u8BF7\u4E25\u683C\u6309\u6B63\u53F2\u63A8\u6F14\uFF0C\u4E0D\u5F97\u865A\u6784\u4EBA\u7269\u6216\u4E8B\u4EF6\uFF0C\u8BF7\u51C6\u786E\u5F15\u7528\u53F2\u4E66\u8BB0\u8F7D\u3002' + (refText ? '\u53C2\u8003\u8D44\u6599\uFF1A' + refText + '\u3002' : '');
    }
    if (modePrefix) {
      P.ai.prompt = modePrefix + origPrompt;
    }
  }
}, '游戏模式注入');

// 钩子 12: 恢复prompt
EndTurnHooks.register('after', function() {
  if(GM._origPrompt11!==undefined){
    P.ai.prompt=GM._origPrompt11;
    delete GM._origPrompt11;
  }
}, '恢复prompt-游戏模式');

// 钩子 13: 处理AI返回的高级系统变更（原 _origEndTurn 的 after 部分）
EndTurnHooks.register('after', function() {
  if(GM.conv.length>0){
    var lastMsg=GM.conv[GM.conv.length-1];
    if(lastMsg.role==="assistant"&&lastMsg.content){
      try{
            var parsed=extractJSON(lastMsg.content);
            if(parsed){

            // 阶层变化
            if(parsed.class_changes){Object.entries(parsed.class_changes).forEach(function(e){var cls=findClassByName(e[0]);if(cls&&typeof e[1]==="object"&&e[1].influence!=null)cls.influence=clamp(cls.influence+(e[1].influence||0),0,100);});}

            // 党派变化
            if(parsed.party_changes){Object.entries(parsed.party_changes).forEach(function(e){var party=findPartyByName(e[0]);if(party&&typeof e[1]==="object"){if(e[1].strength!=null)party.strength=clamp(party.strength+(e[1].strength||0),0,100);}});}

            // 新角色
            if(parsed.new_characters&&Array.isArray(parsed.new_characters)){
              parsed.new_characters.forEach(function(nc){
                if(!nc.name)return;
                var exists=(GM.allCharacters||[]).find(function(c){return c.name===nc.name;});
                if(!exists){
                  GM.allCharacters.push({name:nc.name,title:nc.title||"",age:nc.age||"?",gender:nc.gender||"男",personality:nc.personality||"",appearance:nc.appearance||"",desc:nc.desc||"",loyalty:nc.loyalty||50,relationValue:nc.relation_value||50,faction:nc.faction||"",recruited:nc.recruited||false,recruitTurn:GM.turn-1,source:nc.source||"推演出现",avatarUrl:""});
                  if(nc.recruited){
                    var newChar = {name:nc.name,title:nc.title||"",desc:nc.desc||"",stats:{},stance:"",playable:false,personality:nc.personality||"",appearance:"",skills:[],loyalty:nc.loyalty||50,morale:70,dialogues:[],secret:"",faction:nc.faction||"",aiPersonaText:"",behaviorMode:"",valueSystem:"",speechStyle:"",rels:[]};
                    GM.chars.push(newChar);
                    addToIndex('char', newChar.name, newChar);
                  }
                  addEB("人物",nc.name+(nc.recruited?" 已招":"出现"));
                }
              });
            }

            // 角色更新
            if(parsed.char_updates){Object.entries(parsed.char_updates).forEach(function(e){var ch=findCharByName(e[0]);if(ch&&typeof e[1]==="object"){if(e[1].loyalty!=null)ch.loyalty=e[1].loyalty;if(e[1].desc)ch.desc=e[1].desc;}var ac=(GM.allCharacters||[]).find(function(c){return c.name===e[0];});if(ac&&typeof e[1]==="object"&&e[1].loyalty!=null){ac.loyalty=e[1].loyalty;ac.relationValue=e[1].loyalty;}});}
          }
      }catch(e){ console.warn("[catch] 静默异常:", e.message || e); }
    }
  }

  // 更新高级面板
  renderGameTech();renderGameCivic();renderRenwu();
  renderLeftPanel();renderGameState();renderSidePanels();
}, '处理AI高级系统变更');

// 钩子 14: 播放回合结束音效
EndTurnHooks.register('before', function() {
  if(typeof AudioSystem !== 'undefined' && AudioSystem.playSfx) {
    AudioSystem.playSfx('turnEnd');
  }
}, '播放音效');

// ============================================================
//  旧的包装链（已废弃，保留用于向后兼容）
// ============================================================

// _origEndTurn* 包装链已全部删除（已迁移到 EndTurnHooks 系统）

// ============================================================
//  推演时打包所有高级系统数据
// ============================================================
// 注意：此包装层已废弃，功能已迁移到 EndTurnHooks 系统
// 保留此注释用于标记原有代码位置

// ============================================================
//  史记中记录高级系统变化
// ============================================================
// 已在endTurn的史记HTML中包含基础数值变化
// 高级系统变化通过addEB写入大事记，间接记录到史记

// ============================================================
//  游戏模式标识
// ============================================================
// renderGameState 增强：游戏模式徽章 + 小地图（合并两次装饰，避免多层包装链）
GameHooks.on('renderGameState:after', function(){
  var gl=_$("gl");if(!gl)return;
  // 游戏模式徽章
  var mode=P.conf.gameMode||"yanyi";
  var label={yanyi:"\u6F14\u4E49",light_hist:"\u8F7B\u5EA6\u53F2\u5B9E",strict_hist:"\u4E25\u683C\u53F2\u5B9E"}[mode]||"\u6F14\u4E49";
  var color={yanyi:"var(--blue)",light_hist:"var(--gold)",strict_hist:"var(--red)"}[mode]||"var(--blue)";
  var existing=gl.querySelector("#mode-badge");
  if(!existing){
    var badge=document.createElement("div");badge.id="mode-badge";badge.style.cssText="text-align:center;margin-bottom:0.5rem;";
    badge.innerHTML="<span style=\"font-size:0.65rem;padding:0.15rem 0.5rem;border-radius:10px;background:rgba(0,0,0,0.3);color:"+color+";border:1px solid "+color+";\">"+label+"</span>";
    gl.insertBefore(badge,gl.firstChild);
  }
  // 小地图
  if(!_$("g-minimap")){
    var mapDiv=document.createElement("div");mapDiv.style.marginTop="0.8rem";
    mapDiv.innerHTML="<div class=\"pt\">\u5730\u56FE</div><div style=\"border:1px solid var(--bdr);border-radius:5px;overflow:hidden;\"><canvas id=\"g-minimap\" width=\"240\" height=\"160\"></canvas></div>";
    gl.appendChild(mapDiv);
  }
  drawMinimap();
});

// ============================================================
//  完成初始化
// ============================================================
// 所有代码加载完毕，显示启动界面
(function(){
  _$("launch").style.display="flex";
  var lt=_$("lt-title");
  if(lt&&P.conf&&P.conf.gameTitle)lt.textContent=P.conf.gameTitle;
})();

// 回复我获取Part 2（游戏引擎）
// ============================================================
