// @ts-check
/// <reference path="types.d.ts" />
// ═══════════════════════════════════════════════════════════════
// 帑廪（国库）详情面板
// 设计：设计方案-财政系统.md
// 数据：GM.guoku
// ═══════════════════════════════════════════════════════════════

// 数字格式化
function _guokuFmt(v) {
  v = Math.round(v || 0);
  if (Math.abs(v) >= 1e8) return (v/1e8).toFixed(2) + '亿';
  if (Math.abs(v) >= 10000) return Math.round(v/10000) + '万';
  return v.toString();
}

// 跳转中间栏标签页（取代原操作按钮）
function _guokuTabJump(label, tabId) {
  var safeLabel = String(label).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
  return '<div style="padding:6px 10px;margin:3px 0;background:var(--bg-2);border-left:3px solid var(--gold-d);border-radius:3px;font-size:0.74rem;cursor:pointer;" ' +
    'onclick="if(typeof switchGTab===\'function\')switchGTab(null,\'' + tabId + '\');' +
    'document.querySelectorAll(\'.var-drawer-overlay\').forEach(function(o){o.classList.remove(\'open\');});">' +
    '→ <b>' + safeLabel + '</b>（切至标签页处理）' +
  '</div>';
}

// 开启面板
function openGuokuPanel() {
  var ov = document.getElementById('guoku-drawer-ov');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'guoku-drawer-ov';
    ov.className = 'var-drawer-overlay';
    ov.innerHTML = '<div class="var-drawer" id="guoku-drawer">'+
      '<div class="var-drawer-header">'+
        '<div>'+
          '<div class="var-drawer-title">帑廪之察 · 岁入岁出</div>'+
          '<div class="var-drawer-subtitle" id="guoku-subtitle"></div>'+
        '</div>'+
        '<button class="var-drawer-close" onclick="closeGuokuPanel()">×</button>'+
      '</div>'+
      '<div class="var-drawer-body" id="guoku-body"></div>'+
    '</div>';
    ov.addEventListener('click', function(e) {
      if (e.target === ov) closeGuokuPanel();
    });
    document.body.appendChild(ov);
  }
  ov.classList.add('open');   // 先打开抽屉（防止 render 抛错导致抽屉不弹）
  // 确保三账已初始化（首次打开时 CascadeTax 可能尚未跑过）
  try {
    if (typeof GuokuEngine !== 'undefined' && typeof GuokuEngine.ensureModel === 'function') GuokuEngine.ensureModel();
    if (typeof NeitangEngine !== 'undefined' && typeof NeitangEngine.ensureModel === 'function') NeitangEngine.ensureModel();
  } catch(_e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(_e, 'openGuokuPanel] ensureModel') : console.warn('[openGuokuPanel] ensureModel', _e); }
  try { renderGuokuPanel(); } catch(_re) {
    console.error('[openGuokuPanel] renderGuokuPanel threw:', _re);
    var body = document.getElementById('guoku-body');
    if (body) body.innerHTML = '<div style="padding:1rem;color:var(--vermillion-400);font-size:0.78rem;">渲染失败：' + (_re.message||_re) + '</div><pre style="font-size:0.62rem;color:var(--color-foreground-muted);white-space:pre-wrap;padding:0.5rem;">' + (_re.stack||'') + '</pre>';
  }
}

function closeGuokuPanel() {
  var ov = document.getElementById('guoku-drawer-ov');
  if (ov) ov.classList.remove('open');
}

