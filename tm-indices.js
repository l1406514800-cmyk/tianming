// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// tm-indices.js — 索引 & WorldHelper (R123 从 tm-index-world.js L1-863 拆出)
// 姊妹: tm-world.js (L864-end·特质/AI 上下文/奏疏/官制/编年)
// Requires: tm-data-model.js (P, GM),
//           tm-utils.js (_dbg, uid, callAI, callAISmart, escHtml, getTS, deepClone)
// ============================================================

/** 构建所有 Map 索引（角色/势力/党派/阶层等按名字快查） */
// ============================================================
//  tm-index-world.js — 索引与查询系统（8,820 行）
// ============================================================
//
// ══════════════════════════════════════════════════════════════
//  📍 导航地图（2026-04-24 R78 实测）
// ══════════════════════════════════════════════════════════════
//
//  ┌─ §A 索引系统（L8-258） ─────────────────────────┐
//  │  L8   buildIndices()              建立所有 O(1) 索引 Map
//  │        charByName / facByName / partyByName / classByName /
//  │        techByName / armyByName / postById / postByTerritory /
//  │        unitById / supplyDepotById / buildingById /
//  │        officeByName / officeByHolder / divisionByName
//  │  L258 addScenarioToIndex()        新增剧本到 P._indices
//  └─────────────────────────────────────────────────────┘
//
//  ┌─ §B 查询入口（L278-352）事实上的 DAL 内核 ──────┐
//  │  L278 findCharByName()            含 O(1) + 线性兜底 +
//  │                                   字/号/乳名/别名/曾用名 匹配
//  │  L316 findFacByName()
//  │  L323 findPartyByName()
//  │  L330 findClassByName()
//  │  L352 findScenarioById()
//  │  （findDivisionByName 也在此文件）
//  │  → DA.chars/factions/parties 委托给这些函数
//  └─────────────────────────────────────────────────────┘
//
//  ┌─ §C 行政区划 & 官制面板（L500-8000+） ────────────┐
//  │  庞大的 tab 渲染逻辑·大部分位于此文件
//  │  包含：地方 tab / 官制 tab 中间栏 / 国事汇总
//  └─────────────────────────────────────────────────────┘
//
// ══════════════════════════════════════════════════════════════
//  🛠️ 调试入口
// ══════════════════════════════════════════════════════════════
//
//  GM._indices                        所有索引 Map（Chrome devtools 展开）
//  buildIndices()                     手动重建（新加角色后必要）
//  findCharByName('袁崇焕')            等价 DA.chars.findByName
//
// ══════════════════════════════════════════════════════════════
//  ⚠️ 架构注意事项
// ══════════════════════════════════════════════════════════════
//
//  1. 新增角色时必须调 buildIndices() 或在 GM._indices.charByName
//     手动 set(name, char)，否则 findCharByName 走线性扫描（变慢）
//  2. 新代码优先用 DA.chars.findByName，不要直接 findCharByName
//     （DA 未来改内部时调用方不用动）
//  3. officeTree 相关索引（officeByName/officeByHolder）在官制变动时
//     需要 rebuild：detectOfficeChange → buildIndices
//
// ══════════════════════════════════════════════════════════════

