// ═══════════════════════════════════════════════════════════════
// 内帑（皇室私库）详情面板
// 设计：设计方案-财政系统.md 决策 F
// 数据：GM.neitang
// ═══════════════════════════════════════════════════════════════

function _neitangFmt(v) {
  v = Math.round(v || 0);
  if (Math.abs(v) >= 1e8) return (v/1e8).toFixed(2) + '亿';
  if (Math.abs(v) >= 10000) return Math.round(v/10000) + '万';
  return v.toString();
}

function _neitangTabJump(label, tabId) {
  var safeLabel = String(label).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
  return '<div style="padding:6px 10px;margin:3px 0;background:var(--bg-2);border-left:3px solid var(--gold-d);border-radius:3px;font-size:0.74rem;cursor:pointer;" ' +
    'onclick="if(typeof switchGTab===\'function\')switchGTab(null,\'' + tabId + '\');' +
    'document.querySelectorAll(\'.var-drawer-overlay\').forEach(function(o){o.classList.remove(\'open\');});">' +
    '→ <b>' + safeLabel + '</b>（切至标签页处理）' +
  '</div>';
}

function openNeitangPanel() {
  var ov = document.getElementById('neitang-drawer-ov');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'neitang-drawer-ov';
    ov.className = 'var-drawer-overlay';
    ov.innerHTML = '<div class="var-drawer" id="neitang-drawer">'+
      '<div class="var-drawer-header">'+
        '<div>'+
          '<div class="var-drawer-title">内帑之察 · 皇家私库</div>'+
          '<div class="var-drawer-subtitle" id="neitang-subtitle"></div>'+
        '</div>'+
        '<button class="var-drawer-close" onclick="closeNeitangPanel()">×</button>'+
      '</div>'+
      '<div class="var-drawer-body" id="neitang-body"></div>'+
    '</div>';
    ov.addEventListener('click', function(e) { if (e.target === ov) closeNeitangPanel(); });
    document.body.appendChild(ov);
  }
  renderNeitangPanel();
  ov.classList.add('open');
}

function closeNeitangPanel() {
  var ov = document.getElementById('neitang-drawer-ov');
  if (ov) ov.classList.remove('open');
}

