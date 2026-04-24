/* ============================================================
 * tm-ai-schema.js — AI 推演输出的权威 Schema（单一真源）
 *
 * 目的：把散落在以下位置的「AI 返回字段定义」收拢到一处：
 *   - tm-endturn.js 的 prompt 字符串（告诉 AI 字段怎么填）
 *   - tm-ai-output-validator.js 的 KNOWN_FIELDS（验证 AI 返回）
 *   - tm-ai-change-applier.js 的消费代码（读 aiOutput.xxx）
 *
 * 原来三处各自维护字段列表，容易漂移（例 npc_actions 已废弃但 prompt 有时还提）。
 * 现在 validator 从 TM_AI_SCHEMA 动态构建 KNOWN_FIELDS，保持同步。
 *
 * 字段元数据约定：
 *   {
 *     type: 'array' | 'object' | 'string' | 'number',
 *     desc: '一句话说明',
 *     required: false,             // 顶层字段是否必需（当前全为 false）
 *     deprecated: 'xxx 代替',       // 若已废弃，写新字段名
 *     items: { ... }                // array 元素的 schema（递归）
 *     requiredSubFields: ['name'],  // array 元素必填子字段
 *     producedBy: ['subcall1'],     // 哪个子调用产生（用于定位）
 *     consumedBy: ['applier', 'endturn']  // 哪些模块消费（重构时参照）
 *   }
 * ============================================================ */
