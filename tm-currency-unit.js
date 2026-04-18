/**
 * tm-currency-unit.js — 全局货币单位服务
 * ═══════════════════════════════════════════════════════════════════
 * 对应方案：
 *   · 设计方案-财政系统.md B.6（朝代默认单位）
 *   · 设计方案-货币系统.md（贯/两/文换算）
 *   · 设计方案-央地财政.md（地方公库/私产单位统一）
 *
 * 原则：
 *   1. 全局单位由 scriptData.fiscalConfig.unit 决定（剧本可配）
 *   2. 朝代默认：明清 = 两 · 唐宋元 = 贯 · 秦汉魏晋 = 钱
 *   3. 换算比率：1两 ≠ 1贯（贯为铜钱串，两为白银重量），1两 ≈ 1000文铜钱 ≈ 1贯
 *      —— 但因朝代铜钱成色波动，可配置 silverToCoin 比率
 *   4. **内部存储**：统一用 "基础货币单位"（数值），不随显示单位转换
 *   5. **显示层**：UI / prompt / 存档摘要 全部走 CurrencyUnit.fmt(value, kind)
 *
 * 不改动现有数据，只提供"读数字 → 带单位字符串"的 format 服务。
 * ═══════════════════════════════════════════════════════════════════
 */
(function(global) {
  'use strict';

  // ── 朝代默认单位 ──
  var DYNASTY_DEFAULT_UNITS = {
    // 朝代名（匹配 scriptData.dynasty 或 sc.dynasty 子串）
    '秦':    { money:'钱',  grain:'石', cloth:'匹', silverToCoin: 0     }, // 无银本位
    '汉':    { money:'钱',  grain:'石', cloth:'匹', silverToCoin: 0     },
    '魏':    { money:'钱',  grain:'石', cloth:'匹', silverToCoin: 0     },
    '晋':    { money:'钱',  grain:'石', cloth:'匹', silverToCoin: 0     },
    '南北朝':{ money:'钱',  grain:'石', cloth:'匹', silverToCoin: 0     },
    '隋':    { money:'贯',  grain:'石', cloth:'匹', silverToCoin: 1000  },
    '唐':    { money:'贯',  grain:'石', cloth:'匹', silverToCoin: 800   },
    '五代':  { money:'贯',  grain:'石', cloth:'匹', silverToCoin: 900   },
    '宋':    { money:'贯',  grain:'石', cloth:'匹', silverToCoin: 1000  },
    '辽':    { money:'贯',  grain:'石', cloth:'匹', silverToCoin: 1000  },
    '金':    { money:'贯',  grain:'石', cloth:'匹', silverToCoin: 1000  },
    '元':    { money:'贯',  grain:'石', cloth:'匹', silverToCoin: 1000  },
    '明':    { money:'两',  grain:'石', cloth:'匹', silverToCoin: 700   }, // 明中后期
    '清':    { money:'两',  grain:'石', cloth:'匹', silverToCoin: 1000  },
    'default':{ money:'两', grain:'石', cloth:'匹', silverToCoin: 1000  }
  };

  function _inferDynastyKey() {
    var sd = global.scriptData || {};
    var sc = (typeof global.findScenarioById === 'function' && global.GM && global.GM.sid)
      ? global.findScenarioById(global.GM.sid) : null;
    var dyn = (sc && (sc.dynasty || sc.era)) || sd.dynasty || (sd.settings && sd.settings.dynasty) || '';
    dyn = String(dyn);
    // 含"明"但不含"明清更迭"、"南明"等优先判断
    var keys = Object.keys(DYNASTY_DEFAULT_UNITS).filter(function(k){return k!=='default';});
    for (var i = 0; i < keys.length; i++) {
      if (dyn.indexOf(keys[i]) >= 0) return keys[i];
    }
    return 'default';
  }

  function _getEffectiveUnit() {
    var G = global.GM;
    // 优先：scriptData.fiscalConfig.unit（用户在编辑器选的）
    var sd = global.scriptData || {};
    var fc = (sd.fiscalConfig && sd.fiscalConfig.unit) || (global.P && global.P.fiscalConfig && global.P.fiscalConfig.unit) || null;
    // 其次：G.fiscal.unit
    var gfu = G && G.fiscal && G.fiscal.unit;
    // 再次：朝代默认
    var dynKey = _inferDynastyKey();
    var dynUnit = DYNASTY_DEFAULT_UNITS[dynKey] || DYNASTY_DEFAULT_UNITS.default;

    return {
      money: (fc && fc.money) || (gfu && gfu.money) || dynUnit.money,
      grain: (fc && fc.grain) || (gfu && gfu.grain) || dynUnit.grain,
      cloth: (fc && fc.cloth) || (gfu && gfu.cloth) || dynUnit.cloth,
      silverToCoin: (fc && fc.silverToCoin != null ? fc.silverToCoin : null) != null
                    ? fc.silverToCoin
                    : ((gfu && gfu.silverToCoin != null) ? gfu.silverToCoin : dynUnit.silverToCoin),
      dynastyKey: dynKey
    };
  }

  function _fmtNum(v) {
    v = Math.round(v||0);
    var abs = Math.abs(v);
    if (abs >= 1e8) return (v/1e8).toFixed(2) + '亿';
    if (abs >= 10000) return (v/10000).toFixed(1).replace(/\.0$/,'') + '万';
    if (abs >= 1000) return (v/1000).toFixed(1).replace(/\.0$/,'') + 'K';
    return String(v);
  }

  /** 格式化带单位字符串：fmt(1000000, 'money') → "100.0万两" */
  function fmt(value, kind) {
    var u = _getEffectiveUnit();
    var unit = u[kind || 'money'] || '';
    return _fmtNum(value) + unit;
  }

  /** 只取单位名（不带数字） */
  function unitOf(kind) {
    var u = _getEffectiveUnit();
    return u[kind || 'money'] || '';
  }

  /** 获取全局设置对象（只读） */
  function getUnit() {
    return _getEffectiveUnit();
  }

  /** 强制写入 GM.fiscal.unit（运行时改变单位用）——一般走编辑器配置，不用这个 */
  function setUnit(cfg) {
    var G = global.GM;
    if (!G) return;
    if (!G.fiscal) G.fiscal = {};
    if (!G.fiscal.unit) G.fiscal.unit = {};
    if (cfg.money) G.fiscal.unit.money = cfg.money;
    if (cfg.grain) G.fiscal.unit.grain = cfg.grain;
    if (cfg.cloth) G.fiscal.unit.cloth = cfg.cloth;
    if (cfg.silverToCoin != null) G.fiscal.unit.silverToCoin = cfg.silverToCoin;
  }

  global.CurrencyUnit = {
    fmt: fmt,
    unitOf: unitOf,
    getUnit: getUnit,
    setUnit: setUnit,
    DYNASTY_DEFAULT_UNITS: DYNASTY_DEFAULT_UNITS,
    VERSION: 1
  };

})(typeof window !== 'undefined' ? window : this);