function renderNeitangPanel() {
  var body = document.getElementById('neitang-body');
  var subt = document.getElementById('neitang-subtitle');
  if (!body) return;

  var n = GM.neitang || {};
  var lbl = '月入 ' + _neitangFmt(n.monthlyIncome || 0) + ' / 月支 ' + _neitangFmt(n.monthlyExpense || 0);
  if (n.crisis && n.crisis.active) lbl = '⚠ 空竭 · ' + lbl;
  if (subt) subt.textContent = lbl;

  var html = '';

  // 历史预设备注
  if (n._presetName) {
    html += '<section class="vd-section">';
    html += '<div style="padding:0.5rem 0.7rem;background:var(--bg-2);border-left:3px solid var(--gold-d);border-radius:3px;font-size:0.76rem;">'+
      '<div style="color:var(--gold);font-weight:600;margin-bottom:3px;">' + n._presetName + '</div>'+
      '<div style="color:var(--txt-d);font-style:italic;">' + (n._presetHistorical || '') + '</div>'+
      '</div></section>';
  }

  // 总览
  html += '<section class="vd-section">';
  html += '<div class="vd-overview">';
  var balColor = n.balance < 0 ? 'var(--vermillion-400)' :
                 n.balance < (n.monthlyExpense || 1) * 3 ? 'var(--amber-400)' : 'var(--gold)';
  html += '<div class="vd-ov-row"><span class="vd-ov-label">内帑现余</span>' +
          '<span class="vd-ov-value" style="color:' + balColor + ';">' +
          _neitangFmt(n.balance) + ' ' + ((n.unit||{}).money || '两') + '</span></div>';
  html += '<div class="vd-ov-row"><span class="vd-ov-label">月入 / 月支</span>' +
          '<span class="vd-ov-value">' + _neitangFmt(n.monthlyIncome || 0) + ' / ' +
          _neitangFmt(n.monthlyExpense || 0) + '</span></div>';
  var dColor = (n.lastDelta || 0) >= 0 ? '#6aa88a' : 'var(--vermillion-400)';
  html += '<div class="vd-ov-row"><span class="vd-ov-label">本回合增减</span>' +
          '<span class="vd-ov-value" style="color:' + dColor + ';">' +
          ((n.lastDelta || 0) > 0 ? '+' : '') + _neitangFmt(n.lastDelta || 0) + '</span></div>';
  // 腐败侵吞（imperial）
  if (GM.corruption && GM.corruption.subDepts && GM.corruption.subDepts.imperial) {
    var ic = GM.corruption.subDepts.imperial.true;
    if (ic > 30) {
      var leakPct = Math.round(ic / 100 * 0.5 * 100);
      html += '<div class="vd-ov-row"><span class="vd-ov-label" style="color:var(--vermillion-400);">⚠ 内廷侵吞</span>' +
              '<span class="vd-ov-value" style="color:var(--vermillion-400);font-size:0.78rem;">' +
              '每月约被侵 ' + leakPct + '%（内廷腐败 ' + Math.round(ic) + '）</span></div>';
    }
  }
  html += '</div></section>';

  // 六类收入
  html += '<section class="vd-section">';
  html += '<div class="vd-section-title">岁入分项 <span class="vd-badge">年度</span></div>';
  var srcLabels = {
    huangzhuang:'皇庄', huangchan:'皇产', specialTax:'特别税',
    confiscation:'抄没', tribute:'朝贡', guokuTransfer:'帑廪转运'
  };
  var sources = n.sources || {};
  var srcTotal = 0;
  for (var k in sources) srcTotal += (sources[k] || 0);
  if (srcTotal > 0) {
    Object.keys(srcLabels).forEach(function(key) {
      var val = sources[key] || 0;
      if (val === 0) return;
      var pct = (val / srcTotal * 100).toFixed(1);
      var barW = Math.min(100, val / srcTotal * 100);
      html += '<div style="display:grid;grid-template-columns:70px 1fr auto;gap:8px;align-items:center;padding:3px 0;font-size:0.78rem;">'+
        '<span style="color:var(--txt-d);">' + srcLabels[key] + '</span>'+
        '<div style="height:6px;background:var(--bg-3);border-radius:3px;overflow:hidden;">'+
          '<div style="height:100%;width:' + barW + '%;background:var(--gold-400);"></div>'+
        '</div>'+
        '<span style="color:var(--txt);font-size:0.72rem;">' + _neitangFmt(val) +
          ' <span style="color:var(--txt-d);">' + pct + '%</span></span>'+
        '</div>';
    });
  } else {
    html += '<div class="vd-empty">岁入尚未结算</div>';
  }
  html += '</section>';

  // 五类支出
  html += '<section class="vd-section">';
  html += '<div class="vd-section-title">岁出分项 <span class="vd-badge">年度</span></div>';
  var expLabels = {
    gongting:'宫廷用度', dadian:'大典', shangci:'赏赐',
    houGongLingQin:'后宫陵寝', guokuRescue:'接济帑廪'
  };
  var expenses = n.expenses || {};
  var expTotal = 0;
  for (var e in expenses) expTotal += (expenses[e] || 0);
  if (expTotal > 0) {
    Object.keys(expLabels).forEach(function(key) {
      var val = expenses[key] || 0;
      if (val === 0 && key !== 'gongting') return;
      var pct = expTotal > 0 ? (val / expTotal * 100).toFixed(1) : 0;
      var barW = expTotal > 0 ? Math.min(100, val / expTotal * 100) : 0;
      html += '<div style="display:grid;grid-template-columns:90px 1fr auto;gap:8px;align-items:center;padding:3px 0;font-size:0.78rem;">'+
        '<span style="color:var(--txt-d);">' + expLabels[key] + '</span>'+
        '<div style="height:6px;background:var(--bg-3);border-radius:3px;overflow:hidden;">'+
          '<div style="height:100%;width:' + barW + '%;background:var(--vermillion-400);"></div>'+
        '</div>'+
        '<span style="color:var(--txt);font-size:0.72rem;">' + _neitangFmt(val) +
          ' <span style="color:var(--txt-d);">' + pct + '%</span></span>'+
        '</div>';
    });
  } else {
    html += '<div class="vd-empty">岁出尚未结算</div>';
  }
  html += '</section>';

  // 三账库存
  html += '<section class="vd-section">';
  html += '<div class="vd-section-title">三账库存 <span class="vd-badge">钱·粮·布</span></div>';
  html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;">';
  var ledgers = n.ledgers || {};
  var ledgerMeta = [
    ['money','钱', (n.unit||{}).money || '两', 'var(--gold-400)'],
    ['grain','粮', (n.unit||{}).grain || '石', '#6aa88a'],
    ['cloth','布', (n.unit||{}).cloth || '匹', '#a88a6a']
  ];
  ledgerMeta.forEach(function(m) {
    var led = ledgers[m[0]] || { stock:0 };
    var netLedger = (led.lastTurnIn || 0) - (led.lastTurnOut || 0);
    var netC = netLedger >= 0 ? '#6aa88a' : 'var(--vermillion-400)';
    html += '<div style="padding:0.6rem;background:var(--bg-2);border-left:3px solid ' + m[3] + ';border-radius:4px;">'+
      '<div style="font-size:0.72rem;color:var(--txt-d);margin-bottom:2px;">' + m[1] + '</div>'+
      '<div style="font-size:0.95rem;color:' + m[3] + ';font-weight:600;">' + _neitangFmt(led.stock || 0) + '</div>'+
      '<div style="font-size:0.64rem;color:var(--txt-d);">' + m[2] + '</div>'+
      (m[0] !== 'money' && (led.lastTurnIn || led.lastTurnOut) ?
        '<div style="font-size:0.62rem;margin-top:3px;padding-top:3px;border-top:1px dashed var(--color-border-subtle);">'+
        '<span style="color:var(--txt-d);">入 ' + _neitangFmt(led.lastTurnIn || 0) + '</span> '+
        '<span style="color:' + netC + ';">Δ' + (netLedger >= 0 ? '+' : '') + _neitangFmt(netLedger) + '</span>'+
        '</div>' : '') +
      '</div>';
  });
  html += '</div>';
  html += '</section>';

  // 危机提示
  if (n.crisis && n.crisis.active) {
    html += '<section class="vd-section">';
    html += '<div class="vd-section-title" style="color:var(--vermillion-400);">⚠ 内帑空竭 <span class="vd-badge">' + Math.round(n.crisis.consecutiveMonths || 0) + ' 月</span></div>';
    html += '<div style="padding:0.8rem;background:rgba(192,64,48,0.1);border-left:3px solid var(--vermillion-400);border-radius:4px;font-size:0.82rem;color:var(--txt);line-height:1.7;">';
    html += '皇家体面难维，宫人盗窃成风。内廷腐败激增。';
    html += '<br>已连锁：皇威 -5 · 皇权内廷分项 -8 · 内廷腐败持续 +0.5/月';
    html += '</div></section>';
  }

  // ─── § 当前特别税状态（只读） ───
  if (n.specialTaxActive) {
    html += '<section class="vd-section">';
    html += '<div class="vd-section-title">当前特别税</div>';
    html += '<div style="padding:0.6rem;background:var(--bg-2);border-left:3px solid var(--amber-400);border-radius:3px;font-size:0.8rem;">'+
      '已开' + (n.specialTaxType || '特别税') + '，月收 ' + _neitangFmt(n.specialTaxMonthly || 0) + ' 两'+
      '<div style="font-size:0.7rem;color:var(--txt-d);margin-top:3px;">代价：民心 -5 · 皇威 -3</div>'+
      '</div>';
    html += '</section>';
  }

  // ─── § 非常规收入（进奉/议罪银等） ───
  var rules = n.neicangRules || {};
  var incidentals = rules.incidentalSources || [];
  if (incidentals.length > 0 && typeof NeitangEngine !== 'undefined' && NeitangEngine.INCIDENTAL_TEMPLATES) {
    html += '<section class="vd-section">';
    html += '<div class="vd-section-title">非常规收入 <span class="vd-badge">进奉/议罪银/贡物</span></div>';
    incidentals.forEach(function(src) {
      var tpl = NeitangEngine.INCIDENTAL_TEMPLATES[src.id];
      if (!tpl) return;
      html += '<div style="padding:5px 8px;background:var(--bg-2);border-left:3px solid var(--amber-400);border-radius:3px;margin-bottom:3px;font-size:0.76rem;">'+
        '<div style="color:var(--gold);font-weight:500;">' + tpl.name + '</div>'+
        '<div style="color:var(--txt-d);font-size:0.68rem;margin-top:2px;">' + tpl.historical + '</div>'+
        '</div>';
    });
    html += '</section>';
  }

  // ─── § 调拨阻力（若配置） ───
  if (rules.transferResistance) {
    var tr = rules.transferResistance;
    var gn = tr.guokuToNeicang || 0;
    var ng = tr.neicangToGuoku || 0;
    if (gn > 0 || ng > 0) {
      html += '<section class="vd-section">';
      html += '<div class="vd-section-title">调拨阻力</div>';
      html += '<div style="padding:4px 8px;font-size:0.74rem;color:var(--txt-s);">';
      html += '帑廪→内帑：' + (gn * 100).toFixed(0) + '% ' + (gn > 0.7 ? '（廷议激烈）' : gn > 0.4 ? '（受质疑）' : '（顺畅）') + '<br>';
      html += '内帑→帑廪：' + (ng * 100).toFixed(0) + '% ' + (ng > 0.7 ? '（近臣阻挠）' : '（多顺遂）');
      html += '</div></section>';
    }
  }

  // ─── § 宗室俸禄（明代） ───
  if (n._royalClan) {
    var rc = n._royalClan;
    html += '<section class="vd-section">';
    html += '<div class="vd-section-title" style="color:var(--vermillion-400);">⚠ 宗室俸禄压力</div>';
    html += '<div style="padding:5px 8px;background:rgba(192,64,48,0.05);border-left:3px solid var(--vermillion-400);border-radius:3px;font-size:0.76rem;">';
    html += '宗室人口：' + rc.population.toLocaleString() + '<br>';
    html += '月俸禄成本：' + _neitangFmt(rc.lastStipendCost || 0) + ' 两<br>';
    html += '<span style="color:var(--txt-d);font-size:0.68rem;">历史：明末宗室压垮国库的悲剧</span>';
    html += '</div></section>';
  }

  // ─── § 如何措置（跳转中间标签页） ───
  html += '<section class="vd-section">';
  html += '<div class="vd-section-title">如何措置</div>';
  html += _neitangTabJump('写诏（帑廪↔内帑 互转 / 开罢特别税 / 大典 皆由诏令发起）', 'gt-edict');
  html += _neitangTabJump('看奏疏（内廷近臣/户部 的奏报与建言）', 'gt-memorial');
  html += _neitangTabJump('问对内廷近臣 商量敏感财政事', 'gt-wendui');
  html += '<div style="font-size:0.7rem;color:var(--txt-d);margin-top:6px;">※ 开矿税/织造贡/市舶抽分/大典 等非常规举措，请在【诏令】写诏。</div>';
  html += '</section>';

  // 历史趋势
  html += _neitang_renderTrendSection();

  // 年度决算
  var yearly = (n.history && n.history.yearly) || [];
  if (yearly.length > 0) {
    html += '<section class="vd-section">';
    html += '<div class="vd-section-title">年度决算 <span class="vd-badge">' + yearly.length + ' 年</span></div>';
    yearly.slice(-5).reverse().forEach(function(y) {
      var netColor = y.netChange >= 0 ? '#6aa88a' : 'var(--vermillion-400)';
      html += '<div style="display:flex;justify-content:space-between;padding:5px 8px;font-size:0.78rem;background:var(--bg-2);border-radius:3px;margin-bottom:3px;">'+
        '<span>' + y.year + '年</span>'+
        '<span style="color:var(--txt-d);">入 ' + _neitangFmt(y.totalIncome) + ' · 出 ' + _neitangFmt(y.totalExpense) + '</span>'+
        '<span style="color:' + netColor + ';">' + (y.netChange >= 0 ? '+' : '') + _neitangFmt(y.netChange) + '</span>'+
        '</div>';
    });
    html += '</section>';
  }

  body.innerHTML = html;
}