function buildIndices() {
  // 初始化索引对象
  if (!GM._indices) {
    GM._indices = {};
  }

  // 初始化监听系统
  initDataListeners();

  // 1. 角色索引（按名字）
  GM._indices.charByName = new Map();
  if (GM.chars && GM.chars.length > 0) {
    GM.chars.forEach(function(char) {
      if (char && char.name) {
        GM._indices.charByName.set(char.name, char);
      }
    });
  }

  // 2. 势力索引（按名字）
  GM._indices.facByName = new Map();
  if (GM.facs && GM.facs.length > 0) {
    GM.facs.forEach(function(fac) {
      if (fac && fac.name) {
        GM._indices.facByName.set(fac.name, fac);
      }
    });
  }

  // 3. 党派索引（按名字）
  GM._indices.partyByName = new Map();
  if (GM.parties && GM.parties.length > 0) {
    GM.parties.forEach(function(party) {
      if (party && party.name) {
        GM._indices.partyByName.set(party.name, party);
      }
    });
  }

  // 4. 阶层索引（按名字）
  GM._indices.classByName = new Map();
  if (GM.classes && GM.classes.length > 0) {
    GM.classes.forEach(function(cls) {
      if (cls && cls.name) {
        GM._indices.classByName.set(cls.name, cls);
      }
    });
  }


  // 6. 科技索引（按名字）
  GM._indices.techByName = new Map();
  if (GM.techTree && GM.techTree.length > 0) {
    GM.techTree.forEach(function(tech) {
      if (tech && tech.name) {
        GM._indices.techByName.set(tech.name, tech);
      }
    });
  }

  // 7. 军队索引（按名字）
  GM._indices.armyByName = new Map();
  if (GM.armies && GM.armies.length > 0) {
    GM.armies.forEach(function(army) {
      if (army && army.name) {
        GM._indices.armyByName.set(army.name, army);
      }
    });
  }

  // 8. 场景索引（按 ID）- 全局 P 对象
  if (!P._indices) {
    P._indices = {};
  }
  P._indices.scenarioById = new Map();
  if (P.scenarios && P.scenarios.length > 0) {
    P.scenarios.forEach(function(sc) {
      if (sc && sc.id) {
        P._indices.scenarioById.set(sc.id, sc);
      }
    });
  }

  // 9. 岗位索引（按 ID 和领地 ID）
  if (GM.postSystem && GM.postSystem.enabled) {
    GM._indices.postById = new Map();
    GM._indices.postByTerritory = new Map();

    if (GM.postSystem.posts && GM.postSystem.posts.length > 0) {
      GM.postSystem.posts.forEach(function(post) {
        if (post && post.id) {
          GM._indices.postById.set(post.id, post);

          if (post.territoryId) {
            if (!GM._indices.postByTerritory.has(post.territoryId)) {
              GM._indices.postByTerritory.set(post.territoryId, []);
            }
            GM._indices.postByTerritory.get(post.territoryId).push(post);
          }
        }
      });
    }
  }

  // 10. Unit 索引（按 ID）
  if (P.unitSystem && P.unitSystem.enabled) {
    GM._indices.unitById = new Map();
    if (GM.units && GM.units.length > 0) {
      GM.units.forEach(function(unit) {
        if (unit && unit.id) {
          GM._indices.unitById.set(unit.id, unit);
        }
      });
    }
  }

  // 11. 补给仓库索引（按 ID）
  if (P.supplySystem && P.supplySystem.enabled) {
    GM._indices.supplyDepotById = new Map();
    if (GM.supplyDepots && GM.supplyDepots.length > 0) {
      GM.supplyDepots.forEach(function(depot) {
        if (depot && depot.id) {
          GM._indices.supplyDepotById.set(depot.id, depot);
        }
      });
    }
  }

  // 12. 建筑索引（按 ID 和领地）
  GM._indices.buildingById = new Map();
  GM._indices.buildingByTerritory = new Map();
  if (GM.buildings && GM.buildings.length > 0) {
    GM.buildings.forEach(function(b) {
      if (b && b.id) {
        GM._indices.buildingById.set(b.id, b);
        if (b.territory) {
          if (!GM._indices.buildingByTerritory.has(b.territory)) {
            GM._indices.buildingByTerritory.set(b.territory, []);
          }
          GM._indices.buildingByTerritory.get(b.territory).push(b);
        }
      }
    });
  }

  // 13. 官职索引（按职位名）——walk officeTree·替代反复 walk 查询
  GM._indices.officeByName = new Map();
  GM._indices.officeByHolder = new Map();
  if (GM.officeTree && GM.officeTree.length > 0) {
    (function _walk(nodes, path) {
      (nodes || []).forEach(function(n) {
        if (!n) return;
        var _dept = (path ? path + '/' : '') + (n.name || '');
        (n.positions || []).forEach(function(p) {
          if (!p || !p.name) return;
          // 若同名职位多处·保留首个·附加 dept 字段便于区分
          if (!GM._indices.officeByName.has(p.name)) GM._indices.officeByName.set(p.name, { pos: p, dept: _dept, node: n });
          if (p.holder && p.holder !== '\u7A7A' && p.holder !== '') GM._indices.officeByHolder.set(p.holder, { pos: p, dept: _dept, node: n });
        });
        if (n.subs) _walk(n.subs, _dept);
      });
    })(GM.officeTree, '');
  }

  // 14. 行政区划索引（按名字/ID）——扁平化 adminHierarchy 树（支持对象根+数组根）
  GM._indices.divisionByName = new Map();
  if (GM.adminHierarchy) {
    var _divFlat = function(n) {
      if (!n) return;
      if (n.name) GM._indices.divisionByName.set(n.name, n);
      if (n.id && !GM._indices.divisionByName.has(n.id)) GM._indices.divisionByName.set(n.id, n);
      var _kids = n.children || n.subs || [];
      if (Array.isArray(_kids)) _kids.forEach(_divFlat);
    };
    if (Array.isArray(GM.adminHierarchy)) GM.adminHierarchy.forEach(_divFlat);
    else _divFlat(GM.adminHierarchy);
  }
}

