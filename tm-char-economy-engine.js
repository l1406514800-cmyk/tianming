// ═══════════════════════════════════════════════════════════════
// 角色经济系统 · 核心引擎
// 设计方案：设计方案-角色经济.md（3100 行）
//
// 本文件实现：
//   - 6 资源保障：公库（只读镜像）/ 私产（5 类）/ 名望 / 贤能 / 健康 / 压力
//   - 14 类收入 / 14 类支出计算
//   - 阶层分化（8 类独立经济逻辑）
//   - 家族共财两层（core/extended）
//   - 每回合 tick（俸禄发放 + 贪腐积累 + 经营收益 + 消费 + 压力/健康动态）
//   - 抄家清算（含隐匿挖掘 + 株连）
//   - 「字」(courtesy name) 系统
// ═══════════════════════════════════════════════════════════════

(function(global) {
  'use strict';

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function safe(v, d) { return (v === undefined || v === null) ? (d || 0) : v; }

  function getMonthRatio() {
    if (typeof _getDaysPerTurn === 'function') return _getDaysPerTurn() / 30;
    return 1;
  }

  // ═════════════════════════════════════════════════════════════
  // 资源模型保障
  // ═════════════════════════════════════════════════════════════

  function ensureCharResources(ch) {
    if (!ch) return;
    if (!ch.resources) ch.resources = {};
    var r = ch.resources;

    // 1) 公库（机构绑定 · 只读镜像）—— 由地方/中央财政系统更新
    if (!r.publicTreasury) r.publicTreasury = {
      linkedPost: null,    // 绑定岗位 id
      linkedRegion: null,  // 绑定区域
      balance: 0,          // 镜像余额
      isReadOnly: true,
      handoverLog: [],     // 前任移交记录
      lastHandoverDeficit: 0
    };

    // 2) 私产（五大类）
    if (!r.privateWealth) r.privateWealth = {
      cash: 0,         // 现金（两）
      land: 0,         // 田亩（亩）
      treasure: 0,     // 珍宝/古董（两估值）
      slaves: 0,       // 奴婢/僮仆数
      commerce: 0      // 商铺/作坊（两估值）
    };
    if (!r.hiddenWealth) r.hiddenWealth = 0;  // 隐匿藏款（抄家时可能挖出）

    // 3) 名望（-100 ~ +100）
    if (r.fame === undefined) r.fame = 0;

    // 4) 贤能（六阶累积型）
    if (r.virtueMerit === undefined) r.virtueMerit = 0;  // 数值
    if (!r.virtueStage) r.virtueStage = 1;               // 1-6 阶

    // 5) 健康（0-100）
    if (ch.health === undefined) ch.health = 70 + Math.floor(Math.random() * 20);

    // 6) 压力（0-100）
    if (ch.stress === undefined) ch.stress = 20;

    // integrity（廉洁度）0-100
    if (ch.integrity === undefined) ch.integrity = 50 + Math.floor((Math.random() - 0.5) * 40);

    // 社会阶层
    if (!ch.socialClass) ch.socialClass = inferSocialClass(ch);

    // 家族
    if (!ch.family) ch.family = { clanId: null, headId: null, role: 'member' };
  }

  function inferSocialClass(ch) {
    // 根据职位 / 出身推测
    if (ch.familyTier === 'imperial' || ch.title === '太子' || ch.title === '王')   return 'imperial';
    if (ch.familyTier === 'noble' || /公|侯|伯/.test(ch.title || '')) return 'noble';
    if (ch.officialTitle && /尚书|侍郎|学士/.test(ch.officialTitle))   return 'civilOfficial';
    if (ch.officialTitle && /将军|提督|统领/.test(ch.officialTitle))   return 'militaryOfficial';
    if (/商/.test(ch.background || ''))     return 'merchant';
    if (/地主|乡绅/.test(ch.background || '')) return 'landlord';
    if (/僧|道|尼|觊/.test(ch.background || '')) return 'clergy';
    return 'commoner';
  }

  // ═════════════════════════════════════════════════════════════
  // 八大阶层参数表
  // ═════════════════════════════════════════════════════════════

  var CLASS_PARAMS = {
    imperial:     { salaryMult: 10, corruptionAccept: 0.3, prestigeDecay: 0.01, consumptionBase: 5000 },
    noble:        { salaryMult:  5, corruptionAccept: 0.4, prestigeDecay: 0.02, consumptionBase: 2000 },
    civilOfficial:{ salaryMult:  1, corruptionAccept: 0.5, prestigeDecay: 0.03, consumptionBase: 500 },
    militaryOfficial:{ salaryMult: 1.2, corruptionAccept: 0.6, prestigeDecay: 0.02, consumptionBase: 400 },
    merchant:     { salaryMult:  0, corruptionAccept: 0.7, prestigeDecay: 0.01, consumptionBase: 800, commerceYield: 0.08 },
    landlord:     { salaryMult:  0, corruptionAccept: 0.6, prestigeDecay: 0.02, consumptionBase: 500, landYield: 0.05 },
    clergy:       { salaryMult:  0.3, corruptionAccept: 0.2, prestigeDecay: 0.005, consumptionBase: 200, tributeFromFaithful: 0.3 },
    commoner:     { salaryMult:  0, corruptionAccept: 0.3, prestigeDecay: 0.04, consumptionBase: 50 }
  };

  // ═════════════════════════════════════════════════════════════
  // 14 类收入
  // ═════════════════════════════════════════════════════════════

  var Income = {
    // 1. 俸禄
    salary: function(ch) {
      if (!ch.officialTitle) return 0;
      var rank = ch.rankLevel || 5;
      var base = rank * 15;  // 每阶 15 两/月
      var classMult = (CLASS_PARAMS[ch.socialClass] || {}).salaryMult || 1;
      // 养廉银
      var reformMult = 1;
      if (GM.corruption && GM.corruption.countermeasures && GM.corruption.countermeasures.salaryReform > 0) {
        reformMult = 1 + GM.corruption.countermeasures.salaryReform * 0.5;
      }
      return base * classMult * reformMult;
    },
    // 2. 俸米
    salaryGrain: function(ch) {
      if (!ch.officialTitle) return 0;
      var rank = ch.rankLevel || 5;
      return rank * 2;  // 石/月
    },
    // 3. 赏赐
    imperialReward: function(ch) {
      // 被皇帝宠信时概率性得赏
      if (ch.isImperialFavorite && Math.random() < 0.05) return 500 + Math.random() * 5000;
      return 0;
    },
    // 4. 经营（商人/地主）
    commerce: function(ch) {
      var cls = CLASS_PARAMS[ch.socialClass] || {};
      if (cls.commerceYield) return (ch.resources.privateWealth.commerce || 0) * cls.commerceYield / 12;
      return 0;
    },
    // 5. 田租（地主）
    rent: function(ch) {
      var cls = CLASS_PARAMS[ch.socialClass] || {};
      if (cls.landYield) return (ch.resources.privateWealth.land || 0) * cls.landYield / 12;
      return 0;
    },
    // 6. 贿赂（腐败收入）
    bribes: function(ch) {
      var cls = CLASS_PARAMS[ch.socialClass] || {};
      if (!cls.corruptionAccept) return 0;
      if (!ch.officialTitle) return 0;
      // 收贿倾向 = (100 - integrity) × corruptionAccept × 机构权力
      var deptCorr = 0;
      if (GM.corruption && ch.department && GM.corruption.subDepts[ch.department]) {
        deptCorr = GM.corruption.subDepts[ch.department].true;
      }
      var rate = (100 - (ch.integrity || 50)) / 100 * cls.corruptionAccept * (deptCorr / 100) * 0.2;
      var rank = ch.rankLevel || 5;
      return rank * 30 * rate;  // 每月
    },
    // 7. 挪用（侵公）
    embezzle: function(ch) {
      if (!ch.officialTitle || ch.integrity > 50) return 0;
      var pt = ch.resources.publicTreasury;
      if (!pt || !pt.balance) return 0;
      var rate = (50 - ch.integrity) / 50 * 0.02;  // 最多 2%/月
      var amt = pt.balance * rate;
      return Math.min(amt, pt.balance * 0.05);
    },
    // 8. 勒索（下属/商人）
    extortion: function(ch) {
      if (ch.integrity > 40) return 0;
      var cls = CLASS_PARAMS[ch.socialClass] || {};
      if (cls.corruptionAccept < 0.4) return 0;
      return (ch.rankLevel || 1) * 8 * (50 - (ch.integrity||50)) / 50;
    },
    // 9. 继承
    inheritance: function(ch) {
      // 触发式：由死亡事件推入 _inheritanceThisTurn
      return safe(ch._inheritanceThisTurn, 0);
    },
    // 10. 贡物分肥（清中盐政献纳等）
    tributeShare: function(ch) {
      // 由 ceremonialPayout 推入
      return safe(ch._tributeShareThisTurn, 0);
    },
    // 11. 科举中第赏银
    examReward: function(ch) {
      return safe(ch._examRewardThisTurn, 0);
    },
    // 12. 寺院香火（僧道）
    templeDonation: function(ch) {
      var cls = CLASS_PARAMS[ch.socialClass] || {};
      if (!cls.tributeFromFaithful) return 0;
      var faithful = safe((GM.temples && GM.temples.faithful), 10000);
      return faithful * cls.tributeFromFaithful / 12 * 0.01;
    },
    // 13. 军功赏（武将）
    militaryReward: function(ch) {
      return safe(ch._militaryRewardThisTurn, 0);
    },
    // 14. 投献（族人/门生孝敬）
    personalTribute: function(ch) {
      if ((ch.rankLevel || 0) < 15) return 0;  // 高官才有
      return (ch.rankLevel || 0) * (ch.influence || 50) / 50 * 5;
    }
  };

  // ═════════════════════════════════════════════════════════════
  // 14 类支出
  // ═════════════════════════════════════════════════════════════

  var Expenses = {
    // 1. 基本生活消费
    livingCost: function(ch) {
      var cls = CLASS_PARAMS[ch.socialClass] || {};
      return (cls.consumptionBase || 100) * (1 + (ch.family ? 0.3 : 0));  // 有家庭加成
    },
    // 2. 家丁/家仆
    servants: function(ch) {
      var slaves = (ch.resources.privateWealth.slaves || 0);
      return slaves * 2;  // 月 2 两/人
    },
    // 3. 迎来送往（社交）
    socialFee: function(ch) {
      return (ch.influence || 0) * 0.5;  // 月
    },
    // 4. 宴饮
    feasts: function(ch) {
      var cls = CLASS_PARAMS[ch.socialClass] || {};
      if (cls.salaryMult > 2) return cls.consumptionBase * 0.3;
      return cls.consumptionBase * 0.1;
    },
    // 5. 宅第修缮
    estate: function(ch) {
      var land = ch.resources.privateWealth.land || 0;
      return land * 0.01;  // 亩 0.01 两/月修缮
    },
    // 6. 驭下（塞银/孝敬上司）
    patronage: function(ch) {
      if (!ch.officialTitle) return 0;
      var rank = ch.rankLevel || 1;
      return rank * 10;  // 低阶官员孝敬多
    },
    // 7. 扶亲
    clanSupport: function(ch) {
      if (!ch.family || !ch.family.clanId) return 0;
      return (ch.rankLevel || 1) * 5;
    },
    // 8. 香火供奉（宗教）
    religiousOffering: function(ch) {
      return ch.resources.privateWealth.cash > 10000 ? 20 : 5;
    },
    // 9. 教育子弟
    education: function(ch) {
      return (ch.family && ch.family.children) ? ch.family.children * 30 : 0;
    },
    // 10. 医药
    medicine: function(ch) {
      if ((ch.health || 100) < 60) return 100 + (60 - ch.health) * 10;
      return 20;
    },
    // 11. 罚款/赎罪
    fines: function(ch) {
      return safe(ch._finesThisTurn, 0);
    },
    // 12. 嫁娶丧葬
    lifeEvents: function(ch) {
      return safe(ch._lifeEventCostThisTurn, 0);
    },
    // 13. 借款利息
    debtInterest: function(ch) {
      if (!ch.resources.privateWealth.cash || ch.resources.privateWealth.cash >= 0) return 0;
      return Math.abs(ch.resources.privateWealth.cash) * 0.02;  // 2%/月
    },
    // 14. 赌博挥霍
    gambling: function(ch) {
      // traits 含"贪玩"或 stress > 70 时可能
      if ((ch.stress || 0) > 70 && Math.random() < 0.1) return 100 + Math.random() * 500;
      return 0;
    }
  };

  // ═════════════════════════════════════════════════════════════
  // 六阶贤能
  // ═════════════════════════════════════════════════════════════

  var VIRTUE_STAGES = [
    { stage: 1, name: '未识', min:   0 },
    { stage: 2, name: '有闻', min:  50 },
    { stage: 3, name: '清誉', min: 150 },
    { stage: 4, name: '儒望', min: 300 },
    { stage: 5, name: '朝宗', min: 500 },
    { stage: 6, name: '师表', min: 800 }
  ];

  function updateVirtueStage(ch) {
    var merit = ch.resources.virtueMerit || 0;
    var s = 1;
    for (var i = VIRTUE_STAGES.length - 1; i >= 0; i--) {
      if (merit >= VIRTUE_STAGES[i].min) { s = VIRTUE_STAGES[i].stage; break; }
    }
    ch.resources.virtueStage = s;
  }

  function getVirtueStageName(stage) {
    var s = VIRTUE_STAGES[(stage || 1) - 1];
    return s ? s.name : '未识';
  }

  // ═════════════════════════════════════════════════════════════
  // 月度 tick（每回合调用）
  // ═════════════════════════════════════════════════════════════

  function tickCharacter(ch, mr, fiscalCtx) {
    if (!ch) return;
    if (ch.retired || ch.dead) return;
    ensureCharResources(ch);

    var r = ch.resources;

    // ─ 收入 ─
    var totalIncome = 0;
    var incomeDetail = {};
    for (var k in Income) {
      var v = 0;
      try { v = Income[k](ch) || 0; } catch(e) { v = 0; }
      if (v !== 0) incomeDetail[k] = v * mr;
      totalIncome += v * mr;
    }

    // 贿赂/挪用→增加 integrity 下降 + 贪腐贡献
    if (incomeDetail.bribes) {
      r.privateWealth.cash += incomeDetail.bribes;
      r.hiddenWealth += incomeDetail.bribes * 0.4;  // 部分隐匿
      ch.integrity = Math.max(0, ch.integrity - 0.2 * mr);
      if (ch.department && GM.corruption && GM.corruption.subDepts[ch.department]) {
        GM.corruption.subDepts[ch.department].true = Math.min(100,
          GM.corruption.subDepts[ch.department].true + 0.02 * mr);
      }
    }
    if (incomeDetail.embezzle && r.publicTreasury) {
      r.publicTreasury.balance = Math.max(0, r.publicTreasury.balance - incomeDetail.embezzle);
      r.privateWealth.cash += incomeDetail.embezzle;
      r.hiddenWealth += incomeDetail.embezzle * 0.5;
      ch.integrity = Math.max(0, ch.integrity - 0.3 * mr);
    }
    // 正当收入入 cash
    ['salary','imperialReward','commerce','rent','inheritance','tributeShare',
     'examReward','templeDonation','militaryReward','personalTribute','extortion'].forEach(function(k) {
      if (incomeDetail[k]) r.privateWealth.cash += incomeDetail[k];
    });

    // ─ 支出 ─
    var totalExpense = 0;
    var expenseDetail = {};
    for (var e in Expenses) {
      var v2 = 0;
      try { v2 = Expenses[e](ch) || 0; } catch(err) { v2 = 0; }
      if (v2 !== 0) expenseDetail[e] = v2 * mr;
      totalExpense += v2 * mr;
    }
    r.privateWealth.cash -= totalExpense;

    // 清除本回合临时字段
    delete ch._inheritanceThisTurn;
    delete ch._tributeShareThisTurn;
    delete ch._examRewardThisTurn;
    delete ch._militaryRewardThisTurn;
    delete ch._finesThisTurn;
    delete ch._lifeEventCostThisTurn;

    // ─ 公库镜像更新（机构→角色）─
    updatePublicTreasuryMirror(ch);

    // ─ 压力 / 健康动态 ─
    tickStressHealth(ch, mr);

    // ─ 贤能积累 ─
    tickVirtueMerit(ch, mr);

    // ─ 名望衰减 ─
    tickFame(ch, mr);

    // 记录本回合流水
    ch._lastTickIncome = incomeDetail;
    ch._lastTickExpense = expenseDetail;
    ch._lastTickNet = totalIncome - totalExpense;
  }

  function updatePublicTreasuryMirror(ch) {
    var pt = ch.resources.publicTreasury;
    if (!pt || !pt.linkedRegion) return;
    // 从 GM.regions[region].publicTreasury 拿
    var regionPT = (GM.regions && GM.regions[pt.linkedRegion] && GM.regions[pt.linkedRegion].publicTreasury) || null;
    if (regionPT) {
      pt.balance = regionPT.balance;
    }
  }

  function tickStressHealth(ch, mr) {
    // 压力消长
    var stressDelta = 0;
    if (ch.officialTitle && (ch.rankLevel || 0) > 15) stressDelta += 0.3;  // 高官压力
    if (ch._recentFailures) stressDelta += ch._recentFailures * 2;
    if (ch.health < 50) stressDelta += 0.5;
    // 自然衰减
    stressDelta -= 0.4;
    // traits（压力特质 hooks）
    ch.stress = clamp((ch.stress || 20) + stressDelta * mr, 0, 100);

    // 健康
    var healthDelta = -0.1;  // 自然老化
    if (ch.age > 60) healthDelta -= 0.2;
    if (ch.age > 70) healthDelta -= 0.3;
    if (ch.stress > 70) healthDelta -= 0.3;
    if (ch.resources.privateWealth.cash > 5000) healthDelta += 0.1;  // 富贵可养身
    ch.health = clamp((ch.health || 70) + healthDelta * mr, 0, 100);

    // 健康 = 0 → 死亡
    if (ch.health <= 0 && !ch.dead) {
      triggerCharacterDeath(ch, '疾');
    }
  }

  function tickVirtueMerit(ch, mr) {
    var r = ch.resources;
    // 每月微积累（按能力 + 政绩）
    var base = 0;
    if (ch.officialTitle) base += 0.1;
    if (ch.abilities && ch.abilities.administration) base += (ch.abilities.administration - 50) / 100 * 0.3;
    if (ch.integrity > 70) base += 0.2;
    if (ch._recentAchievements) base += ch._recentAchievements * 0.5;
    r.virtueMerit = (r.virtueMerit || 0) + base * mr;
    updateVirtueStage(ch);
  }

  function tickFame(ch, mr) {
    var r = ch.resources;
    var cls = CLASS_PARAMS[ch.socialClass] || {};
    var decay = cls.prestigeDecay || 0.02;
    // 向 0 缓慢回归
    r.fame = r.fame > 0 ? Math.max(0, r.fame - decay * mr)
                        : Math.min(0, r.fame + decay * mr);
  }

  // ═════════════════════════════════════════════════════════════
  // 抄家清算
  // ═════════════════════════════════════════════════════════════

  function confiscate(ch, opts) {
    if (!ch) return { success: false, reason: '无此人' };
    opts = opts || {};
    ensureCharResources(ch);

    var r = ch.resources;
    var pw = r.privateWealth;
    var visible = (pw.cash || 0) + (pw.land || 0) * 5 + (pw.treasure || 0) + (pw.commerce || 0);
    var hiddenFound = 0;

    // 隐匿挖掘（按 opts.intensity）
    var intensity = opts.intensity || 0.5;
    hiddenFound = (r.hiddenWealth || 0) * Math.min(1, intensity);
    r.hiddenWealth -= hiddenFound;

    // 株连亲族（按 intensity 概率）
    var clanLoss = 0;
    if (opts.includeClan && ch.family && ch.family.clanId && GM.clans && GM.clans[ch.family.clanId]) {
      var clan = GM.clans[ch.family.clanId];
      clanLoss = (clan.sharedWealth || 0) * intensity * 0.5;
      clan.sharedWealth = Math.max(0, (clan.sharedWealth || 0) - clanLoss);
    }

    var total = visible + hiddenFound + clanLoss;

    // 现金清零；田产没官；slaves/treasure/commerce 估值记账
    pw.cash = 0;
    pw.land = 0;
    pw.treasure = 0;
    pw.commerce = 0;
    pw.slaves = 0;

    // 按 destination 分账（默认入内帑）
    var dest = opts.destination || 'neitang';
    if (dest === 'neitang' && GM.neitang) {
      GM.neitang.balance += total;
      GM.neitang._recentConfiscation = (GM.neitang._recentConfiscation || 0) + total;
    } else if (dest === 'guoku' && GM.guoku) {
      GM.guoku.balance += total;
    }

    // 角色状态：死/流放
    ch.retired = true;
    ch.confiscated = true;

    // 风闻
    if (typeof addEB === 'function') {
      addEB('惩罚', '抄没' + ch.name + '家产 ' + Math.round(total / 10000) + ' 万两（明 ' +
        Math.round(visible / 10000) + ' 万 · 暗 ' + Math.round(hiddenFound / 10000) + ' 万）',
        { credibility: 'high', subject: ch.id });
    }

    return {
      success: true, visible: visible, hidden: hiddenFound,
      clanLoss: clanLoss, total: total, destination: dest
    };
  }

  function triggerCharacterDeath(ch, cause) {
    ch.dead = true;
    ch.deathCause = cause;
    ch.deathTurn = GM.turn;
    // 继承（分给子嗣）
    distributeInheritance(ch);
    if (typeof addEB === 'function') {
      addEB('死亡', ch.name + '薨（' + cause + '）', { credibility: 'high', subject: ch.id });
    }
  }

  function distributeInheritance(ch) {
    if (!ch.family || !ch.family.children) return;
    var total = (ch.resources.privateWealth.cash || 0) +
                (ch.resources.privateWealth.treasure || 0);
    var heirs = ch.family.children || [];
    if (heirs.length === 0) {
      // 入内帑（无嗣财产归公）
      if (GM.neitang) GM.neitang.balance += total * 0.5;
      return;
    }
    var perHeir = total / heirs.length;
    heirs.forEach(function(heirId) {
      var heir = (GM.chars || []).find(function(c) { return c.id === heirId; });
      if (heir) heir._inheritanceThisTurn = (heir._inheritanceThisTurn || 0) + perHeir;
    });
  }

  // ═════════════════════════════════════════════════════════════
  // 「字」(courtesy name) 系统
  // ═════════════════════════════════════════════════════════════

  var COURTESY_PREFIX_POOL = [
    '伯','仲','叔','季','子','元','德','文','仁','义','礼','智','信',
    '思','希','惟','敬','承','延','宗','孝','忠','明','正','显','光',
    '茂','翰','钦','弘','谦','恭','允','懋','嘉','善','美','纯','裕'
  ];
  var COURTESY_SUFFIX_POOL = [
    '之','甫','夫','父','卿','先','允','懿','章','业','绩','轩','辅','弼',
    '达','通','逸','敏','才','俊','英','奇','杰','彦','质','朴','真','实'
  ];

  function generateCourtesyName(name, traits) {
    if (!name) return '';
    // 根据名字含义与特质匹配（简化：根据 traits 影响 prefix 选择）
    var prefer = {
      '儒': ['文','德','仁'], '武': ['武','勇','威'], '仁': ['仁','德','慈'],
      '奸': ['子','伯','仲'], '清': ['清','廉','朴']
    };
    var pref = null;
    if (traits) {
      for (var k in prefer) {
        if (traits.indexOf(k) !== -1) { pref = prefer[k]; break; }
      }
    }
    var prefix = pref ? pref[Math.floor(Math.random() * pref.length)]
                      : COURTESY_PREFIX_POOL[Math.floor(Math.random() * COURTESY_PREFIX_POOL.length)];
    var suffix = COURTESY_SUFFIX_POOL[Math.floor(Math.random() * COURTESY_SUFFIX_POOL.length)];
    return prefix + suffix;
  }

  function ensureCourtesyName(ch) {
    if (!ch) return;
    if (!ch.zi && ch.name) {
      ch.zi = generateCourtesyName(ch.name, (ch.traits || []).join(''));
    }
  }

  // 显示用称呼（按场景选名/字/官职）
  function formatAddress(ch, context) {
    if (!ch) return '';
    context = context || {};
    // 亲近 → 字
    if (context.relationship === 'intimate' || context.relationship === 'friend') {
      return ch.zi || ch.name;
    }
    // 正式 → 官职
    if (context.formal && ch.officialTitle) return ch.officialTitle;
    // 下级称上级 → 职/字
    if (context.hierarchical === 'upward') return ch.officialTitle || ch.zi || ch.name;
    // 默认名
    return ch.name;
  }

  // ═════════════════════════════════════════════════════════════
  // 主 tick（每回合调用）
  // ═════════════════════════════════════════════════════════════

  function tick(context) {
    var mr = (context && context._monthRatio) || getMonthRatio();
    if (context) context._charEconMonthRatio = mr;

    var chars = GM.chars || [];
    chars.forEach(function(ch) {
      try {
        ensureCharResources(ch);
        ensureCourtesyName(ch);
        tickCharacter(ch, mr, context);
      } catch(e) {
        console.error('[charEcon] tickCharacter:', ch && ch.name, e);
      }
    });

    // 家族共财两层
    try { tickClanPool(mr); } catch(e) { console.error('[charEcon] clanPool:', e); }
  }

  // ═════════════════════════════════════════════════════════════
  // 家族共财（两层）
  // ═════════════════════════════════════════════════════════════

  function tickClanPool(mr) {
    if (!GM.clans) return;
    Object.values(GM.clans).forEach(function(clan) {
      if (!clan.members) return;
      // 每月族人按 3% 缴纳给 clan 公共池（core family）
      var contribution = 0;
      clan.members.forEach(function(mId) {
        var m = (GM.chars || []).find(function(c) { return c.id === mId; });
        if (m && m.resources && m.resources.privateWealth && m.resources.privateWealth.cash > 100) {
          var t = m.resources.privateWealth.cash * 0.03 * mr;
          m.resources.privateWealth.cash -= t;
          contribution += t;
        }
      });
      clan.sharedWealth = (clan.sharedWealth || 0) + contribution;

      // 扶持贫困族人（bottom 20%）
      var sorted = clan.members.map(function(mId) {
        var m = (GM.chars || []).find(function(c) { return c.id === mId; });
        return m;
      }).filter(function(m) { return m && m.resources; })
        .sort(function(a, b) {
          return (a.resources.privateWealth.cash || 0) - (b.resources.privateWealth.cash || 0);
        });
      var poorCount = Math.max(1, Math.floor(sorted.length * 0.2));
      var perPoorSupport = Math.min(clan.sharedWealth * 0.1, poorCount * 100) / poorCount;
      sorted.slice(0, poorCount).forEach(function(m) {
        m.resources.privateWealth.cash += perPoorSupport;
        clan.sharedWealth -= perPoorSupport;
      });
    });
  }

  // ═════════════════════════════════════════════════════════════
  // 外部调用接口
  // ═════════════════════════════════════════════════════════════

  // 供财政系统：发俸
  function paySalary(ch, amount) {
    ensureCharResources(ch);
    ch.resources.privateWealth.cash += amount;
  }

  // 供腐败系统：贪腐入账
  function addBribeIncome(ch, amount, hiddenRatio) {
    ensureCharResources(ch);
    hiddenRatio = hiddenRatio || 0.4;
    ch.resources.privateWealth.cash += amount * (1 - hiddenRatio);
    ch.resources.hiddenWealth = (ch.resources.hiddenWealth || 0) + amount * hiddenRatio;
    ch.integrity = Math.max(0, (ch.integrity || 50) - amount / 10000 * 2);
  }

  // 名望变更
  function adjustFame(ch, delta, reason) {
    ensureCharResources(ch);
    ch.resources.fame = clamp((ch.resources.fame || 0) + delta, -100, 100);
    if (!ch._fameHistory) ch._fameHistory = [];
    ch._fameHistory.push({ turn: GM.turn, delta: delta, reason: reason });
    if (ch._fameHistory.length > 20) ch._fameHistory = ch._fameHistory.slice(-20);
  }

  // 贤能变更
  function adjustVirtueMerit(ch, delta, reason) {
    ensureCharResources(ch);
    ch.resources.virtueMerit = Math.max(0, (ch.resources.virtueMerit || 0) + delta);
    updateVirtueStage(ch);
  }

  // ═════════════════════════════════════════════════════════════
  // 导出
  // ═════════════════════════════════════════════════════════════

  global.CharEconEngine = {
    tick: tick,
    ensureCharResources: ensureCharResources,
    ensureCourtesyName: ensureCourtesyName,
    formatAddress: formatAddress,
    Income: Income,
    Expenses: Expenses,
    tickCharacter: tickCharacter,
    confiscate: confiscate,
    distributeInheritance: distributeInheritance,
    paySalary: paySalary,
    addBribeIncome: addBribeIncome,
    adjustFame: adjustFame,
    adjustVirtueMerit: adjustVirtueMerit,
    CLASS_PARAMS: CLASS_PARAMS,
    VIRTUE_STAGES: VIRTUE_STAGES,
    getVirtueStageName: getVirtueStageName,
    generateCourtesyName: generateCourtesyName,
    inferSocialClass: inferSocialClass,
    getMonthRatio: getMonthRatio
  };

  console.log('[charEcon] 引擎已加载：6 资源 + 14×14 收支 + 8 阶层 + 家族共财 + 抄家 + 字系统');

})(typeof window !== 'undefined' ? window : this);
