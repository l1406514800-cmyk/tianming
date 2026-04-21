/*
 * tm-three-systems-ui.js
 * 三大系统升级·波4 UI 面板 + 结构化诏书工具箱
 *
 * 1. 覆盖/增强 openPartyDetailPanel + openMilitaryDetailPanel
 * 2. 新增 openForcesRelationsPanel (势力+外交关系)
 * 3. 新增结构化诏书 handlers·生成 _edictTracker 条目+写编年
 */
(function(global){
  'use strict';

  // ─── 辅助 ───
  function esc(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function _openModal(title, html, onSave) {
    if (typeof openGenericModal === 'function') {
      openGenericModal(title, html, onSave || null);
    } else {
      alert(title + '\n' + html.replace(/<[^>]+>/g, ''));
    }
  }
  function _toast(m) { if (typeof toast === 'function') toast(m); }
  function _pushEdict(content, category) {
    if (!global.GM) return false;
    if (!GM._edictTracker) GM._edictTracker = [];
    var id = 'ts_' + Date.now() + '_' + Math.random().toString(36).slice(2,6);
    GM._edictTracker.push({
      id: id, content: content, category: category || '三系统',
      turn: GM.turn || 0, status: 'pending',
      assignee: '', feedback: '', progressPercent: 0
    });
    // 编年
    if (!GM._chronicle) GM._chronicle = [];
    GM._chronicle.push({
      turn: GM.turn || 0, date: GM._gameDate || '',
      type: category || '诏书',
      text: content.slice(0, 120),
      tags: ['诏书', category || '三系统']
    });
    return id;
  }
  function _phaseColor(phase) {
    if (phase === 'consolidating') return 'var(--green)';
    if (phase === 'stable') return 'var(--gold)';
    if (phase === 'strained') return 'var(--amber, #e0a040)';
    if (phase === 'declining') return 'var(--red-s, #b04030)';
    if (phase === 'collapsing') return 'var(--red, #c03030)';
    return 'var(--txt-d)';
  }
  function _phaseLabel(phase) {
    var m = {consolidating:'上升',stable:'稳定',strained:'紧张',declining:'衰退',collapsing:'崩溃',rising:'上升'};
    return m[phase] || (phase || '稳定');
  }

  // ══════════════════════════════════════════════════════════════════════
  //  势力+外交面板
  // ══════════════════════════════════════════════════════════════════════
  function openForcesRelationsPanel() {
    if (!global.GM || !Array.isArray(GM.facs) || GM.facs.length === 0) { _toast('暂无势力数据'); return; }
    if (typeof ThreeSystemsExt !== 'undefined' && ThreeSystemsExt.buildProvinceOwnerIndex) ThreeSystemsExt.buildProvinceOwnerIndex();
    var playerFac = (global.P && P.playerInfo && P.playerInfo.factionName) || '';

    var html = '<div style="padding:0.8rem;max-height:78vh;overflow-y:auto;">';
    html += '<div style="font-size:0.8rem;color:var(--txt-d);margin-bottom:0.8rem;">当前势力运行时态·绿=上升 金=稳定 琥珀=紧张 红=衰退/崩溃</div>';

    // 势力列表
    GM.facs.forEach(function(f) {
      if (!f || !f.name) return;
      var isPlayer = f.name === playerFac;
      var phase = f.lifePhase || 'stable';
      var prov = [];
      if (typeof getFactionProvinces === 'function') prov = getFactionProvinces(f.name);
      var provCount = prov.length;

      html += '<div style="background:var(--bg-2);border-radius:8px;padding:0.8rem;margin-bottom:0.7rem;border-left:4px solid '+_phaseColor(phase)+';">';
      // 头
      html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">';
      html += '<div><span style="font-weight:700;font-size:1rem;color:'+(f.color||'var(--gold)')+';">'+esc(f.name)+'</span>';
      if (isPlayer) html += ' <span style="font-size:0.7rem;color:var(--gold);background:rgba(201,168,76,0.15);padding:1px 6px;border-radius:3px;">本朝</span>';
      if (f._collapsing) html += ' <span style="font-size:0.7rem;color:var(--red);background:rgba(200,50,50,0.15);padding:1px 6px;border-radius:3px;">濒崩</span>';
      html += ' <span style="font-size:0.72rem;color:'+_phaseColor(phase)+';margin-left:6px;">【'+_phaseLabel(phase)+'】</span>';
      html += '</div>';
      html += '<div style="font-size:0.76rem;color:var(--txt-d);">领袖: '+esc(f.leader||'无')+'</div>';
      html += '</div>';
      // 数值网格
      html += '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:0.5rem;font-size:0.76rem;margin-bottom:0.5rem;">';
      html += '<div><div style="color:var(--txt-d);">实力</div><div style="font-weight:600;">'+(f.strength||0)+'</div></div>';
      html += '<div><div style="color:var(--txt-d);">合法性</div><div style="font-weight:600;">'+(f.legitimacy||0)+'</div></div>';
      html += '<div><div style="color:var(--txt-d);">人口</div><div style="font-weight:600;">'+(f.population||0)+'</div></div>';
      html += '<div><div style="color:var(--txt-d);">民心</div><div style="font-weight:600;">'+(f.morale||0)+'</div></div>';
      html += '<div><div style="color:var(--txt-d);">稳定</div><div style="font-weight:600;">'+(f.stability||0)+'</div></div>';
      html += '</div>';
      // 领地/外交
      var extras = [];
      if (provCount > 0) extras.push('领地 '+provCount+' 处' + (provCount <= 4 ? ': '+prov.join('、') : ''));
      if (f.diplomacyStance) extras.push('外交: '+f.diplomacyStance);
      if (f.suzerainFaction) extras.push('宗主: '+f.suzerainFaction);
      if (Array.isArray(f.vassals) && f.vassals.length) extras.push('附庸: '+f.vassals.join('、'));
      if (f.ideology || f.culture) extras.push('意识: '+(f.ideology||f.culture));
      if (extras.length) {
        html += '<div style="font-size:0.74rem;color:var(--txt-s);margin-bottom:0.5rem;">'+esc(extras.join(' · '))+'</div>';
      }
      // 动作按钮（仅非玩家势力）
      if (!isPlayer) {
        html += '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;">';
        html += '<button class="bt bs" onclick="_tsDeclareWar(\''+esc(f.name)+'\')" style="font-size:0.72rem;padding:0.3rem 0.7rem;background:rgba(200,50,50,0.15);border-color:var(--red,#b04030);">宣战</button>';
        html += '<button class="bt bs" onclick="_tsProposePeace(\''+esc(f.name)+'\')" style="font-size:0.72rem;padding:0.3rem 0.7rem;">议和</button>';
        html += '<button class="bt bs" onclick="_tsGrantVassal(\''+esc(f.name)+'\')" style="font-size:0.72rem;padding:0.3rem 0.7rem;">册封附庸</button>';
        html += '<button class="bt bs" onclick="_tsTribute(\''+esc(f.name)+'\')" style="font-size:0.72rem;padding:0.3rem 0.7rem;">遣使通好</button>';
        html += '</div>';
      }
      html += '</div>';
    });

    // 关系矩阵(简化为邻接表)
    if (Array.isArray(GM.factionRelations) && GM.factionRelations.length > 0) {
      html += '<div style="margin-top:1rem;padding-top:0.8rem;border-top:1px solid var(--bd,rgba(255,255,255,0.1));">';
      html += '<div style="font-weight:600;margin-bottom:0.5rem;">势力关系矩阵</div>';
      html += '<div style="font-size:0.75rem;line-height:1.7;">';
      GM.factionRelations.slice(0, 30).forEach(function(r) {
        if (!r || !r.from || !r.to) return;
        var typeColor = r.type === 'war' ? 'var(--red)' : r.type === 'alliance' ? 'var(--green)' : r.type === 'vassal' ? 'var(--purple)' : 'var(--txt-s)';
        html += '<div>· <span style="color:var(--gold);">'+esc(r.from)+'</span> → <span style="color:var(--gold);">'+esc(r.to)+'</span> <span style="color:'+typeColor+';">['+esc(r.type||'中立')+']</span>';
        if (r.value !== undefined) html += ' '+r.value;
        if (r.desc) html += ' '+esc(r.desc);
        html += '</div>';
      });
      html += '</div></div>';
    }

    html += '</div>';
    _openModal('势力外交·关系总览', html, null);
  }

  // ══════════════════════════════════════════════════════════════════════
  //  党派面板 (覆盖原 openPartyDetailPanel)
  // ══════════════════════════════════════════════════════════════════════
  function openPartyPanelEnhanced() {
    if (!global.GM || !Array.isArray(GM.parties) || GM.parties.length === 0) { _toast('暂无党派数据'); return; }
    var ps = GM.partyState || {};
    var html = '<div style="padding:0.8rem;max-height:78vh;overflow-y:auto;">';
    html += '<div style="font-size:0.8rem;color:var(--txt-d);margin-bottom:0.8rem;">党派·影响值+官位占比+清名恶名·可弹劾/清党/召集</div>';

    GM.parties.forEach(function(p) {
      if (!p || !p.name) return;
      var s = ps[p.name] || {};
      var inf = s.influence !== undefined ? s.influence : (p.influence||0);
      var oc = s.officeCount || 0;
      var rep = s.reputationBalance || 0;
      var cohesion = s.cohesion !== undefined ? s.cohesion : (p.cohesion||50);
      var repColor = rep >= 30 ? 'var(--green)' : rep <= -30 ? 'var(--red)' : 'var(--gold)';
      var stclr = inf >= 60 ? 'var(--red)' : inf >= 30 ? 'var(--gold)' : 'var(--txt-d)';

      html += '<div style="background:var(--bg-2);border-radius:8px;padding:0.8rem;margin-bottom:0.7rem;border-left:4px solid '+stclr+';">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">';
      html += '<div><span style="font-weight:700;font-size:1rem;">'+esc(p.name)+'</span>';
      if (p.status) html += ' <span style="font-size:0.7rem;color:'+stclr+';">['+esc(p.status)+']</span>';
      html += '</div>';
      html += '<div style="font-size:0.76rem;color:'+stclr+';">影响 '+inf+' · 占官 '+oc+'</div>';
      html += '</div>';
      // 数值网格
      html += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0.5rem;font-size:0.75rem;margin-bottom:0.5rem;">';
      html += '<div><div style="color:var(--txt-d);">影响</div><div style="font-weight:600;color:'+stclr+';">'+inf+'</div></div>';
      html += '<div><div style="color:var(--txt-d);">凝聚</div><div style="font-weight:600;">'+cohesion+'</div></div>';
      html += '<div><div style="color:var(--txt-d);">官位</div><div style="font-weight:600;">'+oc+'</div></div>';
      html += '<div><div style="color:var(--txt-d);">清誉</div><div style="font-weight:600;color:'+repColor+';">'+(rep>0?'+':'')+rep+'</div></div>';
      html += '</div>';
      // 基础信息
      var meta = [];
      if (p.leader) meta.push('领袖: '+p.leader);
      if (p.ideology) meta.push('立场: '+p.ideology);
      if (p.currentAgenda) meta.push('议程: '+p.currentAgenda);
      if (Array.isArray(s.conflictWith) && s.conflictWith.length) meta.push('宿敌: '+s.conflictWith.join('、'));
      if (Array.isArray(s.alliedWith) && s.alliedWith.length) meta.push('同盟: '+s.alliedWith.join('、'));
      if (meta.length) html += '<div style="font-size:0.74rem;color:var(--txt-s);margin-bottom:0.5rem;line-height:1.6;">'+esc(meta.join(' · '))+'</div>';
      // 近期弹劾/政策动态
      var dyn = [];
      if ((s.recentImpeachWin||0) > 0) dyn.push('<span style="color:var(--green);">近期弹劾胜×'+Math.round(s.recentImpeachWin)+'</span>');
      if ((s.recentImpeachLose||0) > 0) dyn.push('<span style="color:var(--red);">近期弹劾败×'+Math.round(s.recentImpeachLose)+'</span>');
      if ((s.recentPolicyWin||0) > 0) dyn.push('<span style="color:var(--green);">近期政策成×'+Math.round(s.recentPolicyWin)+'</span>');
      if (dyn.length) html += '<div style="font-size:0.72rem;margin-bottom:0.5rem;">'+dyn.join(' · ')+'</div>';
      // 动作按钮
      html += '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;">';
      html += '<button class="bt bs" onclick="_tsImpeachByParty(\''+esc(p.name)+'\')" style="font-size:0.72rem;padding:0.3rem 0.7rem;background:rgba(200,50,50,0.12);">令言官弹劾</button>';
      html += '<button class="bt bs" onclick="_tsSummonParty(\''+esc(p.name)+'\')" style="font-size:0.72rem;padding:0.3rem 0.7rem;">召集议事</button>';
      html += '<button class="bt bs" onclick="_tsPurgeParty(\''+esc(p.name)+'\')" style="font-size:0.72rem;padding:0.3rem 0.7rem;background:rgba(200,50,50,0.2);border-color:var(--red);">清算党人</button>';
      html += '<button class="bt bs" onclick="_tsBalanceParty(\''+esc(p.name)+'\')" style="font-size:0.72rem;padding:0.3rem 0.7rem;">借势平衡</button>';
      html += '</div>';
      html += '</div>';
    });

    html += '</div>';
    _openModal('朝中党派·影响与动作', html, null);
  }

  // ══════════════════════════════════════════════════════════════════════
  //  军事面板 (覆盖原 openMilitaryDetailPanel)
  // ══════════════════════════════════════════════════════════════════════
  function openMilitaryPanelEnhanced() {
    if (!global.GM || !Array.isArray(GM.armies) || GM.armies.length === 0) { _toast('暂无军队数据'); return; }
    var playerFac = (global.P && P.playerInfo && P.playerInfo.factionName) || '';
    var html = '<div style="padding:0.8rem;max-height:78vh;overflow-y:auto;">';

    // 粮饷告急
    var crises = GM.armies.filter(function(a){return !a.destroyed && ((a.supply||100)<30 || (a.morale||100)<30 || (a.mutinyRisk||0)>=50 || (a.payArrearsMonths||0)>=3);});
    if (crises.length > 0) {
      html += '<div style="background:rgba(200,50,50,0.1);border:1px solid var(--red,#b04030);border-radius:6px;padding:0.6rem;margin-bottom:0.7rem;font-size:0.78rem;">';
      html += '<div style="font-weight:600;color:var(--red);margin-bottom:0.3rem;">【军情告急】'+crises.length+' 支部队需关注</div>';
      crises.slice(0, 3).forEach(function(a) {
        html += '<div>· '+esc(a.name)+(a.payArrearsMonths>=3?'·欠饷'+a.payArrearsMonths+'月':'')+(a.mutinyRisk>=50?'·兵变险'+a.mutinyRisk:'')+(a.supply<30?'·粮'+a.supply:'')+(a.morale<30?'·气'+a.morale:'')+'</div>';
      });
      html += '</div>';
    }

    // 按势力分组
    var byOwner = {};
    GM.armies.filter(function(a){return !a.destroyed;}).forEach(function(a) {
      var owner = a.owner || a.faction || '无归属';
      if (!byOwner[owner]) byOwner[owner] = [];
      byOwner[owner].push(a);
    });

    Object.keys(byOwner).forEach(function(owner) {
      var isPlayer = owner === playerFac;
      html += '<div style="margin-bottom:1rem;">';
      html += '<div style="font-size:0.85rem;font-weight:600;color:'+(isPlayer?'var(--gold)':'var(--txt-s)')+';margin-bottom:0.4rem;border-bottom:1px dashed var(--bd,rgba(255,255,255,0.1));padding-bottom:0.3rem;">'+esc(owner)+(isPlayer?' (本朝)':'')+' · '+byOwner[owner].length+' 支</div>';
      byOwner[owner].forEach(function(a) {
        var bgColor = (a.mutinyRisk||0) >= 60 ? 'rgba(200,50,50,0.08)' : 'var(--bg-2)';
        html += '<div style="background:'+bgColor+';border-radius:6px;padding:0.6rem;margin-bottom:0.5rem;border-left:3px solid '+(a.mutinyRisk>=60?'var(--red)':(a.morale>=60?'var(--green)':'var(--amber, #e0a040)'))+';">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.3rem;">';
        html += '<div><span style="font-weight:600;">'+esc(a.name)+'</span>';
        if (a.state && a.state !== 'garrison') html += ' <span style="font-size:0.7rem;color:var(--amber, #e0a040);background:rgba(224,160,64,0.1);padding:1px 5px;border-radius:3px;">'+esc({marching:'行军中',sieging:'围城中',routed:'溃散',disbanded:'解散'}[a.state]||a.state)+'</span>';
        html += '</div>';
        html += '<span style="font-size:0.75rem;color:var(--txt-d);">'+(a.soldiers||a.size||0)+' 兵</span>';
        html += '</div>';
        // 数值
        html += '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:0.4rem;font-size:0.7rem;margin-bottom:0.3rem;">';
        html += '<div><span style="color:var(--txt-d);">粮</span> '+(a.supply||0)+'</div>';
        html += '<div><span style="color:var(--txt-d);">气</span> '+(a.morale||0)+'</div>';
        html += '<div><span style="color:var(--txt-d);">训</span> '+(a.training||50)+'</div>';
        html += '<div><span style="color:var(--txt-d);">欠饷</span> '+(a.payArrearsMonths||0)+'月</div>';
        html += '<div><span style="color:var(--txt-d);">兵变</span> <span style="color:'+(a.mutinyRisk>=60?'var(--red)':'var(--txt-s)')+';">'+(a.mutinyRisk||0)+'</span></div>';
        html += '</div>';
        // 信息
        var info = [];
        if (a.commander) info.push('统帅: '+a.commander);
        if (a.garrison || a.location) info.push('驻: '+(a.garrison||a.location));
        if (a.destination) info.push('赴: '+a.destination);
        if (a.controlLevel >= 60) info.push('私兵度 '+a.controlLevel);
        if (info.length) html += '<div style="font-size:0.72rem;color:var(--txt-s);margin-bottom:0.3rem;">'+esc(info.join(' · '))+'</div>';
        // 动作按钮(仅玩家势力军队)
        if (isPlayer) {
          html += '<div style="display:flex;gap:0.3rem;flex-wrap:wrap;margin-top:0.3rem;">';
          html += '<button class="bt bs" onclick="_tsTransferArmy(\''+esc(a.name)+'\')" style="font-size:0.68rem;padding:0.2rem 0.6rem;">调兵</button>';
          html += '<button class="bt bs" onclick="_tsBoostMorale(\''+esc(a.name)+'\')" style="font-size:0.68rem;padding:0.2rem 0.6rem;">犒军鼓舞</button>';
          html += '<button class="bt bs" onclick="_tsSettleArrears(\''+esc(a.name)+'\')" style="font-size:0.68rem;padding:0.2rem 0.6rem;">发饷清欠</button>';
          html += '<button class="bt bs" onclick="_tsAppointGeneral(\''+esc(a.name)+'\')" style="font-size:0.68rem;padding:0.2rem 0.6rem;">易将</button>';
          html += '</div>';
        }
        html += '</div>';
      });
      html += '</div>';
    });

    html += '</div>';
    _openModal('兵部·各路军镇', html, null);
  }

  // ══════════════════════════════════════════════════════════════════════
  //  结构化诏书 Handlers (9 个动作)
  // ══════════════════════════════════════════════════════════════════════
  function _tsDeclareWar(fname) {
    var reason = prompt('对 '+fname+' 宣战理由 / 讨伐檄文要旨?', '');
    if (reason === null) return;
    _pushEdict('谕：以『'+reason+'』为由·兴师讨伐 '+fname+'·令兵部整饬军备·户部筹措军饷。', '宣战');
    _toast('已颁·兴师伐 '+fname);
    if (global.GameEventBus && global.GameEventBus.emit) global.GameEventBus.emit('faction:declareWar', {target: fname, reason: reason});
  }
  function _tsProposePeace(fname) {
    var terms = prompt('向 '+fname+' 提议议和·条件?', '互不侵犯·约为兄弟');
    if (terms === null) return;
    _pushEdict('谕：遣使赴 '+fname+' 议和·条件『'+terms+'』。', '议和');
    _toast('已遣使议和');
  }
  function _tsGrantVassal(fname) {
    var type = prompt('册封 '+fname+' 为附庸·类型(朝贡/藩属/羁縻)?', '朝贡');
    if (type === null) return;
    _pushEdict('谕：册封 '+fname+' 为本朝之附庸·以『'+type+'』礼相待。', '册封');
    _toast('已颁册封诏');
  }
  function _tsTribute(fname) {
    _pushEdict('谕：遣礼部使节赴 '+fname+' 通好·赐绢帛·探其政情。', '通好');
    _toast('已遣通好使');
  }

  function _tsImpeachByParty(partyName) {
    var target = prompt('令言官弹劾·目标姓名(从 '+partyName+' 阵营中选)?', '');
    if (!target) return;
    var charge = prompt('罪名?', '贪渎·不法');
    if (charge === null) return;
    _pushEdict('谕：令科道言官弹劾 '+target+'('+partyName+')·罪名『'+charge+'』·着三法司会审。', '弹劾');
    if (global.GM && GM.partyState && GM.partyState[partyName]) {
      GM.partyState[partyName].recentImpeachLose = (GM.partyState[partyName].recentImpeachLose||0) + 1;
    }
    _toast('已下弹劾');
  }
  function _tsSummonParty(partyName) {
    var topic = prompt('召集 '+partyName+' 骨干议事·议题?', '时政策议');
    if (topic === null) return;
    _pushEdict('谕：召 '+partyName+' 之首脑入内·商议『'+topic+'』。', '召集');
    _toast('已下召集诏');
  }
  function _tsPurgeParty(partyName) {
    if (!confirm('确认清算 '+partyName+' ? 此举必引大狱·党祸流血·后果难料。')) return;
    var extent = prompt('清洗范围(首脑/骨干/全党)?', '首脑');
    if (extent === null) return;
    _pushEdict('谕：以『党祸』为罪·清洗 '+partyName+' 之『'+extent+'』·着锦衣卫缉拿·三法司会鞫。', '党祸');
    if (global.GM && GM.partyState && GM.partyState[partyName]) {
      GM.partyState[partyName].recentImpeachLose = (GM.partyState[partyName].recentImpeachLose||0) + 5;
      GM.partyState[partyName].influence = Math.max(0, GM.partyState[partyName].influence - 20);
    }
    _toast('党祸已起·慎之');
  }
  function _tsBalanceParty(partyName) {
    var rival = prompt('借势 '+partyName+' 以平衡何党?', '');
    if (rival === null) return;
    _pushEdict('谕：重用 '+partyName+' 之清流·以制衡 '+rival+' 之专权。', '制衡');
    if (global.GM && GM.partyState && GM.partyState[partyName]) {
      GM.partyState[partyName].recentPolicyWin = (GM.partyState[partyName].recentPolicyWin||0) + 2;
    }
    _toast('已颁制衡诏');
  }

  function _tsTransferArmy(aname) {
    var dest = prompt('调 '+aname+' 赴何处?', '');
    if (!dest) return;
    var a = (global.GM && GM.armies || []).find(function(x){return x.name === aname;});
    if (a) {
      a.destination = dest;
      a.state = 'marching';
      var dist = 15 + Math.round(Math.random() * 20);
      a.marchDaysLeft = dist;
    }
    _pushEdict('谕：调 '+aname+' 即日拔营·赴 '+dest+'·沿途驿路供给。', '调兵');
    _toast('已调 '+aname+'→'+dest);
  }
  function _tsBoostMorale(aname) {
    _pushEdict('谕：犒 '+aname+' 三军·赐酒肉·彰其勋劳。', '犒军');
    var a = (global.GM && GM.armies || []).find(function(x){return x.name === aname;});
    if (a) { a.morale = Math.min(100, (a.morale||50) + 10); a.loyalty = Math.min(100, (a.loyalty||60) + 5); }
    _toast('已犒 '+aname);
  }
  function _tsSettleArrears(aname) {
    _pushEdict('谕：户部速拨银两·发 '+aname+' 积欠军饷·安定军心。', '发饷');
    var a = (global.GM && GM.armies || []).find(function(x){return x.name === aname;});
    if (a) { a.payArrearsMonths = 0; a.mutinyRisk = Math.max(0, (a.mutinyRisk||0) - 30); }
    _toast('饷已清·兵变险大减');
  }
  function _tsAppointGeneral(aname) {
    var target = prompt('易将·新统帅姓名?', '');
    if (!target) return;
    _pushEdict('谕：擢 '+target+' 为 '+aname+' 新统帅·原统帅另有任用。', '易将');
    var a = (global.GM && GM.armies || []).find(function(x){return x.name === aname;});
    if (a) { a.commander = target; a.loyalty = Math.max(30, (a.loyalty||60) - 10); }
    _toast('已易将');
  }

  // ─── 暴露 ───
  global._tsDeclareWar = _tsDeclareWar;
  global._tsProposePeace = _tsProposePeace;
  global._tsGrantVassal = _tsGrantVassal;
  global._tsTribute = _tsTribute;
  global._tsImpeachByParty = _tsImpeachByParty;
  global._tsSummonParty = _tsSummonParty;
  global._tsPurgeParty = _tsPurgeParty;
  global._tsBalanceParty = _tsBalanceParty;
  global._tsTransferArmy = _tsTransferArmy;
  global._tsBoostMorale = _tsBoostMorale;
  global._tsSettleArrears = _tsSettleArrears;
  global._tsAppointGeneral = _tsAppointGeneral;

  global.openForcesRelationsPanel = openForcesRelationsPanel;
  // 势力面板入口——若原游戏未定义 openFacPanel/viewFac·则以三系统面板替代
  if (typeof global.openFacPanel !== 'function') {
    global.openFacPanel = openForcesRelationsPanel;
  }
  if (typeof global.viewFac !== 'function') {
    global.viewFac = function(facName){ openForcesRelationsPanel(); };
  }
  // 覆盖原有·但保留原方法作为降级
  if (typeof global.openPartyDetailPanel === 'function') {
    global._originalOpenPartyDetailPanel = global.openPartyDetailPanel;
  }
  global.openPartyDetailPanel = openPartyPanelEnhanced;
  if (typeof global.openMilitaryDetailPanel === 'function') {
    global._originalOpenMilitaryDetailPanel = global.openMilitaryDetailPanel;
  }
  global.openMilitaryDetailPanel = openMilitaryPanelEnhanced;

})(typeof window !== 'undefined' ? window : this);