function renderGuokuPanel() {
  var body = document.getElementById('guoku-body');
  var subt = document.getElementById('guoku-subtitle');
  if (!body) return;

  var g = GM.guoku || {};
  var subtLbl = '月入 ' + _guokuFmt(g.monthlyIncome || 0) + ' / 月支 ' + _guokuFmt(g.monthlyExpense || 0);
  if (g.bankruptcy && g.bankruptcy.active) subtLbl = '⚠ 破产 · ' + subtLbl;
  if (subt) subt.textContent = subtLbl;

  var html = '';

  // ─── § 总览（balance + 月度流水 + 趋势） ───
  html += '<section class="vd-section">';
  html += '<div class="vd-overview">';
  var balColor = g.balance < 0 ? 'var(--vermillion-400)' :
                 g.balance < (g.annualIncome || 1) * 0.1 ? 'var(--amber-400)' : 'var(--gold)';
  html += '<div class="vd-ov-row">'+
          '<span class="vd-ov-label">现余</span>'+
          '<span class="vd-ov-value" style="color:' + balColor + ';">' +
          _guokuFmt(g.balance) + ' ' + ((g.unit||{}).money || '两') + '</span></div>';
  html += '<div class="vd-ov-row">'+
          '<span class="vd-ov-label">月入 / 月支</span>'+
          '<span class="vd-ov-value">' + _guokuFmt(g.monthlyIncome || 0) + ' / ' +
          _guokuFmt(g.monthlyExpense || 0) + '</span></div>';
  var deltaColor = (g.lastDelta || 0) >= 0 ? '#6aa88a' : 'var(--vermillion-400)';
  html += '<div class="vd-ov-row">'+
          '<span class="vd-ov-label">本回合增减</span>'+
          '<span class="vd-ov-value" style="color:' + deltaColor + ';">' +
          ((g.lastDelta || 0) > 0 ? '+' : '') + _guokuFmt(g.lastDelta || 0) + '</span></div>';
  html += '<div class="vd-ov-row">'+
          '<span class="vd-ov-label">年入</span>'+
          '<span class="vd-ov-value">' + _guokuFmt(g.annualIncome || 0) + '</span></div>';
  if (g.actualTaxRate !== undefined && g.actualTaxRate < 1) {
    var leakPct = Math.round((1 - g.actualTaxRate) * 100);
    html += '<div class="vd-ov-row">'+
            '<span class="vd-ov-label">实征率</span>'+
            '<span class="vd-ov-value" style="color:var(--vermillion-400);">' +
            Math.round(g.actualTaxRate * 100) + '% （漏损 ' + leakPct + '%）</span></div>';
  }
  // 民心顺从度（§21.2）
  if (GM.minxin && GM.minxin.trueIndex !== undefined) {
    var compl = Math.max(0.3, GM.minxin.trueIndex / 100 * 0.7 + 0.3);
    var colorC = compl > 0.9 ? '#6aa88a' : compl > 0.6 ? 'var(--gold)' : 'var(--vermillion-400)';
    html += '<div class="vd-ov-row">'+
            '<span class="vd-ov-label">民心顺从</span>'+
            '<span class="vd-ov-value" style="color:' + colorC + ';">' +
            Math.round(compl * 100) + '%</span></div>';
  }
  // 皇权可支配性（§21.3）
  if (GM.huangquan) {
    var h = GM.huangquan.index;
    var hqLabel = h < 35 ? '权臣段（地方截留 50%）' :
                  h < 60 ? '制衡段（可支配 85%）' :
                  h > 80 ? '专制段（压榨 +5%）' : '常态';
    var hqColor = h < 35 ? 'var(--vermillion-400)' :
                  h < 60 ? 'var(--gold)' : '#6aa88a';
    html += '<div class="vd-ov-row">'+
            '<span class="vd-ov-label">皇权可调</span>'+
            '<span class="vd-ov-value" style="font-size:0.76rem;color:' + hqColor + ';">' +
            hqLabel + '</span></div>';
  }
  // 物价指数（粮价）
  if (GM.prices && GM.prices.grain) {
    var gp = GM.prices.grain;
    var gpColor = gp > 1.8 ? 'var(--vermillion-400)' :
                  gp > 1.3 ? 'var(--amber-400)' :
                  gp < 0.85 ? '#6aa88a' : 'var(--gold)';
    var gpLabel = gp > 2.0 ? '（粮荒）' :
                  gp > 1.5 ? '（粮贵）' :
                  gp < 0.9 ? '（谷贱）' : '';
    html += '<div class="vd-ov-row">'+
            '<span class="vd-ov-label">粮价指数</span>'+
            '<span class="vd-ov-value" style="color:' + gpColor + ';">' +
            gp.toFixed(2) + ' ×' + gpLabel + '</span></div>';
  }
  // 皇威虚账警示
  if (GM.huangwei && GM.huangwei.index >= 90) {
    var bubble = (GM.huangwei.tyrantSyndrome && GM.huangwei.tyrantSyndrome.hiddenDamage && GM.huangwei.tyrantSyndrome.hiddenDamage.fiscalBubble) || 0;
    html += '<div class="vd-ov-row">'+
            '<span class="vd-ov-label" style="color:var(--vermillion-400);">⚠ 暴君虚账</span>'+
            '<span class="vd-ov-value" style="color:var(--vermillion-400);font-size:0.76rem;">' +
            '累计 ' + _guokuFmt(bubble) + ' 两</span></div>';
  }
  html += '</div>';
  html += '</section>';

  // ─── § 三数对照 ───
  if (typeof renderTaxThreeNumberBlock === 'function' && g.monthlyIncome > 0) {
    html += '<section class="vd-section">';
    html += '<div class="vd-section-title">税赋三数 <span class="vd-badge">名义/官收/民缴</span></div>';
    html += renderTaxThreeNumberBlock(g.monthlyIncome, { label:'正赋钱粮 · 月入', unit:'两' });
    html += '</section>';
  }

  // ─── § 三账岁入（钱/粮/布 按税种分解 · 本回合 CascadeTax 结算） ───
  var ledgers = g.ledgers || {};
  var _U = (typeof CurrencyUnit !== 'undefined') ? CurrencyUnit.getUnit() : { money:'两', grain:'石', cloth:'匹' };
  var _threeKinds = [
    { key:'money', label:'钱账（' + _U.money + '）' },
    { key:'grain', label:'粮账（' + _U.grain + '）' },
    { key:'cloth', label:'布账（' + _U.cloth + '）' }
  ];
  var _tagNameMap = {
    tianfu:'田赋', dingshui:'丁税', yongBu:'庸役折布', shangShui:'商税',
    yanlizhuan:'盐铁专卖', caoliang:'漕粮', shipaiShui:'市舶', quanShui:'榷税',
    juanNa:'捐纳', qita:'其他'
  };
  html += '<section class="vd-section">';
  html += '<div class="vd-section-title">岁入分项 <span class="vd-badge">三账·本月</span></div>';
  var _anyIncome = false;
  _threeKinds.forEach(function(kind) {
    var led = ledgers[kind.key];
    if (!led) return;
    var srcMap = led.sources || {};
    var monthTotal = led.thisTurnIn || 0;
    var _sumSrc = 0;
    Object.keys(srcMap).forEach(function(tag){ _sumSrc += srcMap[tag] || 0; });
    var displayTotal = monthTotal || _sumSrc;
    if (displayTotal === 0) return;
    _anyIncome = true;
    html += '<div style="font-size:0.76rem;color:var(--gold-400);margin-top:6px;margin-bottom:3px;">' + kind.label + ' <span style="color:var(--txt-d);font-size:0.7rem;">本月 ' + _guokuFmt(displayTotal) + '</span></div>';
    Object.keys(srcMap).forEach(function(tag){
      var val = srcMap[tag];
      if (!val) return;
      var pct = displayTotal > 0 ? (val / displayTotal * 100).toFixed(1) : 0;
      var barW = displayTotal > 0 ? Math.min(100, val / displayTotal * 100) : 0;
      html += '<div style="display:grid;grid-template-columns:80px 1fr auto;gap:8px;align-items:center;padding:2px 0 2px 10px;font-size:0.74rem;">'+
        '<span style="color:var(--txt-d);">' + (_tagNameMap[tag] || tag) + '</span>'+
        '<div style="height:5px;background:var(--bg-3);border-radius:3px;overflow:hidden;">'+
          '<div style="height:100%;width:' + barW + '%;background:var(--gold-400);"></div>'+
        '</div>'+
        '<span style="color:var(--txt);font-size:0.72rem;">' + _guokuFmt(val) + ' <span style="color:var(--txt-d);">' + pct + '%</span></span>'+
        '</div>';
    });
  });
  if (!_anyIncome) {
    // fallback to legacy display
    var srcLabels = {
      tianfu:'田赋', dingshui:'丁税', caoliang:'漕粮', yanlizhuan:'盐铁专卖',
      shipaiShui:'市舶', quanShui:'榷税', juanNa:'捐纳', qita:'其他'
    };
    var sources = g.sources || {};
    var sourceTotal = 0;
    for (var k in sources) sourceTotal += (sources[k] || 0);
    if (sourceTotal > 0) {
      Object.keys(srcLabels).forEach(function(key) {
        var val = sources[key] || 0;
        if (!val && (key === 'shipaiShui' || key === 'juanNa' || key === 'qita')) return;
        var pct = (val / sourceTotal * 100).toFixed(1);
        var barW = Math.min(100, val / sourceTotal * 100);
        html += '<div style="display:grid;grid-template-columns:70px 1fr auto;gap:8px;align-items:center;padding:3px 0;font-size:0.78rem;">'+
          '<span style="color:var(--txt-d);">' + srcLabels[key] + '</span>'+
          '<div style="height:6px;background:var(--bg-3);border-radius:3px;overflow:hidden;">'+
            '<div style="height:100%;width:' + barW + '%;background:var(--gold-400);"></div>'+
          '</div>'+
          '<span style="color:var(--txt);font-size:0.72rem;">' + _guokuFmt(val) + ' <span style="color:var(--txt-d);">' + pct + '%</span></span>'+
          '</div>';
      });
    } else {
      html += '<div class="vd-empty">岁入尚未结算（等首次 endTurn 或配置税制）</div>';
    }
  }

  // 下回合预览（dry-run CascadeTax）——玩家推演前能预估
  if (typeof CascadeTax !== 'undefined' && typeof CascadeTax.collect === 'function' && GM.adminHierarchy && GM._lastCascadeSummary) {
    var last = GM._lastCascadeSummary;
    var _lbl = (g.turnDays && g.turnDays !== 30) ? ('每' + g.turnDays + '日') : '本回合';
    html += '<div style="margin-top:8px;padding:5px 8px;background:var(--bg-2);border-left:3px solid var(--celadon-400);border-radius:3px;font-size:0.7rem;color:var(--txt-d);">';
    html += _lbl + '结算：中央 ' + _guokuFmt(last.central.money) + _U.money + '·' + _guokuFmt(last.central.grain) + _U.grain + '·' + _guokuFmt(last.central.cloth) + _U.cloth;
    html += '；地方留存 ' + _guokuFmt(last.localRetain.money) + _U.money + '/' + _guokuFmt(last.localRetain.grain) + _U.grain;
    html += '；被贪 ' + _guokuFmt(last.skimmed.money) + _U.money + '；路耗 ' + _guokuFmt(last.lostTransit.money) + _U.money;
    html += '</div>';
  }
  // 自定义税种
  var customTaxes = g._customTaxStats || {};
  var customKeys = Object.keys(customTaxes);
  if (customKeys.length > 0) {
    html += '<div style="font-size:0.72rem;color:var(--gold);margin-top:6px;margin-bottom:4px;">自定义税种</div>';
    customKeys.forEach(function(key) {
      var ct = customTaxes[key];
      if (!ct.amount) return;
      html += '<div style="display:grid;grid-template-columns:90px 1fr auto;gap:8px;align-items:center;padding:3px 0;font-size:0.78rem;">'+
        '<span style="color:var(--txt-d);">' + _escHtml(ct.name) + '</span>'+
        '<div style="height:6px;background:var(--bg-3);border-radius:3px;overflow:hidden;">'+
          '<div style="height:100%;width:' + Math.min(100, ct.amount / sourceTotal * 100) + '%;background:var(--gold-300);"></div>'+
        '</div>'+
        '<span style="color:var(--txt);font-size:0.72rem;">' + _guokuFmt(ct.amount) + '</span>'+
        '</div>';
    });
  }
  html += '</section>';

  // ─── § 八类支出 ───
  html += '<section class="vd-section">';
  html += '<div class="vd-section-title">岁出分项 <span class="vd-badge">年度</span></div>';
  var expLabels = {
    fenglu:'俸禄', junxiang:'军饷', zhenzi:'赈济', gongcheng:'工程',
    jisi:'祭祀', shangci:'赏赐', neiting:'内廷转运', qita:'其他'
  };
  // 优先展示三账 sinks；否则 fallback 老 expenses
  var _anyExpense = false;
  _threeKinds.forEach(function(kind) {
    var led = ledgers[kind.key];
    if (!led) return;
    var sinkMap = led.sinks || {};
    var monthTotalOut = led.thisTurnOut || 0;
    var _sumSink = 0;
    Object.keys(sinkMap).forEach(function(tag){ _sumSink += sinkMap[tag] || 0; });
    var displayTotalOut = monthTotalOut || _sumSink;
    if (displayTotalOut === 0) return;
    _anyExpense = true;
    html += '<div style="font-size:0.76rem;color:var(--vermillion-400);margin-top:6px;margin-bottom:3px;">' + kind.label + ' <span style="color:var(--txt-d);font-size:0.7rem;">本月出 ' + _guokuFmt(displayTotalOut) + '</span></div>';
    Object.keys(sinkMap).forEach(function(tag){
      var val = sinkMap[tag];
      if (!val) return;
      var pct = displayTotalOut > 0 ? (val / displayTotalOut * 100).toFixed(1) : 0;
      var barW = displayTotalOut > 0 ? Math.min(100, val / displayTotalOut * 100) : 0;
      html += '<div style="display:grid;grid-template-columns:80px 1fr auto;gap:8px;align-items:center;padding:2px 0 2px 10px;font-size:0.74rem;">'+
        '<span style="color:var(--txt-d);">' + (expLabels[tag] || tag) + '</span>'+
        '<div style="height:5px;background:var(--bg-3);border-radius:3px;overflow:hidden;">'+
          '<div style="height:100%;width:' + barW + '%;background:var(--vermillion-400);"></div>'+
        '</div>'+
        '<span style="color:var(--txt);font-size:0.72rem;">' + _guokuFmt(val) + ' <span style="color:var(--txt-d);">' + pct + '%</span></span>'+
        '</div>';
    });
  });
  if (!_anyExpense) {
    var expenses = g.expenses || {};
    var expTotal = 0;
    for (var e in expenses) expTotal += (expenses[e] || 0);
    if (expTotal > 0) {
      Object.keys(expLabels).forEach(function(key) {
        var val = expenses[key] || 0;
        if (!val && (key === 'zhenzi' || key === 'gongcheng' || key === 'qita')) return;
        var pct = (val / expTotal * 100).toFixed(1);
        var barW = Math.min(100, val / expTotal * 100);
        html += '<div style="display:grid;grid-template-columns:70px 1fr auto;gap:8px;align-items:center;padding:3px 0;font-size:0.78rem;">'+
          '<span style="color:var(--txt-d);">' + expLabels[key] + '</span>'+
          '<div style="height:6px;background:var(--bg-3);border-radius:3px;overflow:hidden;">'+
            '<div style="height:100%;width:' + barW + '%;background:var(--vermillion-400);"></div>'+
          '</div>'+
          '<span style="color:var(--txt);font-size:0.72rem;">' + _guokuFmt(val) + ' <span style="color:var(--txt-d);">' + pct + '%</span></span>'+
          '</div>';
      });
    } else {
      html += '<div class="vd-empty">岁出尚未结算（俸禄/军饷/赈济 等在推演中叠加）</div>';
    }
  }
  html += '</section>';

  // ─── § 三账库存（钱/粮/布 + 本月流水） ───
  html += '<section class="vd-section">';
  html += '<div class="vd-section-title">三账库存 <span class="vd-badge">钱·粮·布</span></div>';
  html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;">';
  var ledgers = g.ledgers || {};
  var ledgerMeta = [
    ['money','钱', (g.unit||{}).money || '两', 'var(--gold-400)'],
    ['grain','粮', (g.unit||{}).grain || '石', '#6aa88a'],
    ['cloth','布', (g.unit||{}).cloth || '匹', '#a88a6a']
  ];
  ledgerMeta.forEach(function(m) {
    var led = ledgers[m[0]] || { stock:0 };
    var netLedger = (led.lastTurnIn || 0) - (led.lastTurnOut || 0);
    var netColor = netLedger >= 0 ? '#6aa88a' : 'var(--vermillion-400)';
    html += '<div style="padding:0.6rem;background:var(--bg-2);border-left:3px solid ' + m[3] + ';border-radius:4px;">'+
      '<div style="font-size:0.72rem;color:var(--txt-d);margin-bottom:2px;">' + m[1] + '</div>'+
      '<div style="font-size:0.95rem;color:' + m[3] + ';font-weight:600;">' + _guokuFmt(led.stock || 0) + '</div>'+
      '<div style="font-size:0.64rem;color:var(--txt-d);">' + m[2] + '</div>'+
      (m[0] !== 'money' && (led.lastTurnIn || led.lastTurnOut) ?
        '<div style="font-size:0.62rem;margin-top:3px;padding-top:3px;border-top:1px dashed var(--color-border-subtle);">'+
        '<span style="color:var(--txt-d);">入 ' + _guokuFmt(led.lastTurnIn || 0) + '</span> '+
        '<span style="color:' + netColor + ';">Δ' + (netLedger >= 0 ? '+' : '') + _guokuFmt(netLedger) + '</span>'+
        '</div>' : '') +
      '</div>';
  });
  html += '</div>';
  html += '</section>';

  // ─── § 漕运详情（若 caoliang 启用） ───
  if (g._caoyunStats && g._caoyunStats.nominal > 0) {
    var cs = g._caoyunStats;
    var lossPct = Math.round(cs.lossRate * 100);
    var lossColor = lossPct > 30 ? 'var(--vermillion-400)' : lossPct > 15 ? 'var(--amber-400)' : 'var(--gold)';
    html += '<section class="vd-section">';
    html += '<div class="vd-section-title">漕运详情 <span class="vd-badge" style="color:' + lossColor + ';">损 ' + lossPct + '%</span></div>';
    html += '<div style="display:grid;grid-template-columns:auto 1fr;gap:6px 12px;padding:0.6rem 0.8rem;background:var(--bg-2);border-radius:3px;font-size:0.78rem;">';
    html += '<span style="color:var(--txt-d);">名义岁漕</span><span>' + _guokuFmt(cs.nominal) + ' 两</span>';
    html += '<span style="color:var(--txt-d);">损耗</span><span style="color:' + lossColor + ';">-' + _guokuFmt(cs.lossAmount) + ' 两</span>';
    html += '<span style="color:var(--txt-d);">入仓</span><span style="color:#6aa88a;">' + _guokuFmt(cs.actual) + ' 两</span>';
    html += '</div>';
    if (lossPct > 25) {
      html += '<div style="font-size:0.72rem;color:var(--vermillion-400);margin-top:4px;">⚠ 漕运损耗过重，漕弊随时可发</div>';
    }
    html += '</section>';
  }

  // ─── § 地域分账（决策 G） ───
  var byRegion = g.byRegion || {};
  var regionIds = Object.keys(byRegion);
  if (regionIds.length > 0 && !(regionIds.length === 1 && regionIds[0] === 'national')) {
    html += '<section class="vd-section">';
    html += '<div class="vd-section-title">地域分账 <span class="vd-badge">' + regionIds.length + ' 区</span></div>';
    // 按 stock 排序，取前 10
    var sorted = regionIds.map(function(id) { return { id: id, data: byRegion[id] }; })
      .sort(function(a, b) { return (b.data.stock || 0) - (a.data.stock || 0); })
      .slice(0, 10);
    sorted.forEach(function(r) {
      var d = r.data;
      var netColor = (d.lastIn || 0) - (d.lastOut || 0) >= 0 ? '#6aa88a' : 'var(--vermillion-400)';
      html += '<div style="display:grid;grid-template-columns:1fr auto auto;gap:8px;align-items:center;padding:4px 8px;background:var(--bg-2);border-radius:3px;margin-bottom:2px;font-size:0.76rem;">'+
        '<span style="color:var(--txt);">' + _escHtml(d.name || r.id) + '</span>'+
        '<span style="color:var(--txt-d);">库存 ' + _guokuFmt(d.stock || 0) + '</span>'+
        '<span style="color:' + netColor + ';">Δ' +
          (((d.lastIn || 0) - (d.lastOut || 0)) >= 0 ? '+' : '') +
          _guokuFmt((d.lastIn || 0) - (d.lastOut || 0)) + '</span>'+
        '</div>';
    });
    if (regionIds.length > 10) {
      html += '<div style="font-size:0.7rem;color:var(--txt-d);margin-top:3px;text-align:center;">… 另 ' + (regionIds.length - 10) + ' 区</div>';
    }
    html += '</section>';
  }

  // ─── § 历史趋势（SVG） ───
  html += _guoku_renderTrendSection();

  // ─── § 破产预警（若接近） ───
  if (g.bankruptcy && g.bankruptcy.active) {
    html += '<section class="vd-section">';
    html += '<div class="vd-section-title" style="color:var(--vermillion-400);">⚠ 财政危机 <span class="vd-badge">已破产 ' + Math.round(g.bankruptcy.consecutiveMonths || 0) + ' 月</span></div>';
    html += '<div style="padding:0.8rem;background:rgba(192,64,48,0.1);border-left:3px solid var(--vermillion-400);border-radius:4px;">';
    html += '<div style="font-size:0.82rem;color:var(--txt);line-height:1.7;">';
    html += '帑廪亏空超 ' + Math.round(g.bankruptcy.severity * 100) + '% 年入。';
    if (g.bankruptcy.consecutiveMonths > 6) html += '持续 6+ 月，恐生兵变/民变。';
    html += '<br>已连锁：皇权 -10 · 皇威 -15 · 俸薄腐败源 +15';
    html += '</div></div></section>';
  } else if (g.balance < (g.annualIncome || 1) * 0.2) {
    html += '<section class="vd-section">';
    html += '<div style="padding:0.6rem;background:rgba(184,140,60,0.1);border-left:3px solid var(--amber-400);border-radius:4px;font-size:0.78rem;color:var(--txt);">';
    html += '⚠ 帑廪不足年入 20%，建议备急';
    html += '</div></section>';
  }

  // ─── § 状态摘要 + 跳转提示（原操作按钮已改走 13 中间标签页） ───
  html += '<section class="vd-section">';
  var emergency = g.emergency || {};
  var loans = (emergency.loans || []);
  if (loans.length > 0) {
    html += '<div style="font-size:0.76rem;color:var(--amber-400);padding:5px 8px;background:rgba(184,140,60,0.08);border-left:3px solid var(--amber-400);border-radius:3px;margin-bottom:4px;">⊕ 借贷在册 ' + loans.length + ' 笔</div>';
  }
  if (GM.currency && GM.currency.inflationPressure > 0.3) {
    html += '<div style="font-size:0.76rem;color:var(--vermillion-400);padding:5px 8px;background:rgba(192,64,48,0.08);border-left:3px solid var(--vermillion-400);border-radius:3px;margin-bottom:4px;">⚠ 通胀压力 ' + (GM.currency.inflationPressure).toFixed(2) + '，市面疑虑</div>';
  } else if (GM.currency && GM.currency.latestCoin) {
    html += '<div style="font-size:0.76rem;color:#6aa88a;padding:5px 8px;background:rgba(106,168,138,0.08);border-left:3px solid #6aa88a;border-radius:3px;margin-bottom:4px;">✓ 当朝新钱：' + GM.currency.latestCoin + '</div>';
  }
  var privateBanned = GM.currency && GM.currency.privateCastBanned;
  if (privateBanned) {
    html += '<div style="font-size:0.76rem;color:#6aa88a;padding:5px 8px;background:rgba(106,168,138,0.08);border-radius:3px;margin-bottom:4px;">✓ 私铸已禁，钱法肃然</div>';
  }
  html += '<div class="vd-section-title" style="margin-top:6px;">如何措置</div>';
  html += _guokuTabJump('写诏（加派/赈济/减赋/铸币/改革/禁私铸 皆由诏令发起）', 'gt-edict');
  html += _guokuTabJump('看奏疏（户部/漕运/铸币 主管大臣的奏报与建言）', 'gt-memorial');
  html += _guokuTabJump('问对户部尚书/户部侍郎 请教财政之弊', 'gt-wendui');
  html += _guokuTabJump('朝议（发行纸钞/重大改革 等争议事）', 'gt-chaoyi');
  html += '<div style="font-size:0.7rem;color:var(--txt-d);margin-top:6px;">※ 陛下只需写诏令（自然语言可），AI 按当前帑廪/民心/皇威 局势推演结果。</div>';
  html += '</section>';

  // ─── § 财政改革（4 大历史改革） ───
  if (typeof GuokuEngine !== 'undefined' && GuokuEngine.FISCAL_REFORMS) {
    html += '<section class="vd-section">';
    html += '<div class="vd-section-title">财政改革 <span class="vd-badge">千古变法</span></div>';
    var ongoing = (g.ongoingReforms || []);
    var completed = (g.completedReforms || []);
    // 施行中
    if (ongoing.length > 0) {
      html += '<div style="font-size:0.72rem;color:var(--gold-l);margin-bottom:4px;">施行中</div>';
      ongoing.forEach(function(o) {
        var r = GuokuEngine.FISCAL_REFORMS[o.id];
        if (!r) return;
        var leftTurn = Math.max(0, o.endTurn - GM.turn);
        html += '<div style="padding:5px 8px;background:var(--bg-2);border-left:3px solid var(--gold);border-radius:3px;margin-bottom:3px;font-size:0.76rem;">'+
          '<span style="color:var(--gold);">' + r.name + '</span>' +
          '<span style="color:var(--txt-d);margin-left:8px;">余 ' + leftTurn + ' 回合</span>' +
          '</div>';
      });
    }
    // 已完成
    if (completed.length > 0) {
      html += '<div style="font-size:0.72rem;color:#6aa88a;margin:4px 0;">已完成</div>';
      completed.forEach(function(id) {
        var r = GuokuEngine.FISCAL_REFORMS[id];
        if (!r) return;
        html += '<div style="padding:5px 8px;background:var(--bg-2);border-left:3px solid #6aa88a;border-radius:3px;margin-bottom:3px;font-size:0.76rem;color:var(--txt-d);">'+
          '<span style="color:#6aa88a;">✓ ' + r.name + '</span>' +
          '</div>';
      });
    }
    // 可选
    var available = [];
    Object.keys(GuokuEngine.FISCAL_REFORMS).forEach(function(id) {
      var check = GuokuEngine.canEnactReform(id);
      if (check.can) available.push(id);
    });
    // 可行改革只作参考列表（不再提供点击施行按钮，玩家通过诏令/朝议发起）
    html += '<div style="font-size:0.72rem;color:var(--txt-d);margin:4px 0;">可行参考</div>';
    if (available.length > 0) {
      available.forEach(function(id) {
        var r = GuokuEngine.FISCAL_REFORMS[id];
        html += '<div style="padding:5px 8px;background:var(--bg-2);border-left:3px solid var(--gold-d);border-radius:3px;margin-bottom:3px;font-size:0.76rem;">'+
          '<span style="color:var(--gold);">' + r.name + '</span>' +
          '<span style="color:var(--txt-d);margin-left:8px;">' + r.historical + ' · ' + r.durationMonths + ' 月</span>' +
          '</div>';
      });
      html += '<div style="font-size:0.7rem;color:var(--txt-d);margin-top:4px;">※ 欲施行改革请在【诏令】写诏，如"推行一条鞭法…"</div>';
    } else {
      html += '<div class="vd-empty" style="padding:6px;">暂无改革可行（需皇权/皇威/民心达标）</div>';
    }
    // 不可行（简要列出条件）
    var blocked = [];
    Object.keys(GuokuEngine.FISCAL_REFORMS).forEach(function(id) {
      if (available.indexOf(id) === -1 &&
          ongoing.findIndex(function(o) { return o.id === id; }) < 0 &&
          completed.indexOf(id) === -1) {
        blocked.push({ id: id, reason: GuokuEngine.canEnactReform(id).reason });
      }
    });
    if (blocked.length > 0) {
      html += '<details style="margin-top:4px;font-size:0.7rem;color:var(--txt-d);">' +
        '<summary style="cursor:pointer;">未达条件 (' + blocked.length + ')</summary>';
      blocked.forEach(function(b) {
        var r = GuokuEngine.FISCAL_REFORMS[b.id];
        html += '<div style="padding:3px 6px;margin-top:2px;">' +
          '<b>' + r.name + '</b>：' + b.reason + '</div>';
      });
      html += '</details>';
    }
    html += '</section>';
  }

  // ─── § 年度决算（含 byRegion） ───
  var yearly = (g.history && g.history.yearly) || [];
  if (yearly.length > 0) {
    html += '<section class="vd-section">';
    html += '<div class="vd-section-title">年度决算 <span class="vd-badge">' + yearly.length + ' 年</span></div>';
    yearly.slice(-5).reverse().forEach(function(y, idx) {
      var netColor = y.netChange >= 0 ? '#6aa88a' : 'var(--vermillion-400)';
      var yId = 'ny-' + y.year + '-' + idx;
      html += '<div style="background:var(--bg-2);border-radius:3px;margin-bottom:3px;">';
      html += '<div style="display:flex;justify-content:space-between;padding:5px 8px;font-size:0.78rem;cursor:pointer;" '+
        'onclick="document.getElementById(\'' + yId + '\').style.display=document.getElementById(\'' + yId + '\').style.display===\'none\'?\'block\':\'none\';">'+
        '<span style="color:var(--txt);">' + y.year + '年</span>'+
        '<span style="color:var(--txt-d);">入 ' + _guokuFmt(y.totalIncome) + ' · 出 ' + _guokuFmt(y.totalExpense) + '</span>'+
        '<span style="color:' + netColor + ';">' + (y.netChange >= 0 ? '+' : '') + _guokuFmt(y.netChange) + '</span>'+
        '</div>';
      // 按 region 明细（折叠）
      if (y.byRegion && Object.keys(y.byRegion).length > 0) {
        html += '<div id="' + yId + '" style="display:none;padding:0 10px 8px;border-top:1px dashed var(--color-border-subtle);">';
        html += '<div style="font-size:0.7rem;color:var(--txt-d);padding:4px 0;">地域分账（按本年累计）</div>';
        var regionList = Object.keys(y.byRegion).map(function(rid) {
          return { id: rid, data: y.byRegion[rid] };
        }).sort(function(a, b) { return (b.data.net || 0) - (a.data.net || 0); });
        regionList.slice(0, 8).forEach(function(r) {
          var d = r.data;
          var rNetColor = d.net >= 0 ? '#6aa88a' : 'var(--vermillion-400)';
          html += '<div style="display:flex;justify-content:space-between;font-size:0.72rem;padding:2px 4px;">'+
            '<span style="color:var(--txt);">' + _escHtml(d.name || r.id) + '</span>'+
            '<span style="color:var(--txt-d);">入 ' + _guokuFmt(d.cumIn) + ' · 出 ' + _guokuFmt(d.cumOut) + '</span>'+
            '<span style="color:' + rNetColor + ';">' + (d.net >= 0 ? '+' : '') + _guokuFmt(d.net) + '</span>'+
            '</div>';
        });
        if (regionList.length > 8) {
          html += '<div style="font-size:0.66rem;color:var(--txt-d);text-align:center;margin-top:2px;">… 另 ' + (regionList.length - 8) + ' 区</div>';
        }
        html += '</div>';
      }
      html += '</div>';
    });
    html += '</section>';
  }

  body.innerHTML = html;
}

