(function(){
  'use strict';

  var STORE_KEY = 'tm_phase8_pinned_people';
  var ASSET_BASE = 'preview/img/';
  var state = window.TM_PHASE8_FORMAL = window.TM_PHASE8_FORMAL || {};
  state.pinnedPeople = Array.isArray(state.pinnedPeople) ? state.pinnedPeople : loadPinned();
  state.activeSlot = state.activeSlot || '';
  state.eventLookback = state.eventLookback || 3;

  function esc(v){
    return String(v == null ? '' : v).replace(/[&<>"']/g, function(ch){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];
    });
  }

  function toast(text){
    if (typeof window.toast === 'function') window.toast(text);
    else console.log('[Phase8 formal]', text);
  }

  function loadPinned(){
    try {
      var raw = localStorage.getItem(STORE_KEY);
      var list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list.filter(Boolean) : [];
    } catch(_) {
      return [];
    }
  }

  function savePinned(){
    state.pinnedPeople = Array.from(new Set((state.pinnedPeople || []).filter(Boolean)));
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state.pinnedPeople)); } catch(_) {}
    updateRailBadges();
    markPinnedCards();
    if (state.activeSlot === 'office') openPanel('office');
  }

  function personKey(p){
    return String((p && (p.id || p.name || p.charId || p.key)) || '');
  }

  function getPeople(){
    var seen = {};
    var out = [];
    function add(p){
      if (!p) return;
      var k = personKey(p);
      if (!k || seen[k]) return;
      seen[k] = true;
      out.push(p);
    }
    var gm = window.GM || {};
    if (Array.isArray(gm.chars)) gm.chars.forEach(add);
    if (Array.isArray(gm.allCharacters)) gm.allCharacters.forEach(add);
    if (window.P && Array.isArray(P.characters)) P.characters.forEach(add);
    if (typeof window.renwuAllChars === 'function') {
      try { (window.renwuAllChars() || []).forEach(add); } catch(_) {}
    }
    if (typeof window.tmCleanPreviewRenwuChars === 'function') {
      try { (window.tmCleanPreviewRenwuChars() || []).forEach(add); } catch(_) {}
    }
    if (Array.isArray(window.RENWU_ATLAS_CHARS)) window.RENWU_ATLAS_CHARS.forEach(add);
    return out;
  }

  function findPerson(idOrName){
    var key = String(idOrName || '');
    return getPeople().find(function(p){ return personKey(p) === key || p.name === key; }) || null;
  }

  function isPinned(idOrName){
    var p = findPerson(idOrName);
    var key = p ? personKey(p) : String(idOrName || '');
    return state.pinnedPeople.indexOf(key) >= 0;
  }

  function pinPerson(idOrName, force){
    var p = findPerson(idOrName);
    var key = p ? personKey(p) : String(idOrName || '');
    if (!key) return;
    var list = state.pinnedPeople || [];
    var idx = list.indexOf(key);
    var next = force;
    if (next == null) next = idx < 0;
    if (next && idx < 0) list.push(key);
    if (!next && idx >= 0) list.splice(idx, 1);
    state.pinnedPeople = list;
    savePinned();
    toast((p && p.name ? p.name : key) + (next ? ' 已钉入右侧“臣”' : ' 已取消钉选'));
  }

  function extractPersonId(el){
    if (!el) return '';
    if (el.dataset && (el.dataset.personId || el.dataset.renwuId || el.dataset.id || el.dataset.name)) {
      return el.dataset.personId || el.dataset.renwuId || el.dataset.id || el.dataset.name;
    }
    var on = el.getAttribute && (el.getAttribute('onclick') || '');
    var m = on.match(/(?:openCharRenwuPage|viewRenwu|openCharDetail)\(['"]([^'"]+)['"]\)/);
    if (m) return m[1];
    m = on.match(/openRenwuTuzhi\(\{\s*selected\s*:\s*['"]([^'"]+)['"]/);
    if (m) return m[1];
    var nameEl = el.querySelector && (el.querySelector('.rw-name') || el.querySelector('strong') || el.querySelector('b'));
    var raw = nameEl ? (nameEl.textContent || '') : (el.textContent || '');
    raw = raw.replace(/[〔【（(].*$/,'').replace(/\s+/g,'').trim();
    return raw.slice(0, 12);
  }

  function personCardFromTarget(target){
    if (!target || !target.closest) return null;
    var card = target.closest('.rw-card,.rw-card-v2,.renwu-card,.tm-person-row,.cz-person-card,.cd,[data-renwu-id],[data-person-id],.tm-desk-item[onclick*="openRenwuTuzhi"]');
    if (card) return card;
    var btn = target.closest('button');
    if (!btn) return null;
    var text = btn.textContent || '';
    var p = getPeople().find(function(person){ return person && person.name && text.indexOf(person.name) >= 0; });
    if (!p) return null;
    btn.dataset.personId = personKey(p);
    return btn;
  }

  function markPinnedCards(){
    document.querySelectorAll('.rw-card,.rw-card-v2,.renwu-card,.tm-person-row,.cz-person-card,.cd,[data-renwu-id],[data-person-id],.tm-desk-item[onclick*="openRenwuTuzhi"]').forEach(function(card){
      var id = extractPersonId(card);
      if (!id) return;
      var pinned = isPinned(id);
      card.classList.toggle('tm-phase8-person-pinned', pinned);
      card.title = pinned ? '右键取消钉选' : '右键钉选到右侧“臣”';
    });
  }

  function installContextMenu(){
    if (state.contextMenuInstalled) return;
    state.contextMenuInstalled = true;
    function handle(e, fromMouseDown){
      var card = personCardFromTarget(e.target);
      if (!card) return;
      var id = extractPersonId(card);
      if (!id || !findPerson(id)) return;
      e.preventDefault();
      e.stopPropagation();
      var now = Date.now();
      if (!fromMouseDown && state.lastPinGesture && state.lastPinGesture.id === id && now - state.lastPinGesture.time < 700) return;
      state.lastPinGesture = { id: id, time: now };
      pinPerson(id);
    }
    document.addEventListener('mousedown', function(e){
      if (e.button === 2) handle(e, true);
    }, true);
    document.addEventListener('contextmenu', function(e){ handle(e, false); }, true);
  }

  function jump(tabId){
    if (!tabId) return;
    if (window.TM && TM.UI && TM.UI.tabs && typeof TM.UI.tabs.switchGameTab === 'function') {
      TM.UI.tabs.switchGameTab(null, tabId);
    } else if (typeof window.switchGTab === 'function') {
      window.switchGTab(null, tabId);
    } else {
      toast('旧 UI 标签页尚未就绪：' + tabId);
      return;
    }
    closeRightDrawer();
  }

  function openLeft(key){
    if (window.TM && TM.UI && TM.UI.shell && typeof TM.UI.shell.openSideDrawer === 'function') {
      TM.UI.shell.openSideDrawer('left', key);
    } else if (typeof window.openSideDrawer === 'function') {
      window.openSideDrawer('left', key);
    }
  }

  function openGuoku(){
    if (typeof window.openGuokuPanel === 'function') window.openGuokuPanel();
    else openPanel('finance');
  }

  function openKeju(){
    if (typeof window.openKejuPanel === 'function') window.openKejuPanel();
    else jump('gt-keju');
  }

  function openChaoyiMode(mode){
    if (typeof window.openChaoyi !== 'function') {
      jump('gt-chaoyi');
      return;
    }
    window.openChaoyi();
    setTimeout(function(){
      try { if (typeof window._cy_pickMode === 'function') window._cy_pickMode(mode || 'tinyi'); }
      catch(e) { console.warn(e); }
    }, 80);
  }

  function miniRows(rows){
    return '<div class="tmf-minirows">' + rows.map(function(r){
      return '<div><span>' + esc(r[0]) + '</span><b>' + esc(r[1] == null || r[1] === '' ? '—' : r[1]) + '</b></div>';
    }).join('') + '</div>';
  }

  function actionButton(label, sub, onClick, cls){
    return '<button type="button" class="tmf-action ' + (cls || '') + '" onclick="' + onClick + '"><b>' + esc(label) + '</b><span>' + esc(sub || '') + '</span></button>';
  }

  function asset(name){
    return ASSET_BASE + name;
  }

  function isStubNode(node){
    return !!(node && node.__sink);
  }

  function isGameVisible(){
    var g = document.getElementById('G');
    return !!(g && getComputedStyle(g).display !== 'none');
  }

  function openRecordsMenu(){
    var old = document.getElementById('tm-phase8-records-overlay');
    if (old) old.remove();
    var ov = document.createElement('div');
    ov.id = 'tm-phase8-records-overlay';
    ov.className = 'tmf-records-overlay';
    ov.innerHTML = '<section class="tmf-records-dialog" role="dialog" aria-label="史官实录">' +
      '<header><div><span>史官实录</span><h3>史记 · 实录 · 纪事 · 编年</h3></div><button type="button" data-close="1">×</button></header>' +
      '<div class="tmf-records-grid">' +
      '<button type="button" data-tab="gt-shiji"><b>史记</b><span>本纪史册与回合史文</span></button>' +
      '<button type="button" data-tab="gt-qiju"><b>实录</b><span>起居注、诏令、奏对实录</span></button>' +
      '<button type="button" data-tab="gt-jishi"><b>纪事</b><span>人物问对与事件本末</span></button>' +
      '<button type="button" data-tab="gt-biannian"><b>编年</b><span>按回合与年月汇编</span></button>' +
      '</div></section>';
    ov.addEventListener('click', function(e){
      if (e.target === ov || (e.target && e.target.dataset && e.target.dataset.close)) ov.remove();
      var btn = e.target && e.target.closest ? e.target.closest('[data-tab]') : null;
      if (!btn) return;
      ov.remove();
      jump(btn.dataset.tab);
    });
    document.body.appendChild(ov);
  }

  function openAction(kind){
    if (kind === 'edict') jump('gt-edict');
    else if (kind === 'memorial') jump('gt-memorial');
    else if (kind === 'letter') jump('gt-letter');
    else if (kind === 'records') openRecordsMenu();
    else if (kind === 'renwu') jump('gt-renwu');
    else if (kind === 'shizheng') {
      if (typeof window.openShizhengTasks === 'function') window.openShizhengTasks();
      else jump('gt-zhaozheng');
    }
  }

  function getTurnText(turn){
    try {
      if (typeof window.getTSText === 'function') return window.getTSText(turn);
    } catch(_) {}
    return '第 ' + (turn || 1) + ' 回合';
  }

  function collectRecentEvents(){
    var gm = window.GM || {};
    var cur = Number(gm.turn || 1);
    var lookback = Number(state.eventLookback || 3);
    var minTurn = lookback >= 999 ? -Infinity : Math.max(1, cur - lookback + 1);
    var rows = [];
    function add(row){
      if (!row) return;
      var turn = Number(row.turn || cur || 1);
      if (turn < minTurn) return;
      rows.push({
        turn: turn,
        type: row.type || row.category || row.source || '近事',
        title: row.title || row.type || row.category || row.char || '近事',
        text: row.text || row.content || row.shizhengji || row.summary || row.playerSaid || row.npcSaid || '',
        time: row.time || row.date || getTurnText(turn),
        source: row.sourceName || row.source || '',
        raw: row
      });
    }
    (gm.evtLog || []).forEach(add);
    (gm.qijuHistory || []).forEach(function(q){
      add({ turn:q.turn, type:'实录', title:q.category || '起居注', text:q.content || q.xinglu || q.text || q.summary, time:q.date });
    });
    (gm.jishiRecords || []).forEach(function(r){
      add({ turn:r.turn, type:'纪事', title:r.char || '问对纪事', text:[r.playerSaid, r.npcSaid].filter(Boolean).join(' / ') });
    });
    (gm.shijiHistory || []).forEach(function(s){
      add({ turn:s.turn, type:'史记', title:'史记本纪', text:s.shizhengji || s.summary || '', time:s.time });
    });
    rows.sort(function(a, b){
      if (b.turn !== a.turn) return b.turn - a.turn;
      return rows.indexOf(b) - rows.indexOf(a);
    });
    return rows.slice(0, 80);
  }

  function renderEventFeed(){
    var host = document.getElementById('tm-phase8-event-list');
    if (!host) return;
    var list = collectRecentEvents();
    state.eventCache = list;
    if (!list.length) {
      host.innerHTML = '<div class="tmf-event-empty">暂无近事。回合推演、奏对、奏疏、诏令结果会自动收入此处。</div>';
      return;
    }
    host.innerHTML = list.map(function(e, idx){
      var text = String(e.text || '').replace(/\s+/g, ' ').trim();
      if (text.length > 74) text = text.slice(0, 74) + '…';
      return '<button type="button" class="tmf-event-row" data-event-idx="' + idx + '">' +
        '<span class="tmf-event-turn">T' + esc(e.turn) + '</span>' +
        '<span class="tmf-event-main"><b>' + esc(e.title || e.type) + '</b><em>' + esc(text || '未记正文') + '</em></span>' +
        '<span class="tmf-event-type">' + esc(e.type) + '</span>' +
      '</button>';
    }).join('');
  }

  function openEventDetail(idx){
    var item = state.eventCache && state.eventCache[idx];
    if (!item) return;
    var old = document.getElementById('tm-phase8-event-detail');
    if (old) old.remove();
    var ov = document.createElement('div');
    ov.id = 'tm-phase8-event-detail';
    ov.className = 'tmf-event-detail';
    ov.innerHTML = '<section class="tmf-event-dialog" role="dialog" aria-label="近事详情">' +
      '<header><div><span>' + esc(item.type) + ' · T' + esc(item.turn) + '</span><h3>' + esc(item.title || '近事') + '</h3><p>' + esc(item.time || getTurnText(item.turn)) + '</p></div><button type="button" data-close="1">×</button></header>' +
      '<main>' + esc(item.text || '未记正文') + '</main>' +
      '<footer><button type="button" data-tab="gt-jishi">入纪事</button><button type="button" data-tab="gt-biannian">看编年</button><button type="button" data-tab="gt-shiji">看史记</button><button type="button" data-tab="gt-edict">拟诏处置</button></footer>' +
      '</section>';
    ov.addEventListener('click', function(e){
      if (e.target === ov || (e.target && e.target.dataset && e.target.dataset.close)) ov.remove();
      var btn = e.target && e.target.closest ? e.target.closest('[data-tab]') : null;
      if (!btn) return;
      ov.remove();
      jump(btn.dataset.tab);
    });
    document.body.appendChild(ov);
  }

  function ensureFormalChrome(){
    var g = document.getElementById('G');
    if (!g) return;
    var left = document.getElementById('tm-phase8-left-surface');
    if (!left) {
      left = document.createElement('div');
      left.id = 'tm-phase8-left-surface';
      left.innerHTML = '<button type="button" class="tmf-renwu-entry" data-tmf-action="renwu">' +
        '<img src="' + esc(asset('renwu-tuzhi-card-ui.png')) + '" alt="">' +
        '<span>人物图志</span>' +
        '</button>' +
        '<section class="tmf-event-feed">' +
        '<header><div><b>朝野近事</b><span>自动纳入</span></div><select id="tm-phase8-event-range" aria-label="近事范围"><option value="3">最近三回合</option><option value="6">最近六回合</option><option value="999">全部回合</option></select></header>' +
        '<div class="tmf-event-list" id="tm-phase8-event-list"></div>' +
        '</section>';
      g.appendChild(left);
    }
    var tray = document.getElementById('tm-phase8-action-tray');
    if (!tray) {
      tray = document.createElement('div');
      tray.id = 'tm-phase8-action-tray';
      tray.innerHTML = [
        ['edict','action-edict-card.png','撰写诏书','诏令'],
        ['memorial','action-memorial-card.png','百官奏疏','奏疏'],
        ['letter','action-letter-card.png','鸿雁传书','传书'],
        ['records','action-annals-card.png','史官实录','史册']
      ].map(function(a){
        return '<button type="button" class="tmf-desk-action ' + esc(a[0]) + '" data-tmf-action="' + esc(a[0]) + '">' +
          '<img src="' + esc(asset(a[1])) + '" alt="">' +
          '<span><b>' + esc(a[2]) + '</b><em>' + esc(a[3]) + '</em></span>' +
        '</button>';
      }).join('');
      g.appendChild(tray);
    }
    if (!state.chromeBound) {
      state.chromeBound = true;
      document.addEventListener('click', function(e){
        var action = e.target && e.target.closest ? e.target.closest('[data-tmf-action]') : null;
        if (action) {
          e.preventDefault();
          openAction(action.dataset.tmfAction);
          return;
        }
        var evt = e.target && e.target.closest ? e.target.closest('[data-event-idx]') : null;
        if (evt) {
          e.preventDefault();
          openEventDetail(Number(evt.dataset.eventIdx));
        }
      }, true);
      document.addEventListener('change', function(e){
        if (e.target && e.target.id === 'tm-phase8-event-range') {
          state.eventLookback = Number(e.target.value || 3);
          renderEventFeed();
        }
      }, true);
    }
    var sel = document.getElementById('tm-phase8-event-range');
    if (sel && !isStubNode(sel)) sel.value = String(state.eventLookback || 3);
    renderEventFeed();
  }

  function renderPinnedPeople(){
    var ids = state.pinnedPeople || [];
    var people = ids.map(findPerson).filter(Boolean);
    if (!people.length) {
      return '<section class="tmf-card empty"><div class="tmf-card-title">钉选臣僚</div><p>在人物图志或人物志卡片上点右键，即可把人物钉入这里。此处只保留你临时关注的人，不再混入全量人物列表。</p><button type="button" class="tmf-primary" onclick="TMPhase8FormalBridge.openRenwu()">打开人物志</button></section>';
    }
    return '<section class="tmf-card"><div class="tmf-card-title">钉选臣僚 <small>' + people.length + ' 人</small></div><div class="tmf-person-list">' +
      people.map(function(p){
        var key = personKey(p);
        var portrait = p.portrait ? '<img src="' + esc(p.portrait) + '" alt="">' : '<span>' + esc((p.name || '?').charAt(0)) + '</span>';
        var office = p.officialTitle || p.title || p.role || p.occupation || '未任';
        var meta = [
          ['势力', p.faction || p.party || '—'],
          ['所在', p.location || '—'],
          ['忠诚', p.loyalty != null ? Math.round(p.loyalty) : '—'],
          ['压力', p.stress != null ? Math.round(p.stress) : '—']
        ];
        return '<article class="tmf-person-card">' +
          '<div class="tmf-avatar">' + portrait + '</div>' +
          '<div class="tmf-person-main"><div class="tmf-person-head"><b>' + esc(p.name || key) + '</b><span>' + esc(office) + '</span></div>' +
          miniRows(meta) +
          '<div class="tmf-person-actions">' +
          '<button onclick="TMPhase8FormalBridge.personAction(\'' + esc(key) + '\',\'wendui\')">问对</button>' +
          '<button onclick="TMPhase8FormalBridge.personAction(\'' + esc(key) + '\',\'letter\')">传书</button>' +
          '<button onclick="TMPhase8FormalBridge.personAction(\'' + esc(key) + '\',\'office\')">官制</button>' +
          '<button onclick="TMPhase8FormalBridge.personAction(\'' + esc(key) + '\',\'detail\')">详情</button>' +
          '<button class="danger" onclick="TMPhase8FormalBridge.unpin(\'' + esc(key) + '\')">移除</button>' +
          '</div></div></article>';
      }).join('') + '</div></section>';
  }

  function renderZheng(){
    return '<section class="tmf-card"><div class="tmf-card-title">问对</div>' +
      actionButton('问对臣子', '进入旧 UI 的问对标签页，保留原先择臣与对话流程。', "TMPhase8FormalBridge.jump('gt-wendui')", 'main') +
      '</section>' +
      '<section class="tmf-card"><div class="tmf-card-title">朝会 <small>只保留朝议类型入口</small></div>' +
      '<div class="tmf-chaoyi-grid">' +
      '<button onclick="TMPhase8FormalBridge.openChaoyi(\'changchao\')"><img src="preview/img/chaoyi-changchao-scene-v1.png" alt=""><b>常朝</b><span>旧流程：例行朝参</span></button>' +
      '<button onclick="TMPhase8FormalBridge.openChaoyi(\'tinyi\')"><img src="preview/img/chaoyi-tingyi-scene-v1.png" alt=""><b>廷议</b><span>旧流程：集议大政</span></button>' +
      '<button onclick="TMPhase8FormalBridge.openChaoyi(\'yuqian\')"><img src="preview/img/chaoyi-yuqian-scene-v1.png" alt=""><b>御前会议</b><span>旧流程：密召心腹</span></button>' +
      '</div><p class="tmf-note">这里不再放议题筹备、参会人、裁断动作等二次流程，点击类型后交还老朝议系统继续。</p></section>';
  }

  function renderWen(){
    return '<section class="tmf-card"><div class="tmf-card-title">文事</div>' +
      '<div class="tmf-top-actions">' +
      actionButton('科举', '打开旧 UI 的科举标签页流程。', 'TMPhase8FormalBridge.openKeju()', 'main') +
      actionButton('文苑', '承接原文事标签页。', "TMPhase8FormalBridge.jump('gt-wenyuan')") +
      '</div></section>';
  }

  function renderGang(){
    var facs = (window.GM && Array.isArray(GM.facs)) ? GM.facs.slice(0, 5) : [];
    return '<section class="tmf-card"><div class="tmf-card-title">纲纪总览</div><p class="tmf-note">承接旧 UI 左侧栏的阶层、党派与势力入口。</p>' +
      '<div class="tmf-top-actions">' +
      actionButton('阶层', '查看社会阶层与利益结构。', "TMPhase8FormalBridge.openLeft('class')", 'main') +
      actionButton('党派', '查看朝中党派与人物网络。', "TMPhase8FormalBridge.openLeft('party')") +
      actionButton('势力', '查看各方势力概况。', "TMPhase8FormalBridge.openLeft('fac')") +
      '</div></section>' +
      (facs.length ? '<section class="tmf-card"><div class="tmf-card-title">近势</div>' + facs.map(function(f){
        return '<div class="tmf-line"><b>' + esc(f.name || f.id || '势力') + '</b><span>实力 ' + esc(f.strength != null ? Math.round(f.strength) : '—') + ' · 凝聚 ' + esc(f.cohesion != null ? Math.round(f.cohesion) : '—') + '</span></div>';
      }).join('') + '</section>' : '');
  }

  function renderArmy(){
    var list = [];
    if (window.GM && Array.isArray(GM.armies)) list = GM.armies;
    else if (window.P && Array.isArray(P.armies)) list = P.armies;
    return '<section class="tmf-card"><div class="tmf-card-title">军务边防</div>' +
      actionButton('打开军队旧面板', '承接旧 UI 左侧栏军队职能。', "TMPhase8FormalBridge.openLeft('army')", 'main') +
      '</section>' +
      '<section class="tmf-card"><div class="tmf-card-title">部队摘录</div>' +
      (list.length ? list.slice(0, 8).map(function(a){
        return '<div class="tmf-line"><b>' + esc(a.name || a.id || '军队') + '</b><span>' + esc(a.location || a.theater || '—') + ' · ' + esc(a.soldiers || a.size || a.strength || '—') + '</span></div>';
      }).join('') : '<p class="tmf-note">暂无可摘录部队数据，点击上方进入旧军队面板。</p>') + '</section>';
  }

  function renderMap(){
    var ah = window.P && P.adminHierarchy ? P.adminHierarchy : {};
    var count = Object.keys(ah || {}).length;
    return '<section class="tmf-card"><div class="tmf-card-title">舆图政区</div>' +
      miniRows([['行政区划', count ? count + ' 项' : '待加载'], ['地图', window.P && P.map ? '已接入' : '旧面板']]) +
      '<div class="tmf-top-actions">' +
      actionButton('地方舆情', '进入旧 UI 地方/行政区划标签页。', "TMPhase8FormalBridge.jump('gt-difang')", 'main') +
      actionButton('行政区划', '打开旧左侧行政区划面板。', "TMPhase8FormalBridge.openLeft('admin')") +
      actionButton('天下图', '打开旧左侧地图面板。', "TMPhase8FormalBridge.openLeft('map')") +
      '</div></section>';
  }

  function renderFinance(){
    var g = (window.GM && GM.guoku) || {};
    return '<section class="tmf-card"><div class="tmf-card-title">户部财计</div>' +
      miniRows([
        ['帑银', g.stockMoney || g.money || '—'],
        ['粮', g.stockGrain || g.grain || '—'],
        ['本期入', g.turnIncome || g.monthlyIncome || '—'],
        ['本期出', g.turnExpense || g.monthlyExpense || '—']
      ]) +
      '<div class="tmf-top-actions">' +
      actionButton('帑廪详情', '打开旧国库详情抽屉。', 'TMPhase8FormalBridge.openGuoku()', 'main') +
      actionButton('奏疏', '查看户部、漕运、铸币奏报。', "TMPhase8FormalBridge.jump('gt-memorial')") +
      '</div></section>';
  }

  function renderZhi(){
    return '<section class="tmf-card"><div class="tmf-card-title">官制衙门</div><p class="tmf-note">承接旧 UI 官制标签页，保留官制树、职官任免、荐贤廷推等流程。</p>' +
      actionButton('打开官制', '进入旧 UI 官制树。', "TMPhase8FormalBridge.jump('gt-office')", 'main') +
      '</section>';
  }

  var renderers = {
    ol: renderGang,
    issue: renderZheng,
    policy: renderWen,
    office: renderPinnedPeople,
    army: renderArmy,
    map: renderMap,
    finance: renderFinance,
    archive: renderZhi
  };

  var titles = {
    ol: '纲 纪 总 览',
    issue: '政 务 问 对',
    policy: '文 事 科 举',
    office: '钉 选 臣 僚',
    army: '军 务 边 防',
    map: '舆 图 政 区',
    finance: '户 部 财 计',
    archive: '官 制 衙 门'
  };

  function panelHost(){
    var drawer = document.getElementById('drawerRight');
    if (!drawer) return null;
    var body = drawer.querySelector('.gs-drawer-body');
    if (!body) return null;
    Array.from(body.children).forEach(function(child){
      if (child.id !== 'tm-phase8-formal-panel') child.style.display = 'none';
    });
    var host = document.getElementById('tm-phase8-formal-panel');
    if (!host) {
      host = document.createElement('div');
      host.id = 'tm-phase8-formal-panel';
      body.appendChild(host);
    }
    host.style.display = 'block';
    return host;
  }

  function openPanel(slot){
    if (!renderers[slot]) return;
    state.activeSlot = slot;
    installStyles();
    ensureRail();
    updateRailActive();
    var drawer = document.getElementById('drawerRight');
    var host = panelHost();
    if (!drawer || !host) return;
    var title = drawer.querySelector('.gs-drawer-title');
    if (title) title.textContent = titles[slot] || '国 事';
    host.innerHTML = '<div class="tmf-panel">' + renderers[slot]() + '</div>';
    drawer.classList.add('open');
  }

  function closeRightDrawer(){
    var drawer = document.getElementById('drawerRight');
    if (drawer) drawer.classList.remove('open');
  }

  function updateRailActive(){
    document.querySelectorAll('#tm-phase8-formal-rail .tmf-rail-btn').forEach(function(btn){
      btn.classList.toggle('active', btn.dataset.slot === state.activeSlot);
    });
  }

  function updateRailBadges(){
    var n = (state.pinnedPeople || []).length;
    document.querySelectorAll('[data-phase8-badge="pinned"]').forEach(function(el){
      el.textContent = n;
      el.style.display = n ? '' : 'none';
    });
  }

  function ensureRail(){
    var root = document.querySelector('.gs-rail-right');
    if (!root) return;
    var old = root.querySelector('.gs-rail');
    if (old) old.style.display = 'none';
    var rail = document.getElementById('tm-phase8-formal-rail');
    if (!rail) {
      rail = document.createElement('div');
      rail.id = 'tm-phase8-formal-rail';
      root.appendChild(rail);
    }
    var buttons = [
      ['ol','纲','纲纪总览','6','hot'],
      ['issue','政','问对与朝会','3','hot'],
      ['policy','文','文事与科举',''],
      ['office','臣','钉选臣僚','pin',''],
      ['army','军','军务边防','2','hot'],
      ['map','图','舆图政区',''],
      ['finance','户','户部财计','','ok'],
      ['archive','制','官制衙门','']
    ];
    rail.innerHTML = buttons.map(function(b){
      var badge = b[3] === 'pin'
        ? '<span class="tmf-rail-count" data-phase8-badge="pinned"></span>'
        : (b[3] ? '<span class="tmf-rail-count">' + esc(b[3]) + '</span>' : '');
      return '<button type="button" class="tmf-rail-btn ' + esc(b[4] || '') + '" data-slot="' + esc(b[0]) + '" title="' + esc(b[2]) + '" onclick="TMPhase8FormalBridge.openPanel(\'' + esc(b[0]) + '\')"><span>' + esc(b[1]) + '</span>' + badge + '</button>';
    }).join('');
    updateRailBadges();
    updateRailActive();
  }

  function installStyles(){
    if (document.getElementById('tm-phase8-formal-style')) return;
    var st = document.createElement('style');
    st.id = 'tm-phase8-formal-style';
    st.textContent = [
      'body.tm-phase8-formal #bar{height:78px;background:linear-gradient(180deg,rgba(25,19,13,.99),rgba(12,9,7,.97));border-bottom:1px solid rgba(184,154,83,.36);box-shadow:0 8px 24px rgba(0,0,0,.52);padding:0 20px;gap:10px;}',
      'body.tm-phase8-formal #bar:before{content:"";position:absolute;left:18px;right:18px;bottom:5px;height:1px;background:linear-gradient(90deg,transparent,rgba(201,168,95,.52),transparent);}',
      'body.tm-phase8-formal #G{margin-top:78px;height:calc(100vh - 78px);grid-template-columns:0 minmax(0,1fr) 58px;background:#0c0907;}',
      'body.tm-phase8-formal .bar-seal,body.tm-phase8-formal .bar-era-stack{display:none!important;}',
      'body.tm-phase8-formal .bar-logo{border-right:none;padding-right:0;gap:0;}',
      'body.tm-phase8-formal .bar-logo,body.tm-phase8-formal .bar-vars,body.tm-phase8-formal .bar-right-group,body.tm-phase8-formal .bar-time{filter:drop-shadow(0 2px 8px rgba(0,0,0,.35));}',
      'body.tm-phase8-formal .bar-wentian{height:40px;min-width:92px;border:1px solid rgba(201,168,95,.45)!important;background:linear-gradient(180deg,rgba(44,34,22,.90),rgba(13,10,8,.96))!important;-webkit-text-fill-color:#f0d98c;color:#f0d98c!important;border-radius:2px;letter-spacing:.34em;font-size:16px;padding-left:18px;}',
      'body.tm-phase8-formal .bar-weather{height:42px;min-width:128px;border:1px solid rgba(201,168,95,.20);border-left:none;border-right:1px solid rgba(201,168,95,.24);background:linear-gradient(90deg,rgba(201,168,95,.05),rgba(0,0,0,.10));}',
      'body.tm-phase8-formal .bar-vars{flex:1 1 auto;min-width:0;gap:5px;flex-wrap:nowrap;overflow:hidden;}',
      'body.tm-phase8-formal .bar-var{height:40px;min-width:78px;padding:4px 10px;border:1px solid rgba(201,168,95,.20);border-radius:2px;background:linear-gradient(180deg,rgba(40,31,20,.72),rgba(11,8,6,.72));box-shadow:inset 0 0 0 1px rgba(0,0,0,.35);}',
      'body.tm-phase8-formal .bar-var.wide{min-width:116px;}',
      'body.tm-phase8-formal .bar-var-name{font-size:11px;color:#bda765;letter-spacing:.16em;}',
      'body.tm-phase8-formal .bar-var-value{font-size:16px;color:var(--c,#f0d98c);}',
      'body.tm-phase8-formal .bar-var-sub-item{font-size:12px;line-height:1.05;}',
      'body.tm-phase8-formal .bar-var-sub-item .sk{font-size:10px;color:#917e57;}',
      'body.tm-phase8-formal .bar-more-vars{height:38px;border-color:rgba(201,168,95,.35)!important;background:linear-gradient(180deg,rgba(34,26,17,.86),rgba(11,8,6,.9))!important;color:#d7be73;border-radius:2px;letter-spacing:.2em;}',
      'body.tm-phase8-formal .bar-time{height:44px;min-width:196px;border:1px solid rgba(201,168,95,.32)!important;background:linear-gradient(180deg,rgba(42,32,20,.84),rgba(12,9,7,.92))!important;border-radius:2px;padding:5px 14px;}',
      'body.tm-phase8-formal .bar-time-main{font-size:15px;color:#f0d98c;letter-spacing:.16em;}',
      'body.tm-phase8-formal .bar-time-sub{font-size:11px;color:#9b8b6d;}',
      'body.tm-phase8-formal .gs-rail-left{width:0;border-right:0;background:transparent;overflow:visible;pointer-events:none;}',
      'body.tm-phase8-formal .gs-rail-left .gs-rail{display:none!important;}',
      'body.tm-phase8-formal .gs-drawer.left{left:0;}',
      'body.tm-phase8-formal .gs-drawer.right{right:58px;width:388px;background:linear-gradient(180deg,rgba(26,21,16,.98),rgba(9,8,6,.98));}',
      'body.tm-phase8-formal .gs-rail-right{width:58px;background:transparent;border-left:1px solid rgba(184,154,83,.20);overflow:visible;}',
      'body.tm-phase8-formal .gc{padding-left:318px;box-sizing:border-box;background-color:#17110c;background-image:repeating-linear-gradient(90deg,transparent 0,transparent 42px,rgba(201,168,95,.025) 43px),linear-gradient(180deg,rgba(201,168,95,.05),transparent 90px);}',
      '#tm-phase8-formal-rail{position:absolute;right:6px;top:9px;display:flex;flex-direction:column;gap:6px;align-items:center;z-index:33;}',
      '.tmf-rail-btn{width:42px;height:48px;position:relative;border:1px solid rgba(184,154,83,.28);border-radius:0;background:linear-gradient(180deg,rgba(26,21,16,.92),rgba(8,7,6,.94));color:#d5bf7b;font-family:"STKaiti","KaiTi","楷体",serif;font-size:18px;letter-spacing:.12em;cursor:pointer;box-shadow:inset 0 0 0 1px rgba(0,0,0,.45),0 5px 12px rgba(0,0,0,.28);}',
      '.tmf-rail-btn span:first-child{display:block;transform:translateX(.04em);}',
      '.tmf-rail-btn:hover,.tmf-rail-btn.active{border-color:#d4be7a;color:#f0dc98;background:radial-gradient(circle at 50% 18%,rgba(201,168,95,.22),transparent 48%),linear-gradient(180deg,rgba(47,35,22,.94),rgba(12,9,7,.96));}',
      '.tmf-rail-btn.hot{color:#e4a28d;border-color:rgba(192,64,48,.45);}.tmf-rail-btn.ok{color:#a8d4c5;border-color:rgba(126,184,167,.42);}',
      '.tmf-rail-count{position:absolute;right:-5px;top:-5px;min-width:17px;height:17px;padding:0 4px;border-radius:9px;background:rgba(124,35,25,.96);border:1px solid rgba(232,160,125,.75);color:#f4eadd;font-size:11px;line-height:16px;text-align:center;letter-spacing:0;font-family:serif;}',
      '#tm-phase8-formal-panel{width:100%;min-height:100%;}',
      '.tmf-panel{display:flex;flex-direction:column;gap:10px;font-family:"STKaiti","KaiTi","楷体",serif;color:#eee0bd;}',
      '.tmf-card{border:1px solid rgba(184,154,83,.26);border-left:3px solid rgba(184,154,83,.65);background:linear-gradient(180deg,rgba(33,27,20,.84),rgba(13,11,9,.88));padding:11px 12px;box-shadow:inset 0 0 0 1px rgba(0,0,0,.28);}',
      '.tmf-card.empty{border-left-color:rgba(126,184,167,.68);}',
      '.tmf-card-title{display:flex;align-items:center;justify-content:space-between;margin-bottom:9px;color:#d7be73;font-size:17px;letter-spacing:.18em;border-bottom:1px dashed rgba(184,154,83,.22);padding-bottom:5px;}.tmf-card-title small{font-size:12px;color:#9d917d;letter-spacing:.08em;}',
      '.tmf-note,.tmf-card p{font-size:14px;line-height:1.7;color:#b9aa8a;margin:6px 0 8px;}',
      '.tmf-primary,.tmf-action,.tmf-person-actions button{font-family:inherit;cursor:pointer;border:1px solid rgba(184,154,83,.32);background:rgba(184,154,83,.08);color:#d8c27c;}',
      '.tmf-primary{padding:7px 12px;width:100%;}.tmf-primary:hover,.tmf-action:hover,.tmf-person-actions button:hover{border-color:#d4be7a;color:#f3df9d;background:rgba(184,154,83,.15);}',
      '.tmf-top-actions{display:grid;grid-template-columns:1fr;gap:7px;}.tmf-action{display:flex;flex-direction:column;align-items:flex-start;gap:2px;text-align:left;padding:9px 10px;}.tmf-action.main{border-color:rgba(126,184,167,.48);color:#bde6d9;background:linear-gradient(90deg,rgba(126,184,167,.10),rgba(184,154,83,.05));}.tmf-action b{font-size:15px;letter-spacing:.12em;}.tmf-action span{font-size:12px;color:#a99d83;line-height:1.5;}',
      '.tmf-minirows{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:6px 0 8px;}.tmf-minirows div{background:rgba(255,255,255,.025);border:1px solid rgba(184,154,83,.14);padding:5px 6px;}.tmf-minirows span{display:block;color:#8f846f;font-size:12px;}.tmf-minirows b{font-size:15px;color:#e4d4a8;}',
      '.tmf-person-list{display:flex;flex-direction:column;gap:9px;}.tmf-person-card{display:flex;gap:9px;border:1px solid rgba(126,184,167,.26);background:rgba(126,184,167,.05);padding:8px;}.tmf-avatar{width:48px;height:58px;border:1px solid rgba(201,168,95,.34);display:flex;align-items:center;justify-content:center;background:#19120d;color:#d4be7a;font-size:24px;flex-shrink:0;overflow:hidden;}.tmf-avatar img{width:100%;height:100%;object-fit:cover;}.tmf-person-main{flex:1;min-width:0;}.tmf-person-head{display:flex;justify-content:space-between;gap:8px;align-items:baseline;margin-bottom:4px;}.tmf-person-head b{font-size:17px;color:#f0dc98;}.tmf-person-head span{font-size:12px;color:#a8d4c5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
      '.tmf-person-actions{display:flex;flex-wrap:wrap;gap:4px;margin-top:7px;}.tmf-person-actions button{font-size:12px;padding:3px 7px;}.tmf-person-actions button.danger{color:#d4706a;border-color:rgba(192,64,48,.40);background:rgba(192,64,48,.08);}',
      '.tmf-chaoyi-grid{display:grid;grid-template-columns:1fr;gap:8px;}.tmf-chaoyi-grid button{height:92px;position:relative;overflow:hidden;border:1px solid rgba(184,154,83,.30);background:#15100c;color:#f1ddb0;text-align:left;padding:10px 12px;cursor:pointer;font-family:inherit;}.tmf-chaoyi-grid img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.38;filter:saturate(.85) brightness(.72);}.tmf-chaoyi-grid b,.tmf-chaoyi-grid span{position:relative;z-index:1;display:block;text-shadow:0 2px 6px #000;}.tmf-chaoyi-grid b{font-size:20px;letter-spacing:.18em;margin-top:18px;}.tmf-chaoyi-grid span{font-size:13px;color:#d7c49b;}',
      '.tmf-line{display:flex;justify-content:space-between;gap:8px;border-bottom:1px dashed rgba(184,154,83,.15);padding:7px 0;font-size:14px;}.tmf-line:last-child{border-bottom:none;}.tmf-line b{color:#e4d4a8;}.tmf-line span{color:#a99d83;text-align:right;}',
      '.tm-phase8-person-pinned{outline:1px solid rgba(126,184,167,.76)!important;box-shadow:inset 3px 0 rgba(126,184,167,.82),0 0 0 1px rgba(126,184,167,.18)!important;position:relative;}.tm-phase8-person-pinned:after{content:"钉";position:absolute;right:5px;top:4px;min-width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(126,184,167,.18);border:1px solid rgba(126,184,167,.56);color:#bfe9dc;font-size:11px;z-index:2;}',
      '#tm-phase8-left-surface{position:absolute;left:0;top:16px;bottom:208px;width:300px;z-index:24;display:flex;flex-direction:column;gap:10px;pointer-events:none;font-family:"STKaiti","KaiTi","楷体",serif;}',
      '#tm-phase8-left-surface>*{pointer-events:auto;}',
      '.tmf-renwu-entry{width:292px;height:86px;margin-left:0;border:1px solid rgba(201,168,95,.42);background:rgba(13,9,6,.54);position:relative;overflow:hidden;cursor:pointer;color:#f0d98c;box-shadow:0 8px 22px rgba(0,0,0,.38),inset 0 0 0 1px rgba(0,0,0,.45);}',
      '.tmf-renwu-entry img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.82;filter:saturate(.92) brightness(.78);}',
      '.tmf-renwu-entry span{position:absolute;right:18px;top:28px;font-size:22px;letter-spacing:.28em;text-shadow:0 2px 8px #000;}',
      '.tmf-renwu-entry:hover{border-color:#d8bd76;transform:translateX(2px);}',
      '.tmf-event-feed{width:286px;margin-left:0;min-height:0;flex:1;display:flex;flex-direction:column;border-left:2px solid rgba(126,184,167,.58);border-top:1px solid rgba(201,168,95,.22);border-bottom:1px solid rgba(201,168,95,.18);background:linear-gradient(180deg,rgba(18,13,9,.72),rgba(8,7,6,.66));box-shadow:0 8px 24px rgba(0,0,0,.34);}',
      '.tmf-event-feed header{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 9px;border-bottom:1px solid rgba(201,168,95,.18);}',
      '.tmf-event-feed header b{display:block;color:#f0d98c;font-size:15px;letter-spacing:.22em;font-weight:500;}',
      '.tmf-event-feed header span{display:block;margin-top:2px;color:#8f846f;font-size:11px;letter-spacing:.12em;}',
      '.tmf-event-feed select{height:28px;max-width:112px;border:1px solid rgba(201,168,95,.26);background:rgba(10,8,6,.82);color:#d8c27c;font-family:inherit;font-size:12px;}',
      '.tmf-event-list{min-height:0;overflow-y:auto;scrollbar-width:thin;scrollbar-color:rgba(201,168,95,.45) transparent;padding:7px 7px 9px;display:flex;flex-direction:column;gap:6px;}',
      '.tmf-event-row{display:grid;grid-template-columns:36px minmax(0,1fr) 42px;align-items:center;gap:7px;min-height:50px;border:1px solid rgba(201,168,95,.14);background:rgba(255,255,255,.025);color:#d7c49b;text-align:left;cursor:pointer;font-family:inherit;padding:6px;}',
      '.tmf-event-row:hover{border-color:rgba(201,168,95,.42);background:rgba(201,168,95,.075);}',
      '.tmf-event-turn{color:#8dbdab;font-size:11px;letter-spacing:0;}',
      '.tmf-event-main{min-width:0;}.tmf-event-main b{display:block;color:#e6cf8e;font-size:13px;letter-spacing:.08em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}.tmf-event-main em{display:block;margin-top:3px;color:#a99d83;font-style:normal;font-size:12px;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}',
      '.tmf-event-type{justify-self:end;color:#8f846f;font-size:11px;writing-mode:vertical-rl;letter-spacing:.12em;}',
      '.tmf-event-empty{padding:18px 12px;color:#9f9277;font-size:13px;line-height:1.7;text-align:center;}',
      '#tm-phase8-action-tray{position:absolute;left:16px;bottom:26px;width:432px;height:168px;z-index:27;pointer-events:none;}',
      '#tm-phase8-action-tray .tmf-desk-action{position:absolute;width:102px;height:146px;border:0;background:transparent;padding:0;cursor:pointer;pointer-events:auto;filter:drop-shadow(0 8px 10px rgba(0,0,0,.52));font-family:"STKaiti","KaiTi","楷体",serif;color:#3a2614;}',
      '#tm-phase8-action-tray .tmf-desk-action:nth-child(1){left:0;top:7px;transform:rotate(-2deg);}#tm-phase8-action-tray .tmf-desk-action:nth-child(2){left:108px;top:0;transform:rotate(1deg);}#tm-phase8-action-tray .tmf-desk-action:nth-child(3){left:216px;top:6px;transform:rotate(-1deg);}#tm-phase8-action-tray .tmf-desk-action:nth-child(4){left:324px;top:3px;transform:rotate(1.4deg);}',
      '#tm-phase8-action-tray .tmf-desk-action:hover{transform:translateY(-5px) rotate(0deg);filter:drop-shadow(0 12px 16px rgba(0,0,0,.65));}',
      '.tmf-desk-action img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;}',
      '.tmf-desk-action span{position:absolute;left:30px;right:24px;top:28px;bottom:28px;display:flex;flex-direction:column;align-items:center;justify-content:center;writing-mode:vertical-rl;text-shadow:0 1px 0 rgba(255,248,220,.55);}',
      '.tmf-desk-action b{font-size:20px;letter-spacing:.16em;font-weight:700;}.tmf-desk-action em{margin-top:8px;font-size:11px;letter-spacing:.18em;font-style:normal;color:#8c2f22;}',
      '.tmf-records-overlay,.tmf-event-detail{position:fixed;inset:0;z-index:9998;background:rgba(10,7,4,.72);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;font-family:"STKaiti","KaiTi","楷体",serif;}',
      '.tmf-records-dialog,.tmf-event-dialog{width:min(760px,86vw);max-height:78vh;background:linear-gradient(180deg,#211811,#100c08);border:1px solid rgba(201,168,95,.52);box-shadow:0 18px 60px rgba(0,0,0,.72);color:#eadfbd;display:flex;flex-direction:column;}',
      '.tmf-records-dialog header,.tmf-event-dialog header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 18px;border-bottom:1px solid rgba(201,168,95,.22);}.tmf-records-dialog header span,.tmf-event-dialog header span{color:#8dbdab;font-size:12px;letter-spacing:.18em;}.tmf-records-dialog h3,.tmf-event-dialog h3{margin:3px 0 0;color:#f0d98c;font-size:22px;letter-spacing:.18em;font-weight:500;}.tmf-event-dialog header p{margin:4px 0 0;color:#9f9277;font-size:12px;}',
      '.tmf-records-dialog header button,.tmf-event-dialog header button{width:28px;height:28px;border:1px solid rgba(201,168,95,.32);background:rgba(0,0,0,.18);color:#d8c27c;cursor:pointer;}',
      '.tmf-records-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:18px;}.tmf-records-grid button{min-height:118px;border:1px solid rgba(201,168,95,.28);background:linear-gradient(180deg,rgba(201,168,95,.08),rgba(0,0,0,.20));color:#eadfbd;font-family:inherit;cursor:pointer;padding:14px;text-align:left;}.tmf-records-grid b{display:block;color:#f0d98c;font-size:20px;letter-spacing:.22em;margin-bottom:12px;}.tmf-records-grid span{font-size:13px;color:#a99d83;line-height:1.55;}',
      '.tmf-event-dialog main{overflow-y:auto;white-space:pre-wrap;padding:22px 26px;font-size:16px;line-height:2;color:#d7c49b;}.tmf-event-dialog footer{display:flex;gap:8px;justify-content:flex-end;padding:12px 16px;border-top:1px solid rgba(201,168,95,.18);}.tmf-event-dialog footer button{border:1px solid rgba(201,168,95,.32);background:rgba(201,168,95,.08);color:#e6cf8e;font-family:inherit;padding:7px 12px;cursor:pointer;}',
      'body.tm-phase8-formal #gs-shizheng-btn{bottom:30px!important;min-width:210px!important;padding:9px 40px!important;border-color:rgba(166,132,74,.9)!important;background:linear-gradient(180deg,#f4e8cc 0%,#e7d8ac 62%,#cdb883 100%)!important;box-shadow:0 4px 18px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,248,225,.7)!important;font-size:15px!important;z-index:59!important;}',
      'body.tm-phase8-formal .gs-turn-float{right:70px;bottom:24px;}',
      'body.tm-phase8-formal .gs-turn-fab-bar{display:none!important;}',
      'body.tm-phase8-formal .gs-turn-big{min-width:300px;border-radius:2px;border-color:rgba(245,189,126,.72);background:linear-gradient(180deg,#c74837,#922f23);box-shadow:0 0 0 1px rgba(255,218,160,.16) inset,0 8px 28px rgba(0,0,0,.48);}',
      'body.tm-phase8-formal #shiji-btn{display:none!important;}',
      '@media(max-width:1200px){body.tm-phase8-formal .gc{padding-left:0;}#tm-phase8-left-surface{display:none;}#tm-phase8-action-tray{transform:scale(.86);transform-origin:left bottom;}}',
      '@media(max-width:900px){#tm-phase8-action-tray{display:none;}body.tm-phase8-formal #G{grid-template-columns:1fr 54px;}body.tm-phase8-formal .bar-weather{display:none;}body.tm-phase8-formal .bar-vars{overflow-x:auto;}body.tm-phase8-formal .bar-time{min-width:150px;}}'
    ].join('\n');
    document.head.appendChild(st);
  }

  function installFormalShell(){
    document.body.classList.add('tm-phase8-formal');
    installStyles();
    ensureRail();
    ensureFormalChrome();
    installContextMenu();
    markPinnedCards();
  }

  function wrapRenderRenwu(){
    if (window.renderRenwu && !window.renderRenwu.__phase8PinnedWrapped) {
      var old = window.renderRenwu;
      window.renderRenwu = function(){
        var ret = old.apply(this, arguments);
        setTimeout(markPinnedCards, 0);
        return ret;
      };
      window.renderRenwu.__phase8PinnedWrapped = true;
    }
    if (window.renderGameState && !window.renderGameState.__phase8FormalWrapped) {
      var oldRender = window.renderGameState;
      window.renderGameState = function(){
        var ret = oldRender.apply(this, arguments);
        setTimeout(function(){ ensureRail(); ensureFormalChrome(); markPinnedCards(); }, 0);
        return ret;
      };
      window.renderGameState.__phase8FormalWrapped = true;
    }
    if (window.addEB && !window.addEB.__phase8FormalWrapped) {
      var oldAddEB = window.addEB;
      window.addEB = function(){
        var ret = oldAddEB.apply(this, arguments);
        setTimeout(renderEventFeed, 0);
        return ret;
      };
      window.addEB.__phase8FormalWrapped = true;
    }
  }

  window.TMPhase8FormalBridge = {
    openPanel: openPanel,
    jump: jump,
    openLeft: openLeft,
    openGuoku: openGuoku,
    openKeju: openKeju,
    openChaoyi: openChaoyiMode,
    openAction: openAction,
    openRecordsMenu: openRecordsMenu,
    renderEventFeed: renderEventFeed,
    ensureChrome: ensureFormalChrome,
    pin: pinPerson,
    unpin: function(id){ pinPerson(id, false); },
    openRenwu: function(){ jump('gt-renwu'); },
    personAction: function(id, action){
      var p = findPerson(id);
      var name = p && p.name ? p.name : id;
      if (action === 'wendui') {
        if (window.GM) { GM.wenduiTarget = name; GM._pendingWenduiChar = name; }
        if (typeof window.openWenduiPick === 'function') window.openWenduiPick(name);
        else jump('gt-wendui');
      } else if (action === 'letter') {
        if (window.GM) GM._pendingLetterTo = name;
        jump('gt-letter');
      } else if (action === 'office') {
        jump('gt-office');
      } else if (action === 'detail') {
        if (typeof window.openCharRenwuPage === 'function') window.openCharRenwuPage(name);
        else if (typeof window.viewRenwu === 'function') window.viewRenwu(name);
        else jump('gt-renwu');
      }
    },
    refresh: function(){ ensureRail(); ensureFormalChrome(); markPinnedCards(); updateRailBadges(); renderEventFeed(); }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){ installFormalShell(); wrapRenderRenwu(); });
  } else {
    installFormalShell();
    wrapRenderRenwu();
  }
  setTimeout(function(){ installFormalShell(); wrapRenderRenwu(); }, 500);
})();
