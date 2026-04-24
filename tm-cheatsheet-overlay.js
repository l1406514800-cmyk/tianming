/* ============================================================
 * tm-cheatsheet-overlay.js — 游戏内速查卡浮层（Ctrl+Shift+/）
 *
 * 目的：把 DEBUG_CHEATSHEET.md 的核心内容内置为游戏内浮层，
 *      维护者调试时不用切屏去读 markdown 文件。
 *
 * 快捷键：Ctrl+Shift+/ 或 Ctrl+Shift+H（/ 比 H 不易与游戏功能冲突）
 * 也可：TM.cheatsheet.show() / TM.cheatsheet.toggle()
 *
 * 不动游戏代码——纯浮层，可关闭，不影响游戏。
 * ============================================================ */
(function(){
  'use strict';
  if (typeof window === 'undefined') return;
  window.TM = window.TM || {};
  if (window.TM.cheatsheet) return;

  var overlayId = 'tm-cheatsheet-overlay';
  var isOpen = false;

  function _esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(m){
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m];
    });
  }

  function _codeBlock(code) {
    return '<pre style="background:#0a0806;border:1px solid #2a2010;border-radius:3px;padding:8px 10px;font-size:11px;color:#d9c77a;margin:4px 0;overflow-x:auto;line-height:1.5">' + _esc(code) + '</pre>';
  }

  function _section(title, inner) {
    return '<div style="margin-bottom:12px">'
      + '<div style="font-size:12px;font-weight:bold;color:#e8c66e;margin-bottom:4px;border-bottom:1px solid #3a2a10;padding-bottom:2px">' + title + '</div>'
      + inner
      + '</div>';
  }

  // 速查卡内容（精简版 DEBUG_CHEATSHEET.md）
  var SECTIONS = [
    {
      title: '⚡ 快捷键',
      items: [
        ['Ctrl+Shift+D', '统一诊断仪表板（★ 新增）'],
        ['Ctrl+Shift+E', '错误日志面板'],
        ['Ctrl+Shift+P', '性能采样面板'],
        ['Ctrl+Shift+/', '本速查卡'],
        ['?test=1', '启动时自动跑 smoke test']
      ]
    },
    {
      title: '🔍 数据查询 DA.*',
      code: [
        'DA.chars.player()                // 玩家角色',
        'DA.chars.findByName("张居正")    // O(1) 按名查',
        'DA.chars.allAlive()',
        'DA.chars.byFaction("大明")',
        'DA.guoku.money()  DA.guoku.grain()  DA.guoku.cloth()',
        'DA.guoku.isBankrupt()',
        'DA.officeTree.postsOf("袁崇焕")  // 某人所有兼任',
        'DA.admin.findDivision("陕西")',
        'DA.armies.totalTroops("大明")',
        'DA.authority.huangquan() / huangwei() / minxin()',
        'DA.issues.pending()  DA.turn.current()'
      ]
    },
    {
      title: '🐛 诊断 TM.*',
      code: [
        'TM.errors.openPanel()         // 打开错误面板',
        'TM.errors.getSummary()        // 按 module 汇总',
        'TM.getLastValidation()        // 最近 AI 校验',
        'TM.test.run()                 // 跑全部 smoke test',
        'TM.test.runOnly("DA.guoku")',
        'TM.invariants.check()         // 查不变量',
        'TM.guard.report()             // 全局污染统计',
        'TM.hooks.list()               // 所有 hook event',
        'TM.perf.print()               // tick 耗时表'
      ]
    },
    {
      title: '📸 状态快照 TM.state',
      code: [
        'TM.state.snapshot("before-xxx")',
        'TM.state.list()',
        'TM.diff.printBySnapshot("before-xxx", "after-xxx")',
        'TM.perf.lockBaseline()        // 锁定 p95 基准',
        'TM.perf.printCompare()        // 合并前后对比'
      ]
    },
    {
      title: '🔧 合并工作流（LAYERED 合并专用）',
      code: [
        '// 合并前（玩 5 回合后）',
        'TM.checklist.preMerge("corruption-p2")',
        '',
        '// 执行合并改代码',
        '',
        '// 合并后（再玩 5 回合后）',
        'TM.checklist.postMerge("corruption-p2")',
        '// → 自动 diff+perf compare+invariants+errors',
        '',
        'TM.checklist.lastReport()     // 查综合报告',
        'TM.checklist.downloadReport() // 下载 JSON'
      ]
    },
    {
      title: '🩺 常见问题',
      items: [
        ['AI 字段没生效', 'TM.getLastValidation() 看 warnings'],
        ['按钮不响应', 'Ctrl+Shift+E 看错误'],
        ['存档加载数据不全', '看 console [SaveMigration] 日志'],
        ['回合结算卡死', 'GM._turnAiResults.subcall1_raw 看 AI 原始返回'],
        ['某角色找不到', 'DA.chars.findByName 或 buildIndices()'],
        ['性能慢', 'TM.perf.print() 看 p95']
      ]
    },
    {
      title: '📚 文档位置',
      items: [
        ['ARCHITECTURE.md', '完整架构 10 章'],
        ['MODULE_REGISTRY.md', '92 文件索引'],
        ['PATCH_CLASSIFICATION.md', '18+ 补丁分类'],
        ['DEBUG_CHEATSHEET.md', '完整版速查（本卡精简版）'],
        ['GLOBAL_POLLUTION_REPORT.md', '1469 全局量化报告'],
        ['tm-endturn.js 顶部', 'endTurn 18k 行导航'],
        ['tm-game-engine.js 顶部', 'game-engine 9k 导航'],
        ['tm-chaoyi-keju.js 顶部', 'chaoyi-keju 9k 导航']
      ]
    }
  ];

  function renderHTML() {
    var html = SECTIONS.map(function(sec){
      var body = '';
      if (sec.code) body = _codeBlock(sec.code.join('\n'));
      if (sec.items) {
        body += '<table style="width:100%;border-collapse:collapse;font-size:11px">'
          + sec.items.map(function(it){
            return '<tr><td style="padding:2px 8px 2px 0;color:#9ac870;white-space:nowrap;vertical-align:top">' + _esc(it[0]) + '</td>'
              + '<td style="padding:2px 0;color:#ccc">' + _esc(it[1]) + '</td></tr>';
          }).join('')
          + '</table>';
      }
      return _section(sec.title, body);
    }).join('');
    return html;
  }

  function show() {
    if (isOpen) return;
    isOpen = true;
    var el = document.createElement('div');
    el.id = overlayId;
    el.style.cssText = 'position:fixed;right:20px;top:20px;width:640px;max-width:92vw;max-height:90vh;overflow-y:auto;'
      + 'background:#0f0c08;border:1px solid #5a3a1a;border-radius:6px;box-shadow:0 8px 32px rgba(0,0,0,0.8);'
      + 'z-index:99993;color:#ddd;font-family:sans-serif;padding:12px';
    el.innerHTML = '<div style="display:flex;align-items:center;margin-bottom:8px;border-bottom:1px solid #3a2a10;padding-bottom:8px">'
      + '<b style="color:#e8c66e;font-size:14px">🀄 天命 · 诊断速查卡</b>'
      + '<span style="color:#888;font-size:10px;margin-left:12px">Ctrl+Shift+/ 关闭</span>'
      + '<button onclick="TM.cheatsheet.hide()" style="margin-left:auto;background:#2a2a2a;color:#ccc;border:1px solid #4a4a4a;padding:3px 10px;cursor:pointer;font-size:11px">关闭</button>'
      + '</div>'
      + renderHTML();
    document.body.appendChild(el);
  }

  function hide() {
    var el = document.getElementById(overlayId);
    if (el) el.remove();
    isOpen = false;
  }

  function toggle() { isOpen ? hide() : show(); }

  function installHotkey() {
    if (window._tmCheatsheetHotkey) return;
    window._tmCheatsheetHotkey = true;
    document.addEventListener('keydown', function(e){
      if (e.ctrlKey && e.shiftKey && (e.key === '/' || e.key === '?')) {
        e.preventDefault();
        toggle();
      }
    });
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installHotkey);
    else installHotkey();
  }

  TM.cheatsheet = {
    show: show,
    hide: hide,
    toggle: toggle,
    sections: SECTIONS
  };
})();