// ─── 趋势图（SVG）───
function _guoku_renderTrendSection() {
  var snapshots = ((GM.guoku && GM.guoku.history && GM.guoku.history.monthly) || []);
  if (snapshots.length < 2) {
    return '<section class="vd-section">'+
      '<div class="vd-section-title">历史趋势 <span class="vd-badge">待累积</span></div>'+
      '<div class="vd-empty">需至少 2 回合数据方可展示</div>'+
    '</section>';
  }
  var data = snapshots.slice(-60);
  var W = 400, H = 110, PAD = { l:40, r:8, t:8, b:22 };
  var innerW = W - PAD.l - PAD.r, innerH = H - PAD.t - PAD.b;

  var maxB = 0, minB = 0;
  data.forEach(function(d) {
    if (d.balance > maxB) maxB = d.balance;
    if (d.balance < minB) minB = d.balance;
  });
  if (maxB === minB) maxB = minB + 1;

  var maxTurn = data[data.length - 1].turn, minTurn = data[0].turn;
  var spanT = Math.max(1, maxTurn - minTurn);
  function xOf(t) { return PAD.l + (t - minTurn) / spanT * innerW; }
  function yOf(v) { return PAD.t + (1 - (v - minB) / (maxB - minB)) * innerH; }

  var pts = data.map(function(d) { return [xOf(d.turn), yOf(d.balance)]; });
  var pathD = pts.map(function(p, i) { return (i === 0 ? 'M' : 'L') + p[0] + ',' + p[1]; }).join(' ');

  var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto;">';
  // 零轴线
  if (minB < 0 && maxB > 0) {
    var zy = yOf(0);
    svg += '<line x1="' + PAD.l + '" y1="' + zy + '" x2="' + (W - PAD.r) + '" y2="' + zy +
           '" stroke="var(--vermillion-400)" stroke-width="0.5" stroke-dasharray="3,3" opacity="0.5"/>';
  }
  // 起止值
  svg += '<text x="2" y="' + (PAD.t + 8) + '" font-size="9" fill="var(--txt-d)">' + _guokuFmt(maxB) + '</text>';
  svg += '<text x="2" y="' + (H - PAD.b + 4) + '" font-size="9" fill="var(--txt-d)">' + _guokuFmt(minB) + '</text>';
  // 填充区
  var fillPath = pathD + ' L' + pts[pts.length-1][0] + ',' + yOf(minB) + ' L' + pts[0][0] + ',' + yOf(minB) + ' Z';
  svg += '<path d="' + fillPath + '" fill="rgba(184,154,83,0.15)"/>';
  // 主线
  svg += '<path d="' + pathD + '" fill="none" stroke="var(--gold-400)" stroke-width="2"/>';
  // x 轴
  svg += '<text x="' + PAD.l + '" y="' + (H - 6) + '" font-size="9" fill="var(--txt-d)">T' + minTurn + '</text>';
  svg += '<text x="' + (W - PAD.r) + '" y="' + (H - 6) + '" text-anchor="end" font-size="9" fill="var(--txt-d)">T' + maxTurn + '</text>';
  svg += '</svg>';

  return '<section class="vd-section">'+
    '<div class="vd-section-title">帑廪趋势 <span class="vd-badge">' + data.length + ' 月</span></div>'+
    '<div style="background:var(--bg-2);border-radius:4px;padding:4px 8px;">' + svg + '</div>'+
    '</section>';
}