function _neitang_renderTrendSection() {
  var snaps = ((GM.neitang && GM.neitang.history && GM.neitang.history.monthly) || []);
  if (snaps.length < 2) {
    return '<section class="vd-section">'+
      '<div class="vd-section-title">历史趋势 <span class="vd-badge">待累积</span></div>'+
      '<div class="vd-empty">需至少 2 回合数据方可展示</div>'+
    '</section>';
  }
  var data = snaps.slice(-60);
  var W = 400, H = 100, PAD = { l:40, r:8, t:8, b:20 };
  var innerW = W - PAD.l - PAD.r, innerH = H - PAD.t - PAD.b;
  var maxB = 0, minB = 0;
  data.forEach(function(d) {
    if (d.balance > maxB) maxB = d.balance;
    if (d.balance < minB) minB = d.balance;
  });
  if (maxB === minB) maxB = minB + 1;
  var maxT = data[data.length-1].turn, minT = data[0].turn;
  var spanT = Math.max(1, maxT - minT);
  function xOf(t) { return PAD.l + (t - minT) / spanT * innerW; }
  function yOf(v) { return PAD.t + (1 - (v - minB) / (maxB - minB)) * innerH; }

  var pts = data.map(function(d) { return [xOf(d.turn), yOf(d.balance)]; });
  var pathD = pts.map(function(p, i) { return (i === 0 ? 'M' : 'L') + p[0] + ',' + p[1]; }).join(' ');

  var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto;">';
  svg += '<text x="2" y="' + (PAD.t + 8) + '" font-size="9" fill="var(--txt-d)">' + _neitangFmt(maxB) + '</text>';
  svg += '<text x="2" y="' + (H - PAD.b + 4) + '" font-size="9" fill="var(--txt-d)">' + _neitangFmt(minB) + '</text>';
  svg += '<path d="' + pathD + '" fill="none" stroke="var(--gold-300)" stroke-width="2"/>';
  svg += '<text x="' + PAD.l + '" y="' + (H - 4) + '" font-size="9" fill="var(--txt-d)">T' + minT + '</text>';
  svg += '<text x="' + (W - PAD.r) + '" y="' + (H - 4) + '" text-anchor="end" font-size="9" fill="var(--txt-d)">T' + maxT + '</text>';
  svg += '</svg>';
  return '<section class="vd-section">'+
    '<div class="vd-section-title">内帑趋势 <span class="vd-badge">' + data.length + ' 月</span></div>'+
    '<div style="background:var(--bg-2);border-radius:4px;padding:4px 8px;">' + svg + '</div></section>';
}

