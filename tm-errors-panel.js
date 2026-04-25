/* ============================================================
 * tm-errors-panel.js — 错误日志 UI 面板
 *
 * 依赖：TM.errors (tm-error-collector.js) + TM.getValidationHistory
 *
 * 触发：Ctrl+Shift+E 打开/关闭
 *       也可 TM.errors.openPanel() 手动调用
 *
 * 展示：
 *   - 按 module 汇总（计数 + 最近一次时间）
 *   - 最近 50 条明细（点击展开 stack）
 *   - AI 校验历史（TM._validationHistory）
 *   - 清空 / 关闭 / 下载 JSON
 * ============================================================ */
(function(){
  'use strict';
  if (typeof window === 'undefined') return;
  window.TM = window.TM || {};

  var panelId = 'tm-errors-panel';
  var isOpen = false;

  // R143·委托给 tm-utils.js:569 的 escHtml
  function _esc(s) { return (typeof escHtml === 'function') ? escHtml(s) : String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  function _fmtTime(ts) {
    if (!ts) return '—';
    var d = new Date(ts);
    return d.toLocaleTimeString('zh-CN', { hour12: false });
  }

  function renderPanel() {
    var el = document.getElementById(panelId);
    if (!el) return;

    var errs = (TM.errors && TM.errors.getLog) ? TM.errors.getLog() : [];
    var summary = (TM.errors && TM.errors.getSummary) ? TM.errors.getSummary() : {};
    var validations = (TM.getValidationHistory) ? TM.getValidationHistory() : [];

    var modRows = Object.keys(summary).map(function(mod){
      var s = summary[mod];
      var topMsgs = Object.keys(s.messages).sort(function(a,b){ return s.messages[b]-s.messages[a]; }).slice(0,3);
      var msgHtml = topMsgs.map(function(m){ return '<div style="font-size:11px;color:#888;margin-left:8px">· ' + _esc(m) + ' ×' + s.messages[m] + '</div>'; }).join('');
      return '<div style="border-bottom:1px solid #2a2a2a;padding:6px 0"><b style="color:#e8c66e">' + _esc(mod) + '</b> <span style="color:#999">×' + s.count + '</span>' + msgHtml + '</div>';
    }).join('') || '<div style="color:#666;padding:10px">尚无捕获</div>';

    var errRows = errs.slice().reverse().slice(0, 50).map(function(e, i){
      var msg = (e.error && e.error.message) || '—';
      var hasStack = !!(e.error && e.error.stack);
      var id = 'tmerr-stack-' + i;
      return '<div style="border-bottom:1px solid #2a2a2a;padding:6px 0;font-size:12px">'
        + '<div><span style="color:#888">' + _fmtTime(e.t) + '</span>'
        + ' <span style="color:#e8c66e">[' + _esc(e.module) + ']</span>'
        + ' <span style="color:#999">T' + (e.turn || 0) + '</span></div>'
        + '<div style="color:#ddd;margin:3px 0">' + _esc(msg) + '</div>'
        + (hasStack ? '<details><summary style="cursor:pointer;color:#6a9;font-size:11px">stack</summary><pre style="background:#0a0a0a;padding:6px;font-size:10px;overflow:auto;max-height:200px;color:#c99">' + _esc(e.error.stack) + '</pre></details>' : '')
        + '</div>';
    }).join('') || '<div style="color:#666;padding:10px">尚无捕获</div>';

    var valRows = validations.slice().reverse().slice(0, 20).map(function(v){
      var status = v.errors.length > 0 ? '✗' : (v.warnings.length > 0 ? '⚠' : '✓');
      var color = v.errors.length > 0 ? '#c66' : (v.warnings.length > 0 ? '#d99' : '#6a9');
      return '<div style="font-size:11px;color:#bbb;border-bottom:1px solid #2a2a2a;padding:4px 0">'
        + '<span style="color:' + color + ';font-weight:bold;margin-right:6px">' + status + '</span>'
        + _fmtTime(v.timestamp) + ' '
        + '<b>' + _esc(v.tag) + '</b>'
        + (v.mode ? ' [' + _esc(v.mode) + ']' : '')
        + ' · <span style="color:#888">' + v.stats.knownKeys + '知·' + v.stats.unknownKeys + '未知·' + v.errors.length + '错·' + v.warnings.length + '警</span>'
        + '</div>';
    }).join('') || '<div style="color:#666;padding:10px">尚无校验记录</div>';

    el.innerHTML =
      '<div style="display:flex;align-items:center;padding:10px 14px;border-bottom:1px solid #3a2a10;background:#1a1410">'
      + '<b style="color:#e8c66e;font-size:14px">诊断·错误与校验</b>'
      + '<span style="color:#888;font-size:11px;margin-left:10px">Ctrl+Shift+E 关闭</span>'
      + '<div style="margin-left:auto;display:flex;gap:8px">'
      +   '<button onclick="TM.errors.clear();TM._renderErrorsPanel();" style="background:#2a1a1a;color:#d99;border:1px solid #5a3a3a;padding:4px 10px;cursor:pointer;font-size:11px">清空</button>'
      +   '<button onclick="TM._downloadErrorsJSON()" style="background:#1a1a2a;color:#9cd;border:1px solid #3a3a5a;padding:4px 10px;cursor:pointer;font-size:11px">下载 JSON</button>'
      +   '<button onclick="TM._closeErrorsPanel()" style="background:#2a2a2a;color:#ccc;border:1px solid #4a4a4a;padding:4px 10px;cursor:pointer;font-size:11px">关闭</button>'
      + '</div></div>'
      + '<div style="display:grid;grid-template-columns:1fr 1.5fr;gap:0;height:calc(100% - 50px)">'
      +   '<div style="border-right:1px solid #3a2a10;padding:10px;overflow:auto">'
      +     '<div style="color:#9ac870;font-size:12px;font-weight:bold;margin-bottom:6px">按模块汇总</div>'
      +     modRows
      +     '<div style="color:#9ac870;font-size:12px;font-weight:bold;margin:14px 0 6px">AI 校验历史（近 20）</div>'
      +     valRows
      +   '</div>'
      +   '<div style="padding:10px;overflow:auto">'
      +     '<div style="color:#9ac870;font-size:12px;font-weight:bold;margin-bottom:6px">最近 50 条详情</div>'
      +     errRows
      +   '</div>'
      + '</div>';
  }

  function openPanel() {
    if (isOpen) return;
    isOpen = true;
    var el = document.createElement('div');
    el.id = panelId;
    el.style.cssText = 'position:fixed;right:20px;bottom:20px;width:860px;max-width:92vw;height:560px;max-height:80vh;'
      + 'background:#0f0c08;border:1px solid #5a3a1a;border-radius:6px;box-shadow:0 8px 28px rgba(0,0,0,0.7);'
      + 'z-index:99990;color:#ddd;font-family:sans-serif;overflow:hidden';
    document.body.appendChild(el);
    renderPanel();
  }

  function closePanel() {
    var el = document.getElementById(panelId);
    if (el) el.remove();
    isOpen = false;
  }

  function togglePanel() { isOpen ? closePanel() : openPanel(); }

  function downloadJSON() {
    var data = {
      when: new Date().toISOString(),
      turn: (typeof GM !== 'undefined' && GM.turn) || 0,
      errors: (TM.errors && TM.errors.getLog) ? TM.errors.getLog() : [],
      summary: (TM.errors && TM.errors.getSummary) ? TM.errors.getSummary() : {},
      validations: (TM.getValidationHistory) ? TM.getValidationHistory() : []
    };
    try {
      var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'tm-errors-' + Date.now() + '.json';
      a.click();
      setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
    } catch(e) {
      console.warn('[errors-panel] 下载失败', e);
    }
  }

  // ─── 快捷键 Ctrl+Shift+E ───
  function installHotkey() {
    if (window._tmErrorsPanelHotkey) return;
    window._tmErrorsPanelHotkey = true;
    document.addEventListener('keydown', function(e){
      if (e.ctrlKey && e.shiftKey && (e.key === 'E' || e.key === 'e')) {
        e.preventDefault();
        togglePanel();
      }
    });
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', installHotkey);
    } else {
      installHotkey();
    }
  }

  // 暴露接口（同时把 openPanel 挂到 TM.errors 以便调用）
  TM._renderErrorsPanel = renderPanel;
  TM._closeErrorsPanel = closePanel;
  TM._downloadErrorsJSON = downloadJSON;
  if (TM.errors) {
    TM.errors.openPanel = openPanel;
    TM.errors.closePanel = closePanel;
    TM.errors.togglePanel = togglePanel;
  } else {
    // 如果 TM.errors 还没加载（不应该发生），稍后重试
    setTimeout(function(){
      if (TM.errors) {
        TM.errors.openPanel = openPanel;
        TM.errors.closePanel = closePanel;
        TM.errors.togglePanel = togglePanel;
      }
    }, 200);
  }
})();