// ─── 紧急措施按钮 handlers ───
function _guoku_confirm(title, desc, costHtml, confirmLabel, fn) {
  var html = '<div style="padding:1rem;">'+
    '<h4 style="color:var(--gold);margin-bottom:0.6rem;">' + title + '</h4>'+
    '<p style="font-size:0.85rem;line-height:1.6;color:var(--txt);margin-bottom:0.8rem;">' + desc + '</p>'+
    '<div style="font-size:0.78rem;color:var(--txt-d);padding:0.5rem 0.7rem;background:var(--bg-2);border-radius:4px;border-left:3px solid var(--gold-d);">'+
      costHtml + '</div></div>';
  if (typeof openGenericModal !== 'function') return;
  openGenericModal(title, html, function() {
    try {
      var r = fn();
      if (r && r.success === false) {
        if (typeof toast === 'function') toast('未成：' + (r.reason || '条件不足'));
      } else {
        if (typeof toast === 'function') toast('已施行：' + title);
      }
    } catch(e) {
      console.error('[guoku] action error:', e);
      if (typeof toast === 'function') toast('执行出错');
    }
    if (typeof closeGenericModal === 'function') closeGenericModal();
    renderGuokuPanel();
    if (typeof renderTopBarVars === 'function') renderTopBarVars();
  });
  setTimeout(function() {
    var sb = document.getElementById('gm-save-btn');
    if (sb && confirmLabel) sb.textContent = confirmLabel;
    var cb = document.querySelector('#gm-overlay .generic-modal-footer .bt.bs');
    if (cb) cb.textContent = '罢';
  }, 10);
}