// ─── 动作 handlers ───
function _neitang_transferFromGuoku() {
  var html = '<div style="padding:1rem;">'+
    '<h4 style="color:var(--gold);margin-bottom:0.6rem;">帑廪调内帑</h4>'+
    '<p style="font-size:0.82rem;line-height:1.6;color:var(--txt);margin-bottom:0.6rem;">'+
      '从国库拨银入内帑。常规操作。'+
    '</p>'+
    '<div class="form-group" style="margin-bottom:0.6rem;">'+
      '<label style="font-size:0.78rem;display:block;margin-bottom:2px;">调拨金额（两）</label>'+
      '<input id="ntTransferAmt" type="number" value="100000" min="1" style="width:100%;padding:5px 8px;">'+
    '</div></div>';
  if (typeof openGenericModal === 'function') {
    openGenericModal('帑廪调内帑', html, function() {
      var amt = Number((document.getElementById('ntTransferAmt')||{}).value) || 100000;
      var r = NeitangEngine.Actions.transferFromGuoku(amt);
      if (typeof toast === 'function') toast(r.success ? '已调拨' : ('未成：' + r.reason));
      if (typeof closeGenericModal === 'function') closeGenericModal();
      renderNeitangPanel();
      if (typeof renderGuokuPanel === 'function' && document.getElementById('guoku-drawer-ov')) renderGuokuPanel();
      if (typeof renderTopBarVars === 'function') renderTopBarVars();
    });
  }
}

