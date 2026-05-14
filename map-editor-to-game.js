// map-editor-to-game.js
// Phase 14.1·map editor v2 schema → game runtime region 格式
//
// 来源·web/map-editor*.js 导出的 JSON·包含·
//   { dynasty, era, title, bitmapWidth, bitmapHeight, divisions[],
//     rivers, roads, strongholds, areaLinks, ferries, heightMap, terrainMap, ... }
//
// 目标·game P.map / scriptData.map 的格式·
//   { name, width, height, regions[]: { id, name, coords (flat), center, neighbors,
//                                       terrain, owner, color, development, ... } }
//
// 飞地策略·extraPolygons 拆为 sibling region·id 后缀 _ex0/_ex1·共享 owner+terrain+color
//
// 2026-05-06

(function(global){
  'use strict';

  // ─── ① 主转换 ────────────────────────────────────────────

  function convertMapEditorToGame(meData, opts){
    opts = opts || {};
    if (!meData || !meData.divisions){
      throw new Error('非 map-editor v2 格式·缺 divisions');
    }

    var gm = {
      name: meData.title || '未命名地图',
      width: meData.bitmapWidth || 1280,
      height: meData.bitmapHeight || 800,
      dynasty: meData.dynasty || '',
      era: meData.era || '',
      regions: [],
      // phase 14·扩展·game 端可选用·不识则忽略
      _v2: {
        rivers: meData.rivers || [],
        roads: meData.roads || [],
        strongholds: meData.strongholds || [],
        ferries: meData.ferries || [],
        areaLinks: meData.areaLinks || []
      }
    };

    var splitExclaves = opts.splitExclaves !== false; // 默 true·飞地拆 sibling
    var simplifyTopology = !!opts.simplifyTopology;   // 拓扑顶点 cache·游戏端不需

    meData.divisions.forEach(function(d){
      gm.regions.push(divisionToRegion(d, meData));
      if (splitExclaves && d.extraPolygons && d.extraPolygons.length){
        d.extraPolygons.forEach(function(p, i){
          if (!p || p.length < 3) return;
          gm.regions.push(divisionToRegion(d, meData, {
            polygon: p,
            idSuffix: '_ex' + i,
            nameSuffix: '·飞地' + (i + 1)
          }));
        });
      }
    });

    // 邻接·若 v2 有 areaLinks·优先用·否则用 division.neighbors
    if (gm._v2.areaLinks && gm._v2.areaLinks.length){
      var byId = {};
      gm.regions.forEach(function(r){ byId[r.id] = r; });
      gm._v2.areaLinks.forEach(function(l){
        var a = byId[l.areaA], b = byId[l.areaB];
        if (!a || !b) return;
        if (a.neighbors.indexOf(l.areaB) < 0) a.neighbors.push(l.areaB);
        if (b.neighbors.indexOf(l.areaA) < 0) b.neighbors.push(l.areaA);
      });
    }

    return gm;
  }

  // ─── ② 单 division → region ──────────────────────────────

  function divisionToRegion(d, meData, override){
    override = override || {};
    var poly = override.polygon || d.polygon || [];
    var coordsFlat = flattenPolygon(poly);

    // owner·Phase 25·factionId 优先 (resolve to faction.name)·再 dejureOwner·autonomy.holder·governor
    var owner = '';
    if (d.factionId && meData && Array.isArray(meData.factions)){
      var fac = meData.factions.find(function(f){ return f && f.id === d.factionId; });
      if (fac) owner = fac.name || fac.id;
    }
    owner = owner || d.dejureOwner ||
            (d.autonomy && d.autonomy.holder) ||
            d.governor || '';

    // development·从 prosperity (0-100·已有) 或 populationDetail.mouths 估算
    var development = 50;
    if (typeof d.prosperity === 'number') development = Math.round(d.prosperity);
    else if (d.populationDetail && d.populationDetail.mouths){
      development = Math.min(100, Math.round(d.populationDetail.mouths / 10000));
    }

    // color·colorKey 优先·否则按 autonomy 类型
    var color = colorFromDivision(d);

    // troops·从 governanceMilitary 或 publicTreasuryInit 估
    var troops = 0;
    if (d.governanceMilitary && d.governanceMilitary.standingArmy){
      troops = d.governanceMilitary.standingArmy;
    } else if (d.publicTreasuryInit && d.publicTreasuryInit.troops){
      troops = d.publicTreasuryInit.troops;
    }

    return {
      id: d.id + (override.idSuffix || ''),
      name: d.name + (override.nameSuffix || ''),
      type: 'poly',
      coords: coordsFlat,
      center: d.centroid ? d.centroid.slice() : polygonCentroid(poly),
      neighbors: (d.neighbors || []).slice(),
      terrain: d.terrain || 'plains',
      resources: extractResources(d),
      owner: owner,
      characters: [],
      troops: troops,
      development: development,
      events: '',
      color: color,
      // v2 扩展·game 端可选读
      _meta: {
        level: d.level,
        regionType: d.regionType,
        autonomy: d.autonomy ? Object.assign({}, d.autonomy) : null,
        populationDetail: d.populationDetail || null,
        fiscalDetail: d.fiscalDetail || null,
        carryingCapacity: d.carryingCapacity || null,
        byEthnicity: d.byEthnicity || null,
        byFaith: d.byFaith || null,
        // schema v2·tm-endturn-province.js _peRender* 读·从 adminHierarchy 走才生效·此处携带备用
        tags: d.tags || null,
        economyBase: d.economyBase || null,
        timeline: d.timeline || [],
        establishedYear: d.establishedYear || null,
        abolishedYear: d.abolishedYear || null,
        isCapital: !!d.isCapital,
        isFrontier: !!d.isFrontier,
        isJunDi: !!d.isJunDi,
        crossDynastyId: d.crossDynastyId || '',
        colorKey: typeof d.colorKey === 'number' ? d.colorKey : null,
        sources: d.sources || []
      }
    };
  }

  // ─── ③ 几何 helpers ─────────────────────────────────────

  function flattenPolygon(poly){
    var arr = [];
    if (!poly || !poly.length) return arr;
    poly.forEach(function(p){
      if (Array.isArray(p) && p.length >= 2){
        arr.push(p[0], p[1]);
      }
    });
    return arr;
  }

  function polygonCentroid(poly){
    if (!poly || poly.length < 3) return null;
    var n = poly.length, cx = 0, cy = 0, area = 0;
    for (var i = 0; i < n; i++){
      var j = (i + 1) % n;
      var cross = poly[i][0] * poly[j][1] - poly[j][0] * poly[i][1];
      area += cross;
      cx += (poly[i][0] + poly[j][0]) * cross;
      cy += (poly[i][1] + poly[j][1]) * cross;
    }
    if (Math.abs(area) < 1e-9) return null;
    return [cx / (3 * area), cy / (3 * area)];
  }

  // ─── ④ 颜色规则 ──────────────────────────────────────────

  // 优先 colorKey (BGR 24-bit)·否则按 autonomy 类型
  function colorFromDivision(d){
    if (typeof d.colorKey === 'number'){
      var b = d.colorKey & 0xff;
      var g = (d.colorKey >> 8) & 0xff;
      var r = (d.colorKey >> 16) & 0xff;
      return '#' + toHex(r) + toHex(g) + toHex(b);
    }
    var typ = d.autonomy && d.autonomy.type;
    var palette = {
      zhixia:   '#3d4f6a',
      fanguo:   '#8a3a2e',
      fanzhen:  '#b65a30',
      jimi:     '#6a8a3a',
      chaogong: '#7a6a3a'
    };
    return palette[typ] || '#666666';
  }
  function toHex(n){
    var s = n.toString(16);
    return s.length === 1 ? '0' + s : s;
  }

  // ─── ⑤ resources 抽取 ──────────────────────────────────

  function extractResources(d){
    var res = [];
    if (d.specialResources && Array.isArray(d.specialResources)){
      res = res.concat(d.specialResources);
    }
    if (d.terrain){
      // 按地形推断常见资源·非排他·user 可后补
      var hint = {
        plains: ['粮'], hill: ['木'], mountain: ['石', '铁'],
        forest: ['木', '兽'], desert: ['盐'], marsh: ['鱼'],
        water: ['鱼'], jungle: ['木'], savanna: []
      };
      (hint[d.terrain] || []).forEach(function(r){
        if (res.indexOf(r) < 0) res.push(r);
      });
    }
    return res;
  }

  // ─── ⑥ 文件载入 + 整合到 P / scriptData ─────────────────

  function loadMapEditorJSON(json, opts){
    var meData = typeof json === 'string' ? JSON.parse(json) : json;
    var gm = convertMapEditorToGame(meData, opts);
    return gm;
  }

  function loadMapEditorFile(file, opts){
    return new Promise(function(resolve, reject){
      var reader = new FileReader();
      reader.onload = function(e){
        try {
          var gm = loadMapEditorJSON(e.target.result, opts);
          resolve(gm);
        } catch(err){
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }

  function loadMapEditorDialog(opts){
    return new Promise(function(resolve, reject){
      var input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.onchange = function(){
        var file = input.files && input.files[0];
        if (!file){ reject(new Error('未选文件')); return; }
        loadMapEditorFile(file, opts).then(function(gm){
          resolve({ gm: gm, fileName: file.name });
        }).catch(reject);
      };
      input.click();
    });
  }

  // ─── ⑦ map-editor divisions → adminHierarchy (DiFang panel 数据源) ───
  //
  // runtime tm-endturn-province.js 的 _peRender* 只读 GM.adminHierarchy / P.adminHierarchy·
  // 不读 GM.regions。要让地图编辑器的 schema v2 字段 (tags/economyBase) 流到玩家面板·
  // 必须建一份 adminHierarchy 平行结构。
  //
  // 结构·{ [factionName]: { name, divisions: [...flat·已附 children=[]] } }
  // 分组规则·按 division.factionId·解析为 faction.name·无 factionId 的进 '未归属'

  function convertMapEditorToAdminHierarchy(meData){
    if (!meData || !Array.isArray(meData.divisions)) return null;
    var facById = {};
    (meData.factions || []).forEach(function(f){ if (f && f.id) facById[f.id] = f; });

    var byFac = {};
    meData.divisions.forEach(function(d){
      var facName;
      if (d.factionId && facById[d.factionId]){
        facName = facById[d.factionId].name || d.factionId;
      } else {
        facName = '未归属';
      }
      if (!byFac[facName]){
        byFac[facName] = { name: facName, divisions: [] };
      }
      byFac[facName].divisions.push(divisionForAdmin(d));
    });
    return byFac;
  }

  // 拷一份 division·剥几何缓存·保所有 gameplay 字段·补 children=[]·与剧本 adminHierarchy 形状对齐
  var GEOMETRY_KEYS = {
    polygon: 1, holes: 1, extraPolygons: 1,
    polygonVids: 1, extraPolygonsVids: 1, holesVids: 1,
    bbox: 1, colorKey: 1, bitmap_color: 1, z_order: 1, area: 1, neighbors: 1
  };
  function divisionForAdmin(d){
    var clone = {};
    for (var k in d){
      if (GEOMETRY_KEYS[k]) continue;
      clone[k] = d[k];
    }
    if (!clone.children) clone.children = [];
    // runtime _peRender* 兼容·div.minxin / div.corruption 优先于 *Local
    if (clone.minxin == null && typeof clone.minxinLocal === 'number') clone.minxin = clone.minxinLocal;
    if (clone.corruption == null && typeof clone.corruptionLocal === 'number') clone.corruption = clone.corruptionLocal;
    return clone;
  }

  // ⑧.1·跑 IntegrationBridge.ensureDivisionData·扩 publicTreasuryInit→publicTreasury·
  //       populationDetail→population·fiscalDetail→fiscal·carryingCapacity→environment·
  //       minxinLocal→minxin·corruptionLocal→corruption·补 fallback 字段
  function _ensureBridgeRanOnAllDivisions(adminHierarchy){
    if (!adminHierarchy) return 0;
    var IB = (typeof window !== 'undefined' && window.IntegrationBridge) || null;
    if (!IB || typeof IB.ensureDivisionData !== 'function'){
      console.warn('[map-editor-to-game] IntegrationBridge 未加载·跳过 ensureDivisionData·publicTreasuryInit 不会扩展');
      return 0;
    }
    var n = 0;
    function walk(nodes){
      if (!nodes || !nodes.length) return;
      nodes.forEach(function(d){
        IB.ensureDivisionData(d, {});
        n++;
        if (d.children && d.children.length) walk(d.children);
      });
    }
    Object.keys(adminHierarchy).forEach(function(facName){
      var fh = adminHierarchy[facName];
      walk(fh && fh.divisions);
    });
    return n;
  }

  // ─── ⑧ 装入 game runtime / scriptData ─────────────────

  function installToGame(gm, opts){
    opts = opts || {};
    var meData = opts.meData || null;          // 若给·同时装 adminHierarchy
    var ah = meData ? convertMapEditorToAdminHierarchy(meData) : null;

    if (typeof window.P !== 'undefined'){
      window.P.map = gm;
      if (ah){
        window.P.adminHierarchy = ah;
        if (typeof window.GM !== 'undefined') window.GM.adminHierarchy = ah;
      }
      var nEnsured = ah ? _ensureBridgeRanOnAllDivisions(ah) : 0;
      console.log('[map-editor-to-game] P.map 已装·' + gm.regions.length + ' regions' +
        (ah ? '·adminHierarchy ' + Object.keys(ah).length + ' 势力·ensureDivisionData ' + nEnsured + ' divs' : ''));
      return { target: 'P.map', gm: gm, adminHierarchy: ah };
    }
    if (typeof window.scriptData !== 'undefined'){
      window.scriptData.map = gm;
      if (ah){
        window.scriptData.adminHierarchy = ah;
        var nEns2 = _ensureBridgeRanOnAllDivisions(ah);
        console.log('[map-editor-to-game] scriptData.map 已装·' + gm.regions.length + ' regions·adminHierarchy ' + Object.keys(ah).length + ' 势力·ensureDivisionData ' + nEns2 + ' divs');
      } else {
        console.log('[map-editor-to-game] scriptData.map 已装·' + gm.regions.length + ' regions');
      }
      return { target: 'scriptData.map', gm: gm, adminHierarchy: ah };
    }
    console.warn('[map-editor-to-game] 未发现 P / scriptData·返回 gm');
    return { target: null, gm: gm, adminHierarchy: ah };
  }

  // ─── expose ─────────────────────────────────────────────

  global.convertMapEditorToGame = convertMapEditorToGame;
  global.convertMapEditorToAdminHierarchy = convertMapEditorToAdminHierarchy;
  global.loadMapEditorJSON = loadMapEditorJSON;
  global.loadMapEditorFile = loadMapEditorFile;
  global.loadMapEditorDialog = loadMapEditorDialog;
  global.installMapEditorToGame = installToGame;

  // 命名空间汇集
  global.MapEditorBridge = {
    convertMapEditorToGame: convertMapEditorToGame,
    convertMapEditorToAdminHierarchy: convertMapEditorToAdminHierarchy,
    loadMapEditorJSON: loadMapEditorJSON,
    loadMapEditorFile: loadMapEditorFile,
    loadMapEditorDialog: loadMapEditorDialog,
    installToGame: installToGame
  };

})(typeof window !== 'undefined' ? window : this);