function _guoku_extraTax() {
  // 三档加派
  var html = '<div style="padding:1rem;">'+
    '<h4 style="color:var(--gold);margin-bottom:0.6rem;">加派赋税</h4>'+
    '<p style="font-size:0.82rem;line-height:1.6;color:var(--txt);margin-bottom:0.8rem;">历代财政紧急时行之。选档次：</p>'+
    '<div style="display:grid;grid-template-columns:1fr;gap:6px;">'+
      '<button class="vd-action-btn" onclick="_guoku_doExtraTax(0.2)">'+
        '<div>20% · 薄赋加派</div><span class="cost">民心 -3 · 腐败 +2</span></button>'+
      '<button class="vd-action-btn dangerous" onclick="_guoku_doExtraTax(0.5)">'+
        '<div>50% · 五成加派</div><span class="cost">民心 -7 · 腐败 +5</span></button>'+
      '<button class="vd-action-btn dangerous" onclick="_guoku_doExtraTax(1.0)">'+
        '<div>100% · 三饷式加派</div><span class="cost">民心 -15 · 末世之兆</span></button>'+
    '</div></div>';
  if (typeof openGenericModal === 'function') openGenericModal('加派赋税', html, null);
}
function _guoku_doExtraTax(rate) {
  var r = GuokuEngine.Actions.extraTax(rate);
  if (r.success) {
    if (typeof toast === 'function') toast('已加派 ' + Math.round(rate*100) + '%');
    if (typeof closeGenericModal === 'function') closeGenericModal();
  }
  renderGuokuPanel();
  if (typeof renderTopBarVars === 'function') renderTopBarVars();
}