function _neitang_rescueGuoku() {
  var html = '<div style="padding:1rem;">'+
    '<h4 style="color:var(--gold);margin-bottom:0.6rem;">罄内帑济国</h4>'+
    '<p style="font-size:0.82rem;line-height:1.6;color:var(--txt);margin-bottom:0.6rem;">'+
      '陛下以私帑济国用。群臣感泣，民心皇威皆升。'+
    '</p>'+
    '<div class="form-group" style="margin-bottom:0.6rem;">'+
      '<label style="font-size:0.78rem;display:block;margin-bottom:2px;">捐输金额（两）</label>'+
      '<input id="ntRescueAmt" type="number" value="100000" min="1" style="width:100%;padding:5px 8px;">'+
    '</div>'+
    '<div style="font-size:0.72rem;color:var(--txt-d);padding:0.4rem 0.6rem;background:var(--bg-2);border-radius:3px;">'+
      '代价：内帑 - 金额 · 收益：皇威 +3 · 民心 +2'+
    '</div></div>';
  if (typeof openGenericModal === 'function') {
    openGenericModal('罄内帑济国', html, function() {
      var amt = Number((document.getElementById('ntRescueAmt')||{}).value) || 100000;
      var r = NeitangEngine.Actions.rescueGuoku(amt);
      if (typeof toast === 'function') toast(r.success ? '已济国' : ('未成：' + r.reason));
      if (typeof closeGenericModal === 'function') closeGenericModal();
      renderNeitangPanel();
      if (typeof renderGuokuPanel === 'function' && document.getElementById('guoku-drawer-ov')) renderGuokuPanel();
      if (typeof renderTopBarVars === 'function') renderTopBarVars();
    });
  }
}

function _neitang_enableSpecial(type, monthly) {
  var r = NeitangEngine.Actions.enableSpecialTax(type, monthly);
  if (typeof toast === 'function') toast(r.success ? ('已开' + type) : ('未成：' + r.reason));
  renderNeitangPanel();
  if (typeof renderTopBarVars === 'function') renderTopBarVars();
}

function _neitang_disableSpecial() {
  var r = NeitangEngine.Actions.disableSpecialTax();
  if (typeof toast === 'function') toast(r.success ? '已罢' : ('未成：' + r.reason));
  renderNeitangPanel();
  if (typeof renderTopBarVars === 'function') renderTopBarVars();
}

function _neitang_ceremony(type) {
  var typeLabels = { major:'封禅/万寿', middle:'千叟宴/大飨', minor:'郊祀/常礼' };
  var r = NeitangEngine.Actions.holdCeremony(type);
  if (typeof toast === 'function') toast(r.success ? ('已举' + typeLabels[type]) : ('未成：' + r.reason));
  renderNeitangPanel();
  if (typeof renderTopBarVars === 'function') renderTopBarVars();
}

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeNeitangPanel();
});
