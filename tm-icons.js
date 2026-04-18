// ============================================================
// 天命 中国风SVG图标系统
// 25个手绘风格图标，统一viewBox 24x24, stroke=currentColor
// ============================================================

var TM_ICONS = {
  // ═══ 游戏标签页图标 ═══
  scroll: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z"/><path d="M7 5h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7"/><path d="M5 15a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2z"/><line x1="10" y1="9" x2="17" y2="9"/><line x1="10" y1="13" x2="15" y2="13"/></svg>',

  memorial: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v16H4z"/><path d="M4 4l4 3h8l4-3"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="13" x2="14" y2="13"/><line x1="8" y1="16" x2="12" y2="16"/></svg>',

  dialogue: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h10v7H7l-3 3V6z"/><path d="M13 10h8v7h-4l-3 3v-3h-1v-7z"/></svg>',

  chronicle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="2" width="4" height="20" rx="1"/><rect x="10" y="2" width="4" height="20" rx="1"/><rect x="17" y="2" width="4" height="20" rx="1"/><line x1="5" y1="6" x2="5" y2="6.01"/><line x1="12" y1="6" x2="12" y2="6.01"/><line x1="19" y1="6" x2="19" y2="6.01"/></svg>',

  office: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 10c0-4 3-7 6-7s6 3 6 7"/><path d="M4 10h16v2H4z"/><path d="M8 12v3"/><path d="M16 12v3"/><path d="M6 15h12v2H6z"/><line x1="12" y1="17" x2="12" y2="21"/><line x1="9" y1="21" x2="15" y2="21"/></svg>',

  qiju: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><path d="M12 3c-1 2-4 3-4 6 0 2 2 3 4 3s4-1 4-3c0-3-3-4-4-6z"/><line x1="6" y1="20" x2="18" y2="20"/><line x1="8" y1="17" x2="8" y2="20"/></svg>',

  event: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v16H4z"/><path d="M4 4h16l-2 2H6L4 4z"/><line x1="8" y1="9" x2="16" y2="9"/><line x1="8" y1="12" x2="14" y2="12"/><line x1="8" y1="15" x2="12" y2="15"/></svg>',

  history: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2h8l4 4v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><path d="M14 2v4h4"/><path d="M3 12h2"/><path d="M3 8h2"/><path d="M3 16h2"/><line x1="8" y1="9" x2="14" y2="9"/><line x1="8" y1="13" x2="14" y2="13"/></svg>',

  // ═══ 资源/指标图标 ═══
  treasury: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.66 3.58 3 8 3s8-1.34 8-3V6"/><path d="M4 12v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6"/></svg>',

  grain: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21V10"/><path d="M12 10c-2-4-6-5-8-4"/><path d="M12 10c2-4 6-5 8-4"/><path d="M12 14c-1.5-2-4-3-6-2.5"/><path d="M12 14c1.5-2 4-3 6-2.5"/><path d="M12 18c-1-1.5-3-2-4.5-1.5"/><path d="M12 18c1-1.5 3-2 4.5-1.5"/></svg>',

  troops: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L8 8h8L12 2z"/><line x1="12" y1="8" x2="12" y2="20"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="6" y1="20" x2="18" y2="20"/></svg>',

  prestige: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="5" width="14" height="14" rx="2"/><rect x="8" y="8" width="8" height="8" rx="1"/><line x1="10" y1="11" x2="14" y2="11"/><line x1="10" y1="13" x2="14" y2="13"/></svg>',

  execution: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="3" width="12" height="18" rx="2"/><line x1="6" y1="8" x2="18" y2="8"/><circle cx="12" cy="14" r="2"/><line x1="12" y1="16" x2="12" y2="18"/></svg>',

  strife: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3l14 18"/><path d="M19 3L5 21"/><circle cx="12" cy="12" r="3"/></svg>',

  unrest: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2c0 4-4 6-4 10a4 4 0 0 0 8 0c0-4-4-6-4-10z"/><path d="M12 22v-4"/></svg>',

  // ═══ 操作图标 ═══
  save: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v16H4z"/><path d="M4 4l2-2h12l2 2"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="16" x2="12" y2="16"/></svg>',

  load: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"/><path d="M4 8h16"/><path d="M9 12l3 3 3-3"/><line x1="12" y1="8" x2="12" y2="15"/></svg>',

  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/><circle cx="8" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="10" cy="18" r="2"/></svg>',

  map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6z"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></svg>',

  policy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12" rx="1" transform="rotate(5 12 12)"/><line x1="9" y1="10" x2="15" y2="10" transform="rotate(5 12 12)"/><line x1="9" y1="14" x2="13" y2="14" transform="rotate(5 12 12)"/></svg>',

  agenda: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v3H4z"/><path d="M4 7h16v13H4z"/><line x1="8" y1="11" x2="16" y2="11"/><line x1="8" y1="14" x2="14" y2="14"/><line x1="8" y1="17" x2="12" y2="17"/></svg>',

  person: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="7" r="4"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/><path d="M9 3c0-1 1.5-2 3-2s3 1 3 2"/></svg>',

  faction: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V5l7-3 7 3v16"/><line x1="12" y1="2" x2="12" y2="21"/><line x1="5" y1="8" x2="12" y2="8"/><line x1="12" y1="12" x2="19" y2="12"/></svg>',

  'end-turn': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="6" x2="12" y2="12"/><line x1="12" y1="12" x2="16" y2="14"/><path d="M12 3v1"/><path d="M12 20v1"/><path d="M3 12h1"/><path d="M20 12h1"/></svg>',

  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>',

  // ═══ 风闻录事四类（告状/风议/密札/耳报） ═══
  // 告状 · 登闻鼓 —— 圆鼓+鼓槌
  drum: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="8" rx="7" ry="2.5"/><path d="M5 8v8c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V8"/><line x1="7" y1="3" x2="5.5" y2="5.5"/><line x1="17" y1="3" x2="18.5" y2="5.5"/></svg>',

  // 风议 · 士林舆论 —— 云纹+点点议论
  rumor: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 14c-2 0-3-1-3-3s1-3 3-3c0-2 2-4 5-4s6 2 6 4c2 0 3 1 3 3s-1 3-3 3z"/><circle cx="8" cy="19" r="0.8" fill="currentColor"/><circle cx="12" cy="20" r="0.8" fill="currentColor"/><circle cx="16" cy="19" r="0.8" fill="currentColor"/></svg>',

  // 密札 · 门生书信 —— 信封+朱印
  letter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="6" width="16" height="12" rx="1"/><path d="M4 8l8 5 8-5"/><circle cx="18" cy="16" r="1.3" fill="currentColor"/></svg>',

  // 耳报 · 内廷低语 —— 人耳+声波
  whisper: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3a5 5 0 0 0-5 5v4c0 2 1 3 2 4v5h4v-5c1 0 2-1 2-3"/><path d="M9 8a1 1 0 0 1 0 2"/><path d="M15 6c2 2 2 6 0 8"/><path d="M18 4c3 3 3 9 0 12"/></svg>'
};

/**
 * 获取SVG图标HTML
 * @param {string} id - 图标ID（TM_ICONS中的key）
 * @param {number} [size=18] - 图标大小(px)
 * @param {string} [className=''] - 额外CSS类名
 * @returns {string} 包裹在span中的SVG HTML
 */
function tmIcon(id, size, className) {
  size = size || 18;
  var svg = TM_ICONS[id] || '';
  if (!svg) return '<span class="tm-icon" style="width:'+size+'px;height:'+size+'px"></span>';
  // 替换viewBox中的宽高为实际size
  svg = svg.replace('<svg ', '<svg width="'+size+'" height="'+size+'" ');
  return '<span class="tm-icon'+(className?' '+className:'')+'" style="display:inline-flex;align-items:center;justify-content:center;width:'+size+'px;height:'+size+'px;flex-shrink:0">'+svg+'</span>';
}