function _guoku_openGranary() {
  var html = '<div style="padding:1rem;">'+
    '<h4 style="color:var(--gold);margin-bottom:0.6rem;">开仓赈济</h4>'+
    '<div style="display:grid;grid-template-columns:1fr;gap:6px;">'+
      '<button class="vd-action-btn" onclick="_guoku_doOpenGranary(\'county\')">'+
        '<div>州县赈济</div><span class="cost">5 万两 · 民心 +3</span></button>'+
      '<button class="vd-action-btn" onclick="_guoku_doOpenGranary(\'regional\')">'+
        '<div>一省大赈</div><span class="cost">15 万两 · 民心 +8</span></button>'+
      '<button class="vd-action-btn" onclick="_guoku_doOpenGranary(\'national\')">'+
        '<div>普天大赈</div><span class="cost">50 万两 · 民心 +15</span></button>'+
    '</div></div>';
  if (typeof openGenericModal === 'function') openGenericModal('开仓赈济', html, null);
}
function _guoku_doOpenGranary(scale) {
  var r = GuokuEngine.Actions.openGranary(scale);
  if (typeof toast === 'function') toast(r.success ? '已开仓' : ('未成：' + r.reason));
  if (typeof closeGenericModal === 'function') closeGenericModal();
  renderGuokuPanel();
  if (typeof renderTopBarVars === 'function') renderTopBarVars();
}

function _guoku_takeLoan() {
  var sources = GuokuEngine.LOAN_SOURCES || {};
  var html = '<div style="padding:1rem;">'+
    '<h4 style="color:var(--gold);margin-bottom:0.6rem;">借贷</h4>'+
    '<p style="font-size:0.82rem;line-height:1.6;color:var(--txt);margin-bottom:0.8rem;">'+
      '可同时并存多笔借款。每月按本息折付。选来源：'+
    '</p>'+
    '<div style="display:grid;grid-template-columns:1fr;gap:6px;">';
  Object.keys(sources).forEach(function(sid) {
    var s = sources[sid];
    var isForeign = sid === 'foreignLoan';
    var cls = isForeign ? 'vd-action-btn dangerous' : 'vd-action-btn';
    html += '<button class="' + cls + '" onclick="_guoku_openLoanDialog(\'' + sid + '\')">'+
      '<div>' + s.name + '（' + (s.interest * 100).toFixed(1) + '%/月）</div>'+
      '<span class="cost">上限 ' + Math.round(s.maxAmount/10000) + ' 万 · ' + s.historical + '</span>'+
      '</button>';
  });
  html += '</div></div>';
  if (typeof openGenericModal === 'function') openGenericModal('选借贷来源', html, null);
}

function _guoku_openLoanDialog(sourceId) {
  var src = GuokuEngine.LOAN_SOURCES[sourceId];
  if (!src) return;
  var html = '<div style="padding:1rem;">'+
    '<h4 style="color:var(--gold);margin-bottom:0.5rem;">' + src.name + '</h4>'+
    '<div style="font-size:0.72rem;color:var(--txt-d);margin-bottom:0.6rem;">' + src.historical + '</div>'+
    '<div class="form-group" style="margin-bottom:0.6rem;">'+
      '<label style="font-size:0.78rem;display:block;margin-bottom:2px;">金额（两）</label>'+
      '<input id="loanAmt" type="number" value="' + Math.round(src.maxAmount * 0.5) +
      '" max="' + src.maxAmount + '" min="10000" style="width:100%;padding:5px 8px;">'+
      '<div style="font-size:0.7rem;color:var(--txt-d);margin-top:2px;">上限 ' + src.maxAmount.toLocaleString() + '</div>'+
    '</div>'+
    '<div class="form-group" style="margin-bottom:0.6rem;">'+
      '<label style="font-size:0.78rem;display:block;margin-bottom:2px;">期限（月）</label>'+
      '<input id="loanTerm" type="number" value="12" min="6" max="60" style="width:100%;padding:5px 8px;">'+
    '</div>'+
    '<div style="font-size:0.72rem;color:var(--txt-d);padding:0.4rem 0.6rem;background:var(--bg-2);border-radius:3px;">'+
      '利率：' + (src.interest * 100).toFixed(1) + '%/月 · 月付本金 = 本金/期限 + 本金×利率'+
    '</div>'+
    '</div>';
  if (typeof openGenericModal === 'function') {
    openGenericModal('借贷于' + src.name, html, function() {
      var amt = Number((document.getElementById('loanAmt')||{}).value) || 100000;
      var term = Number((document.getElementById('loanTerm')||{}).value) || 12;
      var r = GuokuEngine.takeLoanBySource(sourceId, amt, term);
      if (typeof toast === 'function') toast(r.success ? ('已借于' + src.name) : ('未成：' + r.reason));
      if (typeof closeGenericModal === 'function') closeGenericModal();
      renderGuokuPanel();
      if (typeof renderTopBarVars === 'function') renderTopBarVars();
    });
  }
}

function _guoku_showLoans() {
  var loans = (GM.guoku.emergency && GM.guoku.emergency.loans) || [];
  var html = '<div style="padding:1rem;">'+
    '<h4 style="color:var(--gold);margin-bottom:0.6rem;">在借款项（' + loans.length + ' 笔）</h4>';
  if (loans.length === 0) {
    html += '<div class="vd-empty">无借款</div>';
  } else {
    loans.forEach(function(L) {
      var monthlyPayment = L.principal * (1 / L.totalTerm + L.interestRate);
      html += '<div style="padding:6px 10px;background:var(--bg-2);border-left:3px solid var(--gold-d);border-radius:3px;margin-bottom:4px;font-size:0.78rem;">'+
        '<div style="color:var(--gold);font-weight:500;">' + L.sourceName + '</div>'+
        '<div style="color:var(--txt-d);margin-top:3px;">'+
          '本金 ' + _guokuFmt(L.principal) + ' · 利率 ' + (L.interestRate * 100).toFixed(1) + '% · 月付 ' + _guokuFmt(monthlyPayment) +
          ' · 余 ' + Math.round(L.monthsLeft) + '/' + L.totalTerm + ' 月</div>'+
        '</div>';
    });
  }
  html += '<div style="margin-top:0.6rem;"><button class="vd-action-btn" onclick="_guoku_takeLoan()">⊕ 新借一笔</button></div></div>';
  if (typeof openGenericModal === 'function') openGenericModal('借贷详情', html, null);
}

async function _guoku_fiscalAdvisor() {
  // 加载中
  var html = '<div style="padding:1.2rem;text-align:center;">'+
    '<div style="font-size:0.88rem;color:var(--txt-s);line-height:1.8;">户部尚书参议中……</div></div>';
  if (typeof openGenericModal === 'function') openGenericModal('户部参议', html, null);

  if (!GuokuEngine || !GuokuEngine.aiFiscalAdvisor) {
    _showFiscalAdvice('户部系统未就绪', false);
    return;
  }
  try {
    var r = await GuokuEngine.aiFiscalAdvisor();
    _showFiscalAdvice(r.analysis || '臣恭候陛下圣裁', r.available);
  } catch(e) {
    console.error('[guoku] fiscalAdvisor:', e);
    _showFiscalAdvice('户部参议暂难作答', false);
  }
}