// initAchievements 在 tm-dynamic-systems.js 中定义，此处不能直接调用（尚未加载）
// 改为在 startGame() 中调用

// 重建索引（在数据变化后调用）
function rebuildIndices() {
  buildIndices();
}

// ============================================================
//  索引维护函数（动态添加/删除/更新数据时使用）
// ============================================================

// 添加到索引
function addToIndex(type, key, value) {
  if (!GM._indices) {
    GM._indices = {};
  }

  var indexMap = {
    'char': 'charByName',
    'fac': 'facByName',
    'party': 'partyByName',
    'class': 'classByName',
    'tech': 'techByName',
    'army': 'armyByName',
    'post': 'postById',
    'unit': 'unitById',
    'building': 'buildingById',
    'supplyDepot': 'supplyDepotById'
  };

  var indexName = indexMap[type];
  if (!indexName) return;

  if (!GM._indices[indexName]) {
    GM._indices[indexName] = new Map();
  }

  GM._indices[indexName].set(key, value);
}

// 从索引中删除
function removeFromIndex(type, key) {
  if (!GM._indices) return;

  var indexMap = {
    'char': 'charByName',
    'fac': 'facByName',
    'party': 'partyByName',
    'class': 'classByName',
    'tech': 'techByName',
    'army': 'armyByName',
    'post': 'postById',
    'unit': 'unitById',
    'building': 'buildingById',
    'supplyDepot': 'supplyDepotById'
  };

  var indexName = indexMap[type];
  if (!indexName || !GM._indices[indexName]) return;

  GM._indices[indexName].delete(key);
}

// 更新索引（当 key 改变时）
function updateIndex(type, oldKey, newKey, value) {
  removeFromIndex(type, oldKey);
  addToIndex(type, newKey, value);
}

// 场景索引维护（全局 P 对象）
function addScenarioToIndex(id, scenario) {
  if (!P._indices) {
    P._indices = {};
  }
  if (!P._indices.scenarioById) {
    P._indices.scenarioById = new Map();
  }
  P._indices.scenarioById.set(id, scenario);
}

function removeScenarioFromIndex(id) {
  if (!P._indices || !P._indices.scenarioById) return;
  P._indices.scenarioById.delete(id);
}

function updateScenarioIndex(oldId, newId, scenario) {
  removeScenarioFromIndex(oldId);
  addScenarioToIndex(newId, scenario);
}