(function(){
  'use strict';
  if (typeof window === 'undefined') return;
  if (window.TM_AI_SCHEMA) return;

  // ──────────────────────────────────────────────
  // Dialogue schema — 问对/朝议/密问/科议 返回 JSON 格式
  // ──────────────────────────────────────────────
  var DIALOGUE = {
    reply:        { type: 'string', desc: '大臣发言文本（必填）' },
    loyaltyDelta: { type: 'number', desc: '忠诚度变化（-100 ~ +100）' },
    emotionState: { type: 'string', desc: '情绪状态（喜/怒/惧/忧/惊/平/疑/恨等）' },
    toneEffect:   { type: 'string', desc: '语气对关系的额外效果描述' },
    suggestions:  { type: 'array',  desc: '可划入诏书的建言要点' },
    memoryImpact: { type: 'object', desc: '对 NPC 长期记忆的影响' },
    stance:       { type: 'string', desc: '立场标签' },
    // 朝议独有
    vote:         { type: 'string', desc: '表决倾向（支持/反对/中立）' },
    rebuttal:     { type: 'string', desc: '反驳他人发言' },
    // 科议独有
    exam_opinion: { type: 'string', desc: '科举议题建议' }
  };

  var S = {
    version: 2,
    lastUpdate: '2026-04-24',

    // ──────────────────────────────────────────────
    // 叙事文本（string）
    // ──────────────────────────────────────────────
    narrative:   { type: 'string', desc: '回合主叙事，半文言 300-800 字' },
    shilu_text:  { type: 'string', desc: '实录风格叙事补充' },
    shizhengji:  { type: 'string', desc: '时政记风格补充' },
    event:       { type: 'object', desc: '单个主要事件，带 desc' },

    // ──────────────────────────────────────────────
    // 数值增量（object）
    // ──────────────────────────────────────────────
    era_state_delta:    { type: 'object', desc: '时代参数调整（social/economy/centralization/military）' },
    global_state_delta: { type: 'object', desc: '全局状态调整（tax_pressure 等）' },

    // ──────────────────────────────────────────────
    // 核心实体变化（array）
    // ──────────────────────────────────────────────
    character_deaths: {
      type: 'array',
      desc: '让角色死亡（含玩家→游戏结束）',
      requiredSubFields: ['name'],
      consumedBy: ['endturn:9636', 'endturn:14205']
    },
    new_characters: {
      type: 'array',
      desc: '创建新角色（子嗣、投奔者、新官员）',
      requiredSubFields: ['name'],
      consumedBy: ['endturn', 'applier']
    },
    char_updates: {
      type: 'array',
      desc: '角色属性增量（忠诚/智力/野心/loyalty 等）',
      consumedBy: ['applier:954']
    },
    relations: {
      type: 'array',
      desc: '角色关系变化',
      consumedBy: ['applier:938']
    },

    // ──────────────────────────────────────────────
    // 势力与派别
    // ──────────────────────────────────────────────
    faction_changes: {
      type: 'array',
      desc: '势力属性变化（strength/economy/playerRelation delta）',
      requiredSubFields: ['name']
    },
    faction_updates:          { type: 'array', desc: '势力增量更新', consumedBy: ['applier:1263'] },
    faction_events:           { type: 'array', desc: '势力间自主事件（战争/联盟/政变/行军/围城）' },
    faction_relation_changes: { type: 'array', desc: '势力间关系变化' },
    faction_create:           { type: 'array', desc: '新势力崛起（独立/割据/称帝/复国）' },
    faction_succession:       { type: 'array', desc: '势力首脑传承' },
    faction_dissolve:         { type: 'array', desc: '势力覆灭（不得用于玩家势力）' },

    party_changes: {
      type: 'array',
      desc: '党派状态修改',
      requiredSubFields: ['name']
    },
    party_updates:   { type: 'array', desc: '党派增量', consumedBy: ['applier:1273'] },
    party_create:    { type: 'array', desc: '新党派崛起' },
    party_splinter:  { type: 'array', desc: '党派分裂' },
    party_merge:     { type: 'array', desc: '党派合流' },
    party_dissolve:  { type: 'array', desc: '党派覆灭' },

    class_changes: {
      type: 'array',
      desc: '阶层状态修改',
      requiredSubFields: ['name']
    },
    class_updates: { type: 'array', desc: '阶层增量', consumedBy: ['applier:1283'] },
    class_emerge:  { type: 'array', desc: '新阶层兴起' },
    class_revolt:  { type: 'array', desc: '阶层起义' },
    class_dissolve:{ type: 'array', desc: '阶层消亡' },

    // ──────────────────────────────────────────────
    // 军事
    // ──────────────────────────────────────────────
    army_changes: { type: 'array', desc: '修改部队兵力/士气/训练（降至0→覆没）' },

    // ──────────────────────────────────────────────
    // 物品与头衔
    // ──────────────────────────────────────────────
    item_changes:     { type: 'array', desc: '角色获得/失去物品' },
    title_changes:    { type: 'array', desc: '头衔爵位变动（grant/revoke/inherit/promote）' },
    building_changes: { type: 'array', desc: '建筑变动（build/upgrade/destroy，需 territory+type）' },
    vassal_changes:   { type: 'array', desc: '封臣关系变动（establish/break/change_tribute）' },

    // ──────────────────────────────────────────────
    // 官制与行政
    // ──────────────────────────────────────────────
    office_changes: {
      type: 'array',
      desc: '官制人事变动（appoint/dismiss/promote/demote/transfer/evaluate/reform）',
      requiredSubFields: ['action'],
      consumedBy: ['endturn:11115']
    },
    office_assignments: { type: 'array', desc: '官职任命（旧格式兼容）', consumedBy: ['applier:1004'] },
    office_spawn:       { type: 'array', desc: '官制占位实体化（把 generated:false 的 holder 生成为真人）' },
    personnel_changes:  { type: 'array', desc: '人事变动（旧格式兼容）', consumedBy: ['applier:1079'] },

    admin_changes: {
      type: 'array',
      desc: '行政区划人事（appoint_governor/remove_governor/adjust）'
    },
    admin_division_updates: {
      type: 'array',
      desc: '行政区划树结构变更（add/remove/rename/merge/split/reform/territory_gain/territory_loss）',
      requiredSubFields: ['action'],
      consumedBy: ['endturn:12009']
    },

    // ──────────────────────────────────────────────
    // 后宫与文化
    // ──────────────────────────────────────────────
    harem_events: {
      type: 'array',
      desc: '后宫事件（pregnancy/birth/death/rank_change/favor_change/scandal）',
      requiredSubFields: ['type'],
      consumedBy: ['endturn:12260']
    },
    tech_civic_unlocks: { type: 'array', desc: '解锁科技或推行民政政策（自动扣费+应用）' },
    policy_changes:     { type: 'array', desc: '国策变更（add/remove）' },

    // ──────────────────────────────────────────────
    // 时局与阴谋
    // ──────────────────────────────────────────────
    scheme_actions: { type: 'array', desc: '阴谋干预（advance/disrupt/abort/expose）' },
    timeline_triggers: { type: 'array', desc: '触发剧本预设时间线事件' },
    current_issues_update: {
      type: 'array',
      desc: '时局要务增量（add/resolve/update）',
      requiredSubFields: ['action'],
      consumedBy: ['endturn:9597']
    },

    // ──────────────────────────────────────────────
    // NPC 互动与诏令问责
    // ──────────────────────────────────────────────
    npc_interactions:     { type: 'array', desc: 'NPC 之间或 NPC→玩家的主动互动/奏对' },
    directive_compliance: { type: 'array', desc: '诏令执行报告（被 _postInferenceAccountability 消费）', consumedBy: ['applier:1593'] },

    // ──────────────────────────────────────────────
    // 财政与事件
    // ──────────────────────────────────────────────
    fiscal_adjustments: { type: 'array', desc: '财政调整（income/expense，会写 guoku）', consumedBy: ['applier:1136', 'applier:1444'] },
    region_updates:     { type: 'array', desc: '地区数据增量' },
    project_updates:    { type: 'array', desc: '工程项目进度' },
    events:             { type: 'array', desc: '本回合事件列表' },
    changes:            { type: 'array', desc: '通用变化列表（旧格式）' },
    appointments:       { type: 'array', desc: '任命列表（旧格式，官方用 office_changes）' },
    institutions:       { type: 'array', desc: '制度（旧格式）' },
    regions:            { type: 'array', desc: '地区（旧格式）' },
    localActions:       { type: 'array', desc: '地方行动（旧格式）' },
    anyPathChanges:     { type: 'array', desc: '任意路径变更（通用出口）', consumedBy: ['applier:1332'] },
    geoData:            { type: 'object', desc: '地理推算数据（行军/围城需要）' },
    memorials:          { type: 'array', desc: '奏疏文本' },
    letters:            { type: 'array', desc: 'NPC 主动传书' },
    bigyear:            { type: 'object', desc: '大事年（年度事件）' },
    bigYearEvent:       { type: 'object', desc: '大事年单事件（兼容命名）' },

    // ──────────────────────────────────────────────
    // 已废弃字段（validator 打 warn 提示迁移）
    // ──────────────────────────────────────────────
    npc_actions: { type: 'array', deprecated: 'npc_interactions', desc: '旧 NPC 动作字段，已被 npc_interactions 取代' }
  };

  /**
   * 返回一个 { fieldName: type } 的平坦 map，供 validator 使用
   * @param {string} mode - 'turn-full'（默认，回合推演）| 'dialogue'（对话模式）
   */
  function toKnownFields(mode) {
    var src = (mode === 'dialogue') ? DIALOGUE : S;
    var out = {};
    Object.keys(src).forEach(function(k){
      if (k === 'version' || k === 'lastUpdate') return;
      var meta = src[k];
      if (!meta || !meta.type || meta.deprecated) return;
      out[k] = meta.type;
    });
    return out;
  }

  /**
   * 返回已废弃字段 map
   */
  function toDeprecatedFields() {
    var out = {};
    Object.keys(S).forEach(function(k){
      var meta = S[k];
      if (meta && meta.deprecated) out[k] = meta.deprecated;
    });
    return out;
  }

  /**
   * 返回 { fieldName: ['subField1', ...] } map
   */
  function toRequiredSubfields() {
    var out = {};
    Object.keys(S).forEach(function(k){
      var meta = S[k];
      if (meta && Array.isArray(meta.requiredSubFields)) out[k] = meta.requiredSubFields;
    });
    return out;
  }

  /**
   * 查询某字段的完整元信息
   */
  function describe(fieldName) {
    return S[fieldName] || null;
  }

  /**
   * 列出所有未标 deprecated 的字段名
   */
  function listFields(mode) {
    var src = (mode === 'dialogue') ? DIALOGUE : S;
    return Object.keys(src).filter(function(k){
      if (k === 'version' || k === 'lastUpdate') return false;
      var meta = src[k];
      return meta && meta.type && !meta.deprecated;
    });
  }

  window.TM_AI_SCHEMA = {
    raw: S,
    dialogue: DIALOGUE,
    toKnownFields: toKnownFields,
    toDeprecatedFields: toDeprecatedFields,
    toRequiredSubfields: toRequiredSubfields,
    describe: describe,
    listFields: listFields
  };
})();