function _showFiscalAdvice(analysis, wasAI) {
  var html = '<div style="padding:1rem;">'+
    '<h4 style="color:var(--gold);margin-bottom:0.6rem;">户部参议' + (wasAI ? '' : '（规则版）') + '</h4>'+
    '<div style="font-size:0.86rem;line-height:1.9;color:var(--txt);padding:0.7rem 0.9rem;'+
      'background:var(--bg-2);border-left:3px solid var(--gold-d);border-radius:3px;white-space:pre-wrap;">' +
      _escHtml(analysis || '') + '</div>'+
    '</div>';
  if (typeof closeGenericModal === 'function') closeGenericModal();
  if (typeof openGenericModal === 'function') openGenericModal('户部参议', html, null);
}

// ─── AI 漕运预警 ───
async function _guoku_caoyunWarning() {
  var html = '<div style="padding:1.2rem;text-align:center;"><div style="font-size:0.88rem;color:var(--txt-s);">漕运总督奏覆中……</div></div>';
  if (typeof openGenericModal === 'function') openGenericModal('漕运预警', html, null);
  try {
    var r = await GuokuEngine.aiCaoyunWarning();
    var wasAI = r.available;
    var out = '<div style="padding:1rem;">'+
      '<h4 style="color:var(--gold);margin-bottom:0.6rem;">漕运预警' + (wasAI ? '' : '（规则版）') + '</h4>'+
      '<div style="font-size:0.86rem;line-height:1.9;color:var(--txt);padding:0.7rem 0.9rem;'+
        'background:var(--bg-2);border-left:3px solid var(--gold-d);border-radius:3px;white-space:pre-wrap;">' +
        _escHtml(r.analysis || '') + '</div></div>';
    if (typeof closeGenericModal === 'function') closeGenericModal();
    if (typeof openGenericModal === 'function') openGenericModal('漕运预警', out, null);
  } catch(e) {
    if (typeof toast === 'function') toast('预警失败：' + e.message);
  }
}

// ─── AI 税种建议 ───
async function _guoku_taxAdvisor() {
  var html = '<div style="padding:1.2rem;text-align:center;"><div style="font-size:0.88rem;color:var(--txt-s);">户部左侍郎参议中……</div></div>';
  if (typeof openGenericModal === 'function') openGenericModal('税制建言', html, null);
  try {
    var r = await GuokuEngine.aiTaxAdvisor();
    var wasAI = r.available;
    var out = '<div style="padding:1rem;">'+
      '<h4 style="color:var(--gold);margin-bottom:0.6rem;">税制建言' + (wasAI ? '' : '（规则版）') + '</h4>'+
      '<div style="font-size:0.86rem;line-height:1.9;color:var(--txt);padding:0.7rem 0.9rem;'+
        'background:var(--bg-2);border-left:3px solid var(--gold-d);border-radius:3px;white-space:pre-wrap;">' +
        _escHtml(r.analysis || '') + '</div></div>';
    if (typeof closeGenericModal === 'function') closeGenericModal();
    if (typeof openGenericModal === 'function') openGenericModal('税制建言', out, null);
  } catch(e) {
    if (typeof toast === 'function') toast('参议失败：' + e.message);
  }
}

function _guoku_cutOfficials() {
  _guoku_confirm('裁冗员',
    '裁 10% 冗员，省俸禄。官员离心，皇权受损。',
    '代价：皇权 -2 · 官员怨气',
    '裁员', function() { return GuokuEngine.Actions.cutOfficials(0.1); });
}

function _guoku_reduceTax() {
  _guoku_confirm('减赋',
    '减 20% 田赋，长线惠民。短期帑廪入减，长线民心皇威升。',
    '代价：年入 -20% · 收益：民心 +6 · 皇威 +2',
    '减赋', function() { return GuokuEngine.Actions.reduceTax(0.2); });
}

function _guoku_issuePaper() {
  _guoku_confirm('发行纸钞',
    '宋金元明清险招。立得 50 万两，但皇威损、通胀风险、民信动摇。',
    '代价：皇威 -8 · 民心 -5 · 通胀压力',
    '发钞', function() { return GuokuEngine.Actions.issuePaperCurrency(500000); });
}

// ─── 改革详情查看与推行 ───
function _guoku_viewReform(reformId) {
  var r = GuokuEngine.FISCAL_REFORMS[reformId];
  if (!r) return;
  var eff = r.effects || {};

  var html = '<div style="padding:1rem;">'+
    '<h4 style="color:var(--gold);margin-bottom:0.4rem;">' + r.name + '</h4>'+
    '<div style="font-size:0.72rem;color:var(--txt-d);margin-bottom:0.6rem;">' + r.historical + '</div>'+
    '<p style="font-size:0.85rem;line-height:1.7;color:var(--txt);margin-bottom:0.8rem;">' + r.desc + '</p>';

  html += '<div style="font-size:0.78rem;padding:0.5rem 0.7rem;background:var(--bg-2);border-left:3px solid var(--gold);border-radius:3px;margin-bottom:0.6rem;">';
  html += '<div style="color:var(--gold);margin-bottom:4px;">前提</div>';
  var pre = r.prerequisites || {};
  var preLines = [];
  if (pre.huangquan) preLines.push('皇权 ≥ ' + pre.huangquan);
  if (pre.huangwei) preLines.push('皇威 ≥ ' + pre.huangwei);
  if (pre.minxin) preLines.push('民心 ≥ ' + pre.minxin);
  html += preLines.join(' · ');
  html += '<div style="color:var(--gold);margin-top:6px;margin-bottom:4px;">施行期</div>' +
          r.durationMonths + ' 月（期间月支增 8% 管理费）';
  html += '<div style="color:var(--gold);margin-top:6px;margin-bottom:4px;">成效</div>';
  var effLines = [];
  if (eff.sourceMultipliers) {
    var srcLabels = { tianfu:'田赋', dingshui:'丁税', caoliang:'漕粮' };
    for (var k in eff.sourceMultipliers) {
      effLines.push((srcLabels[k] || k) + ' ×' + eff.sourceMultipliers[k]);
    }
  }
  if (eff.corruptionDelta) {
    var corrLines = [];
    for (var d in eff.corruptionDelta) corrLines.push(d + ' ' + eff.corruptionDelta[d]);
    effLines.push('腐败：' + corrLines.join(' · '));
  }
  if (eff.minxinDelta) effLines.push('民心 ' + (eff.minxinDelta > 0 ? '+' : '') + eff.minxinDelta);
  if (eff.huangweiDelta) effLines.push('皇威 ' + (eff.huangweiDelta > 0 ? '+' : '') + eff.huangweiDelta);
  if (eff.hiddenHouseholdDelta) effLines.push('隐户 ' + Math.round(eff.hiddenHouseholdDelta*100) + '%');
  if (eff.populationGrowthBonus) effLines.push('户口增速 +' + Math.round(eff.populationGrowthBonus*100) + '%');
  html += effLines.join('<br>');
  if (eff.note) html += '<div style="margin-top:6px;color:var(--txt-d);font-style:italic;">备注：' + eff.note + '</div>';
  html += '</div>';

  html += '<button class="vd-action-btn" onclick="_guoku_doEnactReform(\'' + reformId + '\')" style="width:100%;">'+
    '<div>颁行</div>'+
    '<span class="cost">' + r.durationMonths + ' 月后见效</span>'+
    '</button></div>';

  if (typeof openGenericModal === 'function') openGenericModal(r.name, html, null);
}

function _guoku_doEnactReform(reformId) {
  var result = GuokuEngine.enactReform(reformId);
  if (result.success) {
    if (typeof toast === 'function') toast('已颁行：' + result.reform.name);
    if (typeof closeGenericModal === 'function') closeGenericModal();
    renderGuokuPanel();
  } else {
    if (typeof toast === 'function') toast('未成：' + result.reason);
  }
}