// 快速查询函数（O(1) 复杂度）
/** @param {string} name @returns {Object|undefined} 角色对象 */
function findCharByName(name) {
  if (!name) return undefined;
  if (!GM._indices || !GM._indices.charByName) {
    buildIndices();
  }
  var hit = GM._indices.charByName.get(name);
  if (hit) return hit;
  // Fallback·线性扫 GM.chars·捕获未注册到索引的新生成角色(多站点 push 漏 index.set)
  // 命中后顺手 patch 索引·下次直接 O(1)
  if (Array.isArray(GM.chars)) {
    for (var i = 0; i < GM.chars.length; i++) {
      var c = GM.chars[i];
      if (!c) continue;
      if (c.name === name) {
        try { GM._indices.charByName.set(name, c); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-index-world');}catch(_){}}
        return c;
      }
      // 别名/字/号/乳名/曾用名兜底匹配
      if (c.zi === name || c.haoName === name || c.milkName === name) {
        try { GM._indices.charByName.set(name, c); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-index-world');}catch(_){}}
        return c;
      }
      if (Array.isArray(c.aliases) && c.aliases.indexOf(name) >= 0) {
        try { GM._indices.charByName.set(name, c); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-index-world');}catch(_){}}
        return c;
      }
      if (Array.isArray(c.formerNames) && c.formerNames.indexOf(name) >= 0) {
        try { GM._indices.charByName.set(name, c); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-index-world');}catch(_){}}
        return c;
      }
    }
  }
  return undefined;
}

/** @param {string} name @returns {Object|undefined} 势力对象 */
function findFacByName(name) {
  if (!GM._indices || !GM._indices.facByName) {
    buildIndices();
  }
  return GM._indices.facByName.get(name);
}

function findPartyByName(name) {
  if (!GM._indices || !GM._indices.partyByName) {
    buildIndices();
  }
  return GM._indices.partyByName.get(name);
}

function findClassByName(name) {
  if (!GM._indices || !GM._indices.classByName) {
    buildIndices();
  }
  return GM._indices.classByName.get(name);
}

function findTechByName(name) {
  if (!GM._indices || !GM._indices.techByName) {
    buildIndices();
  }
  return GM._indices.techByName.get(name);
}

function findArmyByName(name) {
  if (!GM._indices || !GM._indices.armyByName) {
    buildIndices();
  }
  return GM._indices.armyByName.get(name);
}

/** @param {string} sid @returns {Object|undefined} 剧本对象 */
function findScenarioById(id) {
  if (!P._indices || !P._indices.scenarioById) {
    buildIndices();
  }
  // 防御性检查：确保 scenarioById 是 Map 对象
  if (!(P._indices.scenarioById instanceof Map)) {
    console.warn('[findScenarioById] scenarioById 不是 Map，重建索引');
    buildIndices();
  }
  return P._indices.scenarioById.get(id);
}

// ============================================================
// WorldHelper - 统一数据查询接口
// ============================================================

/**
 * WorldHelper 数据查询系统
 * 借鉴 KingOfIreland 的 WorldHelper 设计，提供统一的数据访问接口
 *
 * 核心特性：
 * 1. 统一查询接口（getById, getByName, getAll）
 * 2. 链式查询支持（filter, map, reduce）
 * 3. 关系查询（getVassals, getLiege, getSubordinates）
 * 4. 查询缓存机制
 * 5. 数据统计函数（count, sum, avg）
 */

var WorldHelper = {
  // 查询缓存
  _queryCache: {},
  _cacheEnabled: true,
  _cacheTTL: 1000, // 缓存有效期（毫秒）

  // 清空缓存
  clearCache: function() {
    this._queryCache = {};
  },

  // 获取缓存键
  _getCacheKey: function(type, method, args) {
    return type + '.' + method + '.' + JSON.stringify(args);
  },

  // 从缓存获取
  _getFromCache: function(key) {
    if (!this._cacheEnabled) return null;
    var cached = this._queryCache[key];
    if (!cached) return null;
    if (Date.now() - cached.timestamp > this._cacheTTL) {
      delete this._queryCache[key];
      return null;
    }
    return cached.data;
  },

  // 存入缓存
  _setCache: function(key, data) {
    if (!this._cacheEnabled) return;
    this._queryCache[key] = {
      data: data,
      timestamp: Date.now()
    };
  },

  // 获取所有实体（通用）
  getAll: function(type) {
    var cacheKey = this._getCacheKey(type, 'getAll', []);
    var cached = this._getFromCache(cacheKey);
    if (cached) return cached;

    var result = [];
    switch(type) {
      case 'character':
        result = GM.chars || [];
        break;
      case 'faction':
        result = GM.facs || [];
        break;
      case 'party':
        result = GM.parties || [];
        break;
      case 'class':
        result = GM.classes || [];
        break;
      case 'army':
        result = GM.armies || [];
        break;
      case 'tech':
        result = GM.techTree || [];
        break;
      case 'civic':
        result = GM.civicTree || [];
        break;
      case 'post':
        result = GM.posts || [];
        break;
      case 'scenario':
        result = P.scenarios || [];
        break;
      case 'region':
        result = (P.map && P.map.regions) || [];
        break;
      default:
        result = [];
    }

    this._setCache(cacheKey, result);
    return result;
  },

  // 按名字查询（单个）
  getByName: function(type, name) {
    if (!name) return null;

    var cacheKey = this._getCacheKey(type, 'getByName', [name]);
    var cached = this._getFromCache(cacheKey);
    if (cached !== null) return cached;

    var result = null;
    switch(type) {
      case 'character':
        result = findCharByName(name);
        break;
      case 'faction':
        result = findFacByName(name);
        break;
      case 'party':
        result = findPartyByName(name);
        break;
      case 'class':
        result = findClassByName(name);
        break;
      case 'army':
        result = findArmyByName(name);
        break;
      case 'tech':
        result = findTechByName(name);
        break;
      default:
        result = this.getAll(type).find(function(item) {
          return item.name === name;
        });
    }

    this._setCache(cacheKey, result);
    return result;
  },

  // 按 ID 查询（单个）
  getById: function(type, id) {
    if (!id) return null;

    var cacheKey = this._getCacheKey(type, 'getById', [id]);
    var cached = this._getFromCache(cacheKey);
    if (cached !== null) return cached;

    var result = null;
    if (type === 'scenario') {
      result = findScenarioById(id);
    } else {
      result = this.getAll(type).find(function(item) {
        return item.id === id;
      });
    }

    this._setCache(cacheKey, result);
    return result;
  },

  // 条件查询（多个）
  where: function(type, predicate) {
    return this.getAll(type).filter(predicate);
  },

  // 统计数量
  count: function(type, predicate) {
    if (predicate) {
      return this.where(type, predicate).length;
    }
    return this.getAll(type).length;
  },

  // 求和
  sum: function(type, property, predicate) {
    var items = predicate ? this.where(type, predicate) : this.getAll(type);
    return items.reduce(function(sum, item) {
      return sum + (item[property] || 0);
    }, 0);
  },

  // 平均值
  avg: function(type, property, predicate) {
    var items = predicate ? this.where(type, predicate) : this.getAll(type);
    if (items.length === 0) return 0;
    return this.sum(type, property, predicate) / items.length;
  },

  // 最大值
  max: function(type, property, predicate) {
    var items = predicate ? this.where(type, predicate) : this.getAll(type);
    if (items.length === 0) return null;
    return items.reduce(function(max, item) {
      return (item[property] || 0) > (max[property] || 0) ? item : max;
    });
  },

  // 最小值
  min: function(type, property, predicate) {
    var items = predicate ? this.where(type, predicate) : this.getAll(type);
    if (items.length === 0) return null;
    return items.reduce(function(min, item) {
      return (item[property] || 0) < (min[property] || 0) ? item : min;
    });
  },

  // ============================================================
  // 关系查询（中国古代背景）
  // ============================================================

  // 获取角色的所有下属
  getSubordinates: function(characterName) {
    if (!characterName) return [];

    var char = this.getByName('character', characterName);
    if (!char || !char.position) return [];

    // 查找官职
    var office = this.findOffice(char.position);
    if (!office) return [];

    // 查找该官职的下属官职
    var subordinateOffices = this.getSubordinateOffices(office);

    // 查找担任这些官职的角色
    var subordinates = [];
    subordinateOffices.forEach(function(subOffice) {
      var holder = WorldHelper.where('character', function(c) {
        return c.position === subOffice.name;
      });
      subordinates = subordinates.concat(holder);
    });

    return subordinates;
  },

  // 获取角色的上级
  getSuperior: function(characterName) {
    if (!characterName) return null;

    var char = this.getByName('character', characterName);
    if (!char || !char.position) return null;

    // 查找官职
    var office = this.findOffice(char.position);
    if (!office || !office.deptId) return null;

    // 查找部门负责人
    var dept = this.findDepartment(office.deptId);
    if (!dept || !dept.head) return null;

    return this.getByName('character', dept.head);
  },

  // 获取势力的所有封臣
  getVassals: function(factionName) {
    if (!factionName) return [];

    var faction = this.getByName('faction', factionName);
    if (!faction || !faction.vassals) return [];

    return faction.vassals.map(function(vassalName) {
      return WorldHelper.getByName('faction', vassalName);
    }).filter(function(v) { return v !== null; });
  },

  // 获取势力的宗主
  getLiege: function(factionName) {
    if (!factionName) return null;

    var faction = this.getByName('faction', factionName);
    if (!faction || !faction.liege) return null;

    return this.getByName('faction', faction.liege);
  },

  // 获取角色的所有关系
  getRelations: function(characterName) {
    if (!characterName) return [];

    var relations = [];

    // 查找父子关系
    var children = this.where('character', function(c) {
      return c.father === characterName || c.mother === characterName;
    });
    children.forEach(function(child) {
      relations.push({ type: '子女', target: child.name, character: child });
    });

    // 查找配偶关系
    var char = this.getByName('character', characterName);
    if (char && char.spouse) {
      var spouse = this.getByName('character', char.spouse);
      if (spouse) {
        relations.push({ type: '配偶', target: spouse.name, character: spouse });
      }
    }

    // 查找上下级关系
    var subordinates = this.getSubordinates(characterName);
    subordinates.forEach(function(sub) {
      relations.push({ type: '下属', target: sub.name, character: sub });
    });

    var superior = this.getSuperior(characterName);
    if (superior) {
      relations.push({ type: '上级', target: superior.name, character: superior });
    }

    return relations;
  },

  // ============================================================
  // 辅助查询函数
  // ============================================================

  // 查找官职
  findOffice: function(officeName) {
    if (!GM.officeTree || !officeName) return null;

    var result = null;
    function search(nodes) {
      for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        if (node.positions) {
          for (var j = 0; j < node.positions.length; j++) {
            if (node.positions[j].name === officeName) {
              result = node.positions[j];
              result.deptId = node.id;
              result.deptName = node.name;
              return;
            }
          }
        }
        if (node.children) {
          search(node.children);
        }
      }
    }
    search(GM.officeTree);
    return result;
  },

  // 查找部门
  findDepartment: function(deptId) {
    if (!GM.officeTree || !deptId) return null;

    var result = null;
    function search(nodes) {
      for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].id === deptId) {
          result = nodes[i];
          return;
        }
        if (nodes[i].children) {
          search(nodes[i].children);
        }
      }
    }
    search(GM.officeTree);
    return result;
  },

  // 获取下属官职
  getSubordinateOffices: function(office) {
    if (!office || !office.deptId) return [];

    var dept = this.findDepartment(office.deptId);
    if (!dept) return [];

    var subordinates = [];
    if (dept.positions) {
      dept.positions.forEach(function(pos) {
        if (pos.rank > office.rank) {
          subordinates.push(pos);
        }
      });
    }

    return subordinates;
  },

  // 获取角色所在势力
  getCharacterFaction: function(characterName) {
    if (!characterName) return null;

    var char = this.getByName('character', characterName);
    if (!char || !char.faction) return null;

    return this.getByName('faction', char.faction);
  },

  // 获取势力的所有角色
  getFactionCharacters: function(factionName) {
    if (!factionName) return [];

    return this.where('character', function(c) {
      return c.faction === factionName;
    });
  },

  // 获取势力的所有军队
  getFactionArmies: function(factionName) {
    if (!factionName) return [];

    return this.where('army', function(a) {
      return a.faction === factionName;
    });
  },

  // 获取势力的总兵力
  getFactionTotalSoldiers: function(factionName) {
    return this.sum('army', 'soldiers', function(a) {
      return a.faction === factionName;
    });
  },

  // 获取角色的权力值（根据官职和能力）
  getCharacterPower: function(characterName) {
    var char = this.getByName('character', characterName);
    if (!char) return 0;

    var power = 0;

    // 基础能力值
    power += (char.intelligence || 0) * 0.3;
    power += (char.valor || 0) * 0.2;
    power += (char.benevolence || 0) * 0.1;

    // 官职加成
    if (char.position) {
      var office = this.findOffice(char.position);
      if (office && office.rank) {
        power += (10 - office.rank) * 10; // 品级越高权力越大
      }
    }

    // 下属数量加成
    var subordinates = this.getSubordinates(characterName);
    power += subordinates.length * 5;

    return Math.round(power);
  }
};

// findCharByName / findFacByName 已在索引系统中定义（约6895行），此处不再重复