// ─── 铸币三策 ───
function _guoku_lightCoin() {
  var html = '<div style="padding:1rem;">'+
    '<h4 style="color:var(--gold);margin-bottom:0.6rem;">减重改铸</h4>'+
    '<p style="font-size:0.82rem;line-height:1.6;color:var(--txt);margin-bottom:0.8rem;">'+
      '新铸钱减少含铜，一次性获大量铸币利，但市面疑虑通胀激升。选档次：'+
    '</p>'+
    '<div style="display:grid;grid-template-columns:1fr;gap:6px;">'+
      '<button class="vd-action-btn" onclick="_guoku_doLightCoin(0.1)">'+
        '<div>减重 10%（小调）</div><span class="cost">获 2-4 月入 · 通胀 +0.05 · 皇威 -1</span></button>'+
      '<button class="vd-action-btn dangerous" onclick="_guoku_doLightCoin(0.2)">'+
        '<div>减重 20%（常策）</div><span class="cost">获 5-8 月入 · 通胀 +0.1 · 皇威 -3 · 民心 -2</span></button>'+
      '<button class="vd-action-btn dangerous" onclick="_guoku_doLightCoin(0.4)">'+
        '<div>减重 40%（险策）</div><span class="cost">获 10-15 月入 · 通胀 +0.2 · 皇威 -6 · 民心 -4</span></button>'+
    '</div></div>';
  if (typeof openGenericModal === 'function') openGenericModal('减重改铸', html, null);
}
function _guoku_doLightCoin(r) {
  var res = GuokuEngine.MintingActions.lightCoining(r);
  if (typeof toast === 'function') toast('已减重改铸：' + Math.round(r*100) + '%');
  if (typeof closeGenericModal === 'function') closeGenericModal();
  renderGuokuPanel();
  if (typeof renderTopBarVars === 'function') renderTopBarVars();
}
function _guoku_banPrivate() {
  _guoku_confirm('严禁私铸',
    '颁诏严法诛私铸。钱法肃然，但监察负担重。',
    '代价：税司腐败 +3（寻租空间）',
    '立法', function() { return GuokuEngine.MintingActions.banPrivateMint(); });
}
function _guoku_newCoin() {
  var html = '<div style="padding:1rem;">'+
    '<h4 style="color:var(--gold);margin-bottom:0.6rem;">新铸通宝</h4>'+
    '<p style="font-size:0.82rem;line-height:1.6;color:var(--txt);margin-bottom:0.8rem;">'+
      '新铸钱号。成色精良 → 通胀消退、民信渐复、皇威 +5'+
    '</p>'+
    '<div class="form-group" style="margin-bottom:0.8rem;">'+
      '<label style="font-size:0.78rem;display:block;margin-bottom:2px;">钱号</label>'+
      '<input id="newCoinName" type="text" value="通宝" style="width:100%;padding:5px 8px;" placeholder="如开元通宝、乾隆通宝">'+
    '</div>'+
    '<div style="font-size:0.72rem;color:var(--txt-d);padding:0.4rem 0.6rem;background:var(--bg-2);border-radius:3px;">'+
      '代价：帑廪 -10 万两'+
    '</div></div>';
  if (typeof openGenericModal === 'function') {
    openGenericModal('新铸通宝', html, function() {
      var n = (document.getElementById('newCoinName')||{}).value || '通宝';
      var r = GuokuEngine.MintingActions.newCoining(n);
      if (typeof toast === 'function') toast('已新铸：' + n);
      if (typeof closeGenericModal === 'function') closeGenericModal();
      renderGuokuPanel();
    });
  }
}

// ─── AI 自拟诏令 ───
function _guoku_aiDecreeOpen() {
  var aiAvail = (typeof callAI === 'function') && (typeof P !== 'undefined') && P.ai && P.ai.key;
  if (!aiAvail) {
    if (typeof toast === 'function') toast('未配 AI API，不可用自拟诏令');
    return;
  }
  var html = '<div style="padding:1rem;">'+
    '<h4 style="color:var(--gold);margin-bottom:0.6rem;">陛下自拟诏令</h4>'+
    '<p style="font-size:0.82rem;line-height:1.6;color:var(--txt);margin-bottom:0.6rem;">'+
      '陛下以自然语言颁诏，辅政大臣据此议定金额与规模。例：<br>'+
      '· "加三成赋税以备边" → AI 判 extraTax 0.3<br>'+
      '· "发帑二十万赈两淮水患" → AI 判 openGranary regional + 20 万<br>'+
      '· "借银三十万于两淮盐商" → AI 判 loan 30 万，12 月<br>'+
    '</p>'+
    '<div class="form-group" style="margin-bottom:0.6rem;">'+
      '<label style="font-size:0.78rem;display:block;margin-bottom:2px;">诏令文</label>'+
      '<textarea id="aiDecreeText" rows="4" style="width:100%;padding:8px;font-family:inherit;font-size:0.88rem;" placeholder="朕以两淮水患，发帑赈济……"></textarea>'+
    '</div>'+
    '<div class="form-group" style="margin-bottom:0.8rem;">'+
      '<label style="font-size:0.78rem;display:block;margin-bottom:2px;">类别</label>'+
      '<select id="aiDecreeType" style="width:100%;padding:5px 8px;">'+
        '<option value="extraTax">加派</option>'+
        '<option value="openGranary">开仓赈济</option>'+
        '<option value="takeLoan">借贷</option>'+
        '<option value="reduceTax">减赋</option>'+
        '<option value="cutOfficials">裁冗员</option>'+
        '<option value="issuePaperCurrency">发行纸钞</option>'+
      '</select>'+
    '</div>'+
    '<div id="aiDecreeResult" style="font-size:0.78rem;color:var(--txt-d);min-height:30px;"></div>'+
    '<div style="display:flex;gap:6px;margin-top:6px;">'+
      '<button class="vd-action-btn" onclick="_guoku_aiDecreeParse()" style="flex:1;">⊕ 请参议</button>'+
    '</div></div>';
  if (typeof openGenericModal === 'function') openGenericModal('陛下自拟诏令', html, null);
}

async function _guoku_aiDecreeParse() {
  var text = (document.getElementById('aiDecreeText')||{}).value || '';
  var type = (document.getElementById('aiDecreeType')||{}).value || 'extraTax';
  var resEl = document.getElementById('aiDecreeResult');
  if (!text.trim()) { if (resEl) resEl.innerHTML = '<span style="color:var(--vermillion-400);">请先写诏令</span>'; return; }
  if (resEl) resEl.innerHTML = '<span style="color:var(--txt-s);">辅政大臣解读中……</span>';

  try {
    var parsed = await GuokuEngine.aiParseFiscalDecree(text, type);
    if (!parsed) {
      if (resEl) resEl.innerHTML = '<span style="color:var(--vermillion-400);">辅政大臣未能解读，请明示。</span>';
      return;
    }
    var amt = parsed.amount;
    var reason = parsed.reason || '';
    if (resEl) resEl.innerHTML =
      '<div style="padding:0.5rem 0.7rem;background:var(--bg-2);border-left:3px solid var(--gold-d);border-radius:3px;color:var(--txt);">' +
      '<b>臣议</b>：' + reason + '<br><b>拟行</b>：' + type + ' · 金额/规模 ' + amt +
      '<br><button class="vd-action-btn" style="margin-top:6px;" onclick="_guoku_aiDecreeExec(\'' + type + '\', ' + amt + ')">⚔ 依议施行</button>' +
      '</div>';
  } catch(e) {
    if (resEl) resEl.innerHTML = '<span style="color:var(--vermillion-400);">解读失败：' + e.message + '</span>';
  }
}

function _guoku_aiDecreeExec(type, amt) {
  var result;
  if (type === 'extraTax')            result = GuokuEngine.Actions.extraTax(amt);
  else if (type === 'openGranary')    result = GuokuEngine.Actions.openGranary(
      amt > 0.5 ? 'national' : amt > 0.2 ? 'regional' : 'county');
  else if (type === 'takeLoan')       result = GuokuEngine.Actions.takeLoan(amt, 12);
  else if (type === 'reduceTax')      result = GuokuEngine.Actions.reduceTax(amt);
  else if (type === 'cutOfficials')   result = GuokuEngine.Actions.cutOfficials(amt);
  else if (type === 'issuePaperCurrency') result = GuokuEngine.Actions.issuePaperCurrency(amt);

  if (result && result.success) {
    if (typeof toast === 'function') toast('已依议施行');
    if (typeof closeGenericModal === 'function') closeGenericModal();
    renderGuokuPanel();
    if (typeof renderTopBarVars === 'function') renderTopBarVars();
  } else {
    if (typeof toast === 'function') toast('未成：' + ((result && result.reason) || '未知'));
  }
}

// ESC 关闭
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeGuokuPanel();
});
