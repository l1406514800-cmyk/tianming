/**
 * 官方剧本：天启七年·九月（公元 1627 年 10 月）
 *
 * 历史坐标：
 *   · 天启七年八月乙卯（1627-08-22）明熹宗朱由校崩
 *   · 八月丁巳（1627-10-02）信王朱由检即皇帝位，年十七
 *   · 本剧本始于九月（十月西历），新帝登基两月，魏忠贤仍据司礼监、东厂
 *   · 客氏刚被逐出宫（九月初），阉党感受到寒意但未倒
 *   · 崇祯改元待明年元旦
 *
 * 玩家扮演：明思宗朱由检（刚即位）
 *
 * 开局戏眼：处置魏忠贤。操之过急则逼出兵变；隐忍迟延则魏党反噬；此等君心试炼。
 *
 * 数据范围：
 *   · 朝臣 20 位（阉党 / 东林党残余 / 中立老臣 / 外镇 / 宦官 / 后妃）
 *   · 外敌 3 方（后金 / 察哈尔 / 陕北流民初起）
 *   · 党派 4（阉党 / 东林党 / 浙党 / 楚党）
 *   · 阶层 5（宗室 / 士大夫 / 缙绅 / 自耕农 / 佃农与流民）
 *   · 官制 ~30 职位（内阁 / 六部 / 都察院 / 司礼监 / 锦衣卫 / 五军都督府 / 辽东督师）
 *   · 行政区划 4 省（北直隶 / 南直隶 / 陕西 / 辽东都司），关键府县下沉
 *   · 变量 12（七大核心 + 阉党权势 / 辽饷积欠 / 流民数 / 小冰河 / 党争烈度）
 *   · 事件 8（阉党寿诞 / 客氏出宫 / 毛文龙请饷 / 袁崇焕闲居 / 陕北旱象初现 等）
 */
(function (global) {
  'use strict';

  var SID = 'sc-tianqi7-1627';

  function _uid(prefix) {
    return (prefix || 'x_') + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function register() {
    if (typeof global.P === 'undefined' || !global.P || !Array.isArray(global.P.scenarios)) {
      setTimeout(register, 200);
      return;
    }
    if (global.P.scenarios.find(function (s) { return s.id === SID; })) return; // 已注册

    // ═══════════════════════════════════════════════════════════════════
    // § 1. 剧本元信息
    // ═══════════════════════════════════════════════════════════════════
    var scenario = {
      id: SID,
      name: '天启七年·九月——君王初立，权阉当国',
      era: '明末·天启朝尾',
      dynasty: '明',
      role: '明思宗·朱由检',
      tags: ['明末', '天启', '崇祯即位', '魏忠贤', '阉党', '皇帝视角', '官方'],
      active: true,
      background:
        '天启七年八月，熹宗朱由校因落水染疾崩于乾清宫，年二十三。无嗣。信王朱由检以皇弟入继大统，年十七。\n' +
        '时魏忠贤提督东厂、掌司礼监印，九千岁之称响彻天下。其党羽黄立极辅政、崔呈秀枢密、阎鸣泰督抚疆场，号"五虎、十狗、十孩儿、四十孙"。\n' +
        '东林党自天启四年"移宫案""三案"余波后被清洗殆尽——杨涟、左光斗、魏大中等死于诏狱，高攀龙自沉；硕果仅存韩爌、郭允厚遭贬而居。\n' +
        '辽东袁崇焕于宁远一役后因与阉党不合辞官归里；孙承宗督师被罢，闲居乡间。辽东实虚。\n' +
        '后金皇太极继位已一年，整顿八旗、东伐朝鲜、谋图关宁。察哈尔林丹汗西迁归化，欲与明议和共抗后金。\n' +
        '陕西久旱，民食树皮、观音土，殃变之机隐隐；宫中客氏（熹宗乳母）方被新帝逐出——此事已使阉党寒心。\n' +
        '新帝孤身入乾清宫，身边仅信邸旧侍王承恩可倚。处置九千岁，既是君心之初试，亦是国运之大考。',
      opening:
        '乾清宫帷幕尚新，熹宗梓宫停殡未久。\n' +
        '朕即位两月，朝中大半非朕旧识。黄立极、施凤来票拟日以继夜，内阁仿若九千岁外廷；东厂缇骑络绎，凡朕所问，魏忠贤先知之。\n' +
        '昨夜读天启朝诏狱旧档，杨涟"二十四大罪"一折仍触目惊心；左光斗父子骨已寒。\n' +
        '辽东王之臣告急，奏请饷银五十万。户部尚书郭允厚言太仓仅有银二百万，辽饷岁需四百万，半数仰给于加派。\n' +
        '陕西抚按告饥。司礼监却为朕奏上魏忠贤生辰贺仪，请朕加之"上公"号，号令天下立祠。\n' +
        '朕……当先观之，还是即除之？权阉在握，发之则兵变京师；姑息则东林枯骨不瞑，天下正气永沉。\n' +
        '此一年，不，此一月，将定国运。',
      winCond:
        '短期（1 年内）：妥善处置魏忠贤及阉党，不致京师兵变；起用韩爌、孙承宗、袁崇焕等贤能。\n' +
        '中期（3 年内）：辽东防线稳固，袁崇焕所设"关宁锦防线"不失；陕北民变控制在局部。\n' +
        '长期（10-17 年）：避免崇祯十七年（1644）之亡国——即使国祚不能延长一代，至少不可重蹈原史覆辙。',
      loseCond:
        '① 处置阉党失当引发京师兵变，新帝被逼退位或弑君。\n' +
        '② 辽东山海关陷落（原史应发生于崇祯十七年）。\n' +
        '③ 闯军、大西军攻入京师（原史 1644 年李自成破京）。\n' +
        '④ 内帑帑廪双绝、朝纲崩坏、党争致宰辅更替频繁失序。',
      refText:
        '【天启末至崇祯初的关键史实，供 AI 严格史实校验参考】\n' +
        '• 天启七年八月朱由校崩，朱由检以皇弟入继。\n' +
        '• 九月客氏出宫；十月阉党崔呈秀首罢。\n' +
        '• 十一月六日，魏忠贤贬凤阳守陵；六日夜闻讯于阜城，自缢死。\n' +
        '• 十二月客氏杖毙浣衣局。\n' +
        '• 崇祯元年（1628）七月袁崇焕召见平台，君臣"五年复辽"之约。\n' +
        '• 崇祯元年陕北王嘉胤、高迎祥起事；二年后金皇太极绕道蒙古破塞；三年袁崇焕下狱磔死。\n' +
        '• 崇祯末年（1644）李自成破京、帝自缢煤山。\n' +
        '【关键角色命运原史】\n' +
        '• 黄立极（阉党首辅）——崇祯元年罢归，卒于家。\n' +
        '• 韩爌（东林老臣）——召还为首辅，崇祯三年致仕。\n' +
        '• 毕自严——崇祯元年升户部尚书，理财八年有功，病卒。\n' +
        '• 袁崇焕——崇祯元年督师蓟辽，二年入援，三年磔于市。\n' +
        '• 孙承宗——崇祯二年再督蓟辽，守拱卫；清兵攻高阳，阖门殉国。\n' +
        '• 毛文龙——崇祯二年被袁崇焕矫诏斩于双岛；旋东江镇变。\n' +
        '• 魏忠贤——天启七年冬自缢；阉党次第追究。\n' +
        '• 崔呈秀——天启七年罢，自缢。\n' +
        '• 周皇后——崇祯十七年三月自缢殉国。',
      customPrompt:
        '本剧本严格以天启末崇祯初历史为依据。AI 推演应反映：\n' +
        '① 阉党倾覆的仓促与必然；\n' +
        '② 东林党复起后内部浙党楚党齐党之间的新党争；\n' +
        '③ 小冰河期（1580-1680）对北方农业的持续打击；\n' +
        '④ 后金（1636 改号清）对明的战略包围；\n' +
        '⑤ 财政——辽饷、剿饷、练饷三饷加派的恶性循环。\n' +
        '玩家为新帝朱由检，AI 不应替玩家决策阉党处置、边臣任免、加派起征等"帝王心术"事务——须通过奏疏/朝议/问对/诏令让玩家自行裁决。',
      scnStyle: '编年体',
      scnStyleRule: '仿《明实录》编年体：以月为纲，起居注为目。记君臣应对如实。',
      masterScript: '',
      refFiles: [],

      // ──── 时间/年号 ────
      gameSettings: {
        enabledSystems: { items: true, military: true, techTree: false, civicTree: false, events: true, map: true, characters: true, factions: true, classes: true, rules: true, officeTree: true },
        startYear: 1627,
        startMonth: 9,          // 九月
        startDay: 1,
        enableGanzhi: true,
        enableGanzhiDay: true,
        enableEraName: true,
        eraName: '天启',
        eraNames: [
          { name: '天启', startYear: 1621, startMonth: 1, startDay: 1 },
          { name: '崇祯', startYear: 1628, startMonth: 1, startDay: 1 }
        ],
        daysPerTurn: 30,
        turnDuration: 1,
        turnUnit: '月'
      },

      // ──── 财政配置（明代） ────
      fiscalConfig: {
        unit: { money: '两', grain: '石', cloth: '匹' },
        silverToCoin: 1000, // 明一两 = 一千文
        taxesEnabled: {
          tianfu: true, dingshui: true, caoliang: true,
          yanlizhuan: true, shipaiShui: true, quanShui: true,
          juanNa: false, qita: true
        },
        customTaxes: [
          { id: 'liaoxiang', name: '辽饷加派', formulaType: 'perMu', rate: 0.009, description: '万历四十六年始征，每亩九厘银；天启朝已翻番' }
        ],
        centralLocalRules: { preset: 'ming-qiyun-cunliu', mode: 'qiyun_cunliu' },
        floatingCollectionRate: 0.25,  // 明末胥吏浮收已达 25%
        fixedExpense: {
          salaryMonthlyPerRank: {
            '正一品': 88, '从一品': 72, '正二品': 61, '从二品': 48,
            '正三品': 35, '从三品': 26, '正四品': 24, '从四品': 21,
            '正五品': 16, '从五品': 14, '正六品': 10, '从六品': 8,
            '正七品': 7, '从七品': 6, '正八品': 6, '从八品': 5,
            '正九品': 5, '从九品': 5
          }, // 明代本俸折银（石米 × 折率），已贬值
          armyMonthlyPay: { money: 1.4, grain: 0.6, cloth: 0.05 },
          imperialMonthly: { money: 35000, grain: 8000, cloth: 2000 }
        }
      },

      // ──── 官制（简版） ────
      officeTree: buildOfficeTree(),

      // ──── 行政区划 ────
      adminHierarchy: buildAdminHierarchy(),

      // ──── 文明/政策树（空） ────
      civicTree: [],
      techTree: []
    };

    global.P.scenarios.push(scenario);

    // ═══════════════════════════════════════════════════════════════════
    // § 2. 人物（皇帝 + 后妃 + 阉党 + 东林/中立 + 外镇 + 宦官 + 外敌）
    // ═══════════════════════════════════════════════════════════════════
    var chars = [
      // ─── 皇帝本尊 ───
      {
        name: '朱由检', title: '明思宗·崇祯帝', officialTitle: '皇帝', isPlayer: true, isRoyal: true, alive: true,
        age: 17, gender: '男', personality: '多疑·刚愎·勤政·急切',
        loyalty: 100, ambition: 88, intelligence: 78, valor: 55, benevolence: 50, morale: 70,
        administration: 62, management: 58, learning: 76, integrity: 82,
        stance: '中兴之主', faction: '明朝廷', party: '', family: '朱氏·明',
        bio: '明熹宗朱由校之弟，封信王就藩京师未果。天启七年八月即位，刚烈而猜忌，急于有为。'
      },
      // ─── 后妃 ───
      {
        name: '周皇后', title: '皇后', officialTitle: '皇后', isRoyal: true, alive: true,
        age: 16, gender: '女', personality: '贤淑·节俭·有胆识', spouse: '朱由检',
        loyalty: 100, ambition: 20, intelligence: 72, benevolence: 85, morale: 75, integrity: 90,
        stance: '贤后', faction: '明朝廷', party: '', family: '周氏',
        bio: '信邸正妃，苏州人，出身寒微。贤明节俭，与崇祯同甘共苦。原史崇祯十七年三月自缢。'
      },
      {
        name: '张懿安', title: '懿安皇后·皇嫂', officialTitle: '皇嫂·懿安皇后', isRoyal: true, alive: true,
        age: 22, gender: '女', personality: '端庄·刚正·反阉', spouse: '朱由校(殁)',
        loyalty: 90, ambition: 30, intelligence: 80, benevolence: 80, morale: 65, integrity: 95,
        stance: '清流', faction: '明朝廷', party: '东林党', family: '张氏',
        bio: '熹宗皇后。素恶魏忠贤与客氏，多次劝熹宗除阉。新帝即位，可咨其计。'
      },
      // ─── 阉党——九千岁集团 ───
      {
        name: '魏忠贤', title: '司礼监掌印·东厂提督·上公', officialTitle: '司礼监掌印太监·提督东厂', alive: true,
        age: 59, gender: '男', personality: '阴狠·贪权·好谄·擅专', location: '京师',
        loyalty: 10, ambition: 95, intelligence: 70, valor: 40, benevolence: 5, morale: 55,
        administration: 62, management: 78, learning: 20, integrity: 5,
        stance: '权阉', faction: '明朝廷', party: '阉党', family: '魏氏',
        traits: ['deceitful', 'ambitious', 'cruel', 'gregarious'],
        bio: '肃宁人。进宫充饷，曾为街头无赖。附魏朝、客氏以进，天启三年掌司礼监。号九千岁，建生祠遍天下。'
      },
      {
        name: '崔呈秀', title: '兵部尚书·总督京营戎政', officialTitle: '兵部尚书', alive: true,
        age: 45, gender: '男', personality: '阴鸷·党附·贪墨', location: '京师',
        loyalty: 20, ambition: 85, intelligence: 68, valor: 45, benevolence: 10,
        administration: 58, integrity: 10,
        stance: '阉党鹰犬', faction: '明朝廷', party: '阉党', family: '崔氏',
        traits: ['deceitful', 'ambitious', 'corrupt'],
        bio: '蓟州人。魏忠贤义子，为阉党"五虎"之首。原史天启七年十月罢官，十一月自缢。'
      },
      {
        name: '黄立极', title: '内阁首辅·建极殿大学士', officialTitle: '内阁首辅·建极殿大学士', alive: true,
        age: 59, gender: '男', personality: '谨小·附势·无骨', location: '京师',
        loyalty: 30, ambition: 40, intelligence: 65, benevolence: 40,
        administration: 55, integrity: 20,
        stance: '阉党文臣', faction: '明朝廷', party: '阉党', family: '黄氏',
        bio: '河南元氏人。万历三十二年进士。天启六年入阁。票拟多秉魏忠贤意。'
      },
      {
        name: '施凤来', title: '文华殿大学士', officialTitle: '文华殿大学士', alive: true,
        age: 63, gender: '男', personality: '圆滑·附势·工诗', location: '京师',
        loyalty: 35, ambition: 35, intelligence: 62, integrity: 25,
        stance: '阉党文臣', faction: '明朝廷', party: '阉党', family: '施氏',
        bio: '浙江平湖人。天启六年入阁。阉党"外相"之一。'
      },
      {
        name: '冯铨', title: '武英殿大学士', officialTitle: '武英殿大学士', alive: true,
        age: 32, gender: '男', personality: '圆滑·多才·奸巧', location: '京师',
        loyalty: 30, ambition: 70, intelligence: 78, integrity: 15,
        stance: '阉党文臣', faction: '明朝廷', party: '阉党', family: '冯氏',
        bio: '涿州人。年少以献媚魏忠贤骤进。'
      },
      // ─── 东林党残余 / 中立老臣 ───
      {
        name: '韩爌', title: '前礼部尚书·东阁大学士（罢归）', officialTitle: '东阁大学士（已罢居乡）', alive: true,
        age: 63, gender: '男', personality: '稳重·公正·老成', location: '山西蒲州',
        loyalty: 85, ambition: 30, intelligence: 80, benevolence: 80,
        administration: 78, integrity: 90,
        stance: '东林老臣', faction: '明朝廷', party: '东林党', family: '韩氏',
        traits: ['honest', 'patient'],
        bio: '山西蒲州人。万历二十年进士。天启四年被阉党构陷罢归。原史崇祯元年召还为首辅。'
      },
      {
        name: '钱龙锡', title: '前礼部右侍郎（罢归）', officialTitle: '礼部右侍郎（已罢）', alive: true,
        age: 48, gender: '男', personality: '清俊·持正·稍弱', location: '南直隶华亭',
        loyalty: 80, ambition: 35, intelligence: 75, integrity: 82,
        stance: '东林', faction: '明朝廷', party: '东林党', family: '钱氏',
        bio: '松江华亭人。万历三十五年进士。东林干将，天启五年被贬。'
      },
      {
        name: '郭允厚', title: '户部尚书', officialTitle: '户部尚书', alive: true,
        age: 55, gender: '男', personality: '精明·刻板·理财', location: '京师',
        loyalty: 70, ambition: 40, intelligence: 82, administration: 85, integrity: 75,
        stance: '中立理财', faction: '明朝廷', party: '', family: '郭氏',
        bio: '山东福山人。万历二十六年进士。管钱粮八年，心力交瘁。'
      },
      {
        name: '毕自严', title: '南京户部尚书', officialTitle: '南京户部尚书', alive: true,
        age: 58, gender: '男', personality: '忠谨·明练·善理财', location: '南京',
        loyalty: 85, ambition: 40, intelligence: 85, administration: 88, integrity: 88,
        stance: '能吏', faction: '明朝廷', party: '', family: '毕氏',
        traits: ['honest', 'industrious'],
        bio: '山东淄川人。万历二十年进士。善度支。原史崇祯元年召入掌户部，支撑危局八年。'
      },
      {
        name: '王在晋', title: '南京兵部尚书', officialTitle: '南京兵部尚书', alive: true,
        age: 62, gender: '男', personality: '谨慎·保守·稳妥', location: '南京',
        loyalty: 75, ambition: 40, intelligence: 70, administration: 72, integrity: 75,
        stance: '保守主守派', faction: '明朝廷', party: '', family: '王氏',
        bio: '江苏太仓人。万历二十年进士。主张"弃宁锦守山海"——与孙承宗主战派不合。'
      },
      // ─── 辽东/外镇将帅（现多闲居或已调离） ───
      {
        name: '袁崇焕', title: '前辽东巡抚（闲居）', officialTitle: '辽东巡抚（已丁忧归乡）', alive: true,
        age: 43, gender: '男', personality: '刚烈·自负·有谋·急进', location: '广东东莞',
        loyalty: 82, ambition: 72, intelligence: 82, valor: 78, benevolence: 60,
        administration: 76, management: 75, integrity: 80,
        stance: '主战复辽', faction: '明朝廷', party: '', family: '袁氏',
        traits: ['ambitious', 'brave', 'prideful'],
        bio: '广东东莞人。万历四十七年进士。天启六年宁远大捷，次年因与阉党龃龉告归。原史崇祯元年召见平台，"五年复辽"之约。'
      },
      {
        name: '孙承宗', title: '前辽东督师（闲居）', officialTitle: '辽东督师（已罢归）', alive: true,
        age: 65, gender: '男', personality: '沉稳·老成·谋国', location: '保定高阳',
        loyalty: 95, ambition: 20, intelligence: 88, valor: 72, benevolence: 80,
        administration: 88, management: 82, integrity: 95,
        stance: '主战稳守', faction: '明朝廷', party: '', family: '孙氏',
        traits: ['honest', 'patient', 'loyal'],
        bio: '北直隶高阳人。万历三十二年进士。天启二年督师蓟辽，筑关宁防线。被阉党排挤，天启五年罢。'
      },
      {
        name: '毛文龙', title: '东江总兵·左都督', officialTitle: '左都督·东江总兵', alive: true,
        age: 51, gender: '男', personality: '骄横·能战·跋扈·取巧', location: '皮岛',
        loyalty: 55, ambition: 75, intelligence: 65, valor: 78, benevolence: 35,
        administration: 45, integrity: 30,
        stance: '东江镇军头', faction: '明朝廷', party: '', family: '毛氏',
        traits: ['ambitious', 'cruel', 'gregarious'],
        bio: '浙江仁和人。天启元年袭据镇江，开东江镇于皮岛，屡扰后金后方。跋扈自雄，开销无度。'
      },
      {
        name: '满桂', title: '宁远总兵', officialTitle: '宁远总兵·右都督', alive: true,
        age: 43, gender: '男', personality: '骁勇·暴躁·不识字', location: '宁远',
        loyalty: 80, ambition: 50, intelligence: 55, valor: 88, benevolence: 50,
        integrity: 70,
        stance: '蒙古裔骁将', faction: '明朝廷', party: '', family: '满氏',
        traits: ['brave', 'choleric'],
        bio: '蒙古人。行伍出身。宁远大战与袁崇焕同守城。'
      },
      {
        name: '赵率教', title: '山海关总兵', officialTitle: '山海关总兵·左都督', alive: true,
        age: 58, gender: '男', personality: '勇毅·重义·沉练', location: '山海关',
        loyalty: 88, ambition: 40, intelligence: 65, valor: 82, benevolence: 68,
        integrity: 80,
        stance: '关宁骁将', faction: '明朝廷', party: '', family: '赵氏',
        traits: ['brave', 'loyal'],
        bio: '陕西靖虏卫人。袁崇焕旧部。原史崇祯二年战死遵化。'
      },
      // ─── 内侍 ───
      {
        name: '王承恩', title: '内侍太监', officialTitle: '乾清宫近侍', alive: true,
        age: 42, gender: '男', personality: '忠贞·沉稳·识大体', location: '乾清宫',
        loyalty: 100, ambition: 15, intelligence: 68, benevolence: 70, integrity: 95,
        stance: '帝之心腹', faction: '明朝廷', party: '', family: '王氏',
        traits: ['honest', 'loyal'],
        bio: '信邸旧侍。朱由检入继大统后倚为耳目。原史崇祯十七年随帝自缢煤山。'
      },
      {
        name: '曹化淳', title: '司礼监秉笔·东厂掌刑', officialTitle: '司礼监秉笔太监', alive: true,
        age: 38, gender: '男', personality: '精明·善迎合·首鼠两端', location: '司礼监',
        loyalty: 55, ambition: 55, intelligence: 75, benevolence: 50, integrity: 40,
        stance: '骑墙宦官', faction: '明朝廷', party: '', family: '曹氏',
        bio: '天津武清人。王安旧徒，后归魏忠贤。新帝即位后转倚周后一脉，原史得重用。'
      },
      // ─── 外敌 ───
      {
        name: '皇太极', title: '后金天聪汗', officialTitle: '后金汗', alive: true,
        age: 35, gender: '男', personality: '深沉·多谋·隐忍·野心', location: '沈阳',
        loyalty: 100, ambition: 98, intelligence: 92, valor: 82, benevolence: 55,
        administration: 85, management: 88, integrity: 70,
        stance: '后金主', faction: '后金', party: '', family: '爱新觉罗',
        traits: ['ambitious', 'patient', 'strategic'],
        bio: '努尔哈赤第八子。天命十一年（1626）继位。天聪元年（1627）伐朝鲜，定江都盟。'
      },
      {
        name: '林丹汗', title: '察哈尔可汗', officialTitle: '蒙古大汗', alive: true,
        age: 35, gender: '男', personality: '骄矜·急躁·黄教狂热', location: '归化城',
        loyalty: 100, ambition: 80, intelligence: 65, valor: 70, benevolence: 40,
        stance: '蒙古共主(名存实亡)', faction: '察哈尔', party: '', family: '孛儿只斤',
        bio: '元裔。欲统合漠南蒙古对抗后金。天启七年方西迁归化，与明结"旧怨新盟"。'
      },
      {
        name: '王嘉胤', title: '流民魁首(将起)', officialTitle: '', alive: true,
        age: 42, gender: '男', personality: '豪猛·不学·能聚众', location: '陕西府谷',
        loyalty: 10, ambition: 72, intelligence: 45, valor: 78, benevolence: 50,
        stance: '流民首', faction: '陕北饥民', party: '', family: '王氏',
        bio: '陕西府谷人。明边军逃兵。原史崇祯元年起事，为陕北民变第一把火。'
      }
    ];
    chars.forEach(function (c) { c.sid = SID; c.id = _uid('char_'); global.P.characters.push(c); });

    // ═══════════════════════════════════════════════════════════════════
    // § 3. 势力
    // ═══════════════════════════════════════════════════════════════════
    var facs = [
      {
        name: '明朝廷', leader: '朱由检', color: '#c9a84c', strength: 70,
        territory: '两京十三省+辽东都司+贵州土司', ideology: '礼法·儒教·天下共主',
        desc: '大明享国二百六十年。本朝神宗怠政后，政局每况愈下。熹宗末年阉党专擅，士林溃散。新帝立，国本未定。',
        traits: ['儒教', '天朝', '大一统']
      },
      {
        name: '后金', leader: '皇太极', color: '#6a4c93', strength: 58,
        territory: '辽东沈阳·赫图阿拉', ideology: '萨满·汗权·八旗',
        desc: '努尔哈赤称汗于天命元年（1616）。取辽沈、破广宁。皇太极继位改革政制，将成大患。',
        traits: ['八旗劲旅', '渔猎游牧', '多民族']
      },
      {
        name: '察哈尔', leader: '林丹汗', color: '#8b4513', strength: 35,
        territory: '漠南蒙古·归化城', ideology: '藏传佛教·蒙古正统',
        desc: '元裔，名义漠南蒙古共主。屡败于后金，西迁归化。欲与明结盟。',
        traits: ['骑射', '游牧']
      },
      {
        name: '陕北饥民', leader: '王嘉胤', color: '#7a4e3b', strength: 8,
        territory: '陕西延安府·榆林', ideology: '求活',
        desc: '连年大旱，赋重饷严，逃兵饥民聚啸成伙。今秋尚未成势，一二年内将燎原。',
        traits: ['饥民', '逃兵']
      }
    ];
    facs.forEach(function (f) { f.sid = SID; f.id = _uid('fac_'); global.P.factions.push(f); });

    // ═══════════════════════════════════════════════════════════════════
    // § 4. 党派
    // ═══════════════════════════════════════════════════════════════════
    var parties = [
      { name: '阉党', desc: '魏忠贤党羽集团。崔呈秀为"五虎"，田尔耕、许显纯为"五彪"。占据内阁、六部、都察院。', influence: 85, satisfaction: 60, leader: '魏忠贤' },
      { name: '东林党', desc: '无锡东林书院讲学起家。主清议、重吏治。天启朝被阉党诏狱几尽。幸存者多贬居乡里。', influence: 15, satisfaction: 20, leader: '韩爌' },
      { name: '浙党', desc: '浙江籍京官为核心的同乡派系。万历末与东林党抗衡。天启朝附阉党者多。', influence: 35, satisfaction: 50, leader: '施凤来' },
      { name: '楚党', desc: '湖广籍官员同乡派系。万历三十年前后称盛。今已分化归入阉党或中立。', influence: 15, satisfaction: 40, leader: '官应震' }
    ];
    parties.forEach(function (p) { p.sid = SID; p.id = _uid('pty_'); global.P.parties.push(p); });

    // ═══════════════════════════════════════════════════════════════════
    // § 5. 阶层
    // ═══════════════════════════════════════════════════════════════════
    var classes = [
      { name: '宗室', desc: '朱氏皇族及分封藩王，宗禄岁耗内帑内殿数百万两。', privileges: '封爵·俸禄·不服役', restrictions: '不得干政·不许出封地', population: '约 20 万', influence: 40, satisfaction: 55 },
      { name: '士大夫', desc: '科举出身的读书人与官吏。儒学正统承载者。', privileges: '免徭役·免杂税·特典', restrictions: '须遵儒礼', population: '约 50 万', influence: 85, satisfaction: 35 },
      { name: '缙绅', desc: '地方乡绅。土地所有者，包揽赋税，掌控乡村。', privileges: '免徭役·包揽赋税·操纵里甲', restrictions: '须遵礼法', population: '约 300 万', influence: 70, satisfaction: 60 },
      { name: '自耕农', desc: '拥有小块土地的农户。赋役最重，最易破产。', privileges: '编户齐民', restrictions: '田赋·徭役·丁银', population: '约 3000 万', influence: 25, satisfaction: 30 },
      { name: '佃农与流民', desc: '无地租种、或失地流亡。小冰河期与辽饷加派下急速膨胀。', privileges: '无', restrictions: '受缙绅盘剥', population: '约 5000 万', influence: 10, satisfaction: 12 }
    ];
    classes.forEach(function (c) { c.sid = SID; c.id = _uid('cls_'); global.P.classes.push(c); });

    // ═══════════════════════════════════════════════════════════════════
    // § 6. 变量
    // ═══════════════════════════════════════════════════════════════════
    var variables = [
      // 七大核心（与顶栏对应）
      { name: '国库资金', value: 2000000, min: 0, max: 50000000, unit: '两', isCore: true, cat: '财政', desc: '太仓银库现银。天启末已近枯竭。' },
      { name: '皇威', value: 50, min: 0, max: 100, isCore: true, cat: '皇威', desc: '新帝登基，气象未立。' },
      { name: '皇权', value: 35, min: 0, max: 100, isCore: true, cat: '皇权', desc: '阉党当国，新帝政令出宫不远。' },
      { name: '民心', value: 42, min: 0, max: 100, isCore: true, cat: '民心', desc: '士林失望久矣；北方饥馑初现。' },
      { name: '人口', value: 150000000, min: 0, max: 300000000, unit: '口', isCore: true, cat: '户口', desc: '明末户口峰值约一亿五千万（含隐户）。' },
      { name: '全局腐败', value: 68, min: 0, max: 100, isCore: true, cat: '腐败', desc: '阉党卖官鬻爵，天启朝腐败登峰。', inversed: true },
      { name: '环境承载力', value: 55, min: 0, max: 100, isCore: true, cat: '环境', desc: '小冰河期持续，黄河淮河水患连年。' },
      // 朝代专属
      { name: '阉党权势值', value: 90, min: 0, max: 100, cat: '党派', desc: '魏忠贤集团的朝堂支配度。超 50 即摆脱不了其掣肘。', inversed: true },
      { name: '东林党复苏进度', value: 5, min: 0, max: 100, cat: '党派', desc: '东林骨干归朝与重开书院的进度。' },
      { name: '辽饷积欠', value: 180, min: 0, max: 500, unit: '万两', cat: '财政', desc: '辽东欠饷累计。士兵哗变风险随此增。', inversed: true },
      { name: '流民数量', value: 800000, min: 0, max: 50000000, unit: '口', cat: '民生', desc: '北直隶/陕西/山东流民估数。', inversed: true },
      { name: '小冰河凛冬指数', value: 65, min: 0, max: 100, cat: '环境', desc: '1627 冬寒已异常。指数高则歉收、疫病、民变。', inversed: true },
      { name: '党争烈度', value: 55, min: 0, max: 100, cat: '党派', desc: '党争仍以阉党打压东林残余为主，日后东林反扑会更烈。', inversed: true },
      { name: '宦官干政度', value: 82, min: 0, max: 100, cat: '皇权', desc: '司礼监批红权直追内阁票拟。', inversed: true },
      { name: '辽东防线稳固度', value: 48, min: 0, max: 100, cat: '军事', desc: '袁崇焕去后，辽东经略未定。' },
      { name: '太仓银储量', value: 15, min: 0, max: 100, cat: '财政', desc: '太仓库银占"岁入基准"的比例。' },
      { name: '西北灾荒怨气', value: 70, min: 0, max: 100, cat: '民生', desc: '陕北已三年大旱，怨气积聚。', inversed: true },
      { name: '漕运通畅度', value: 62, min: 0, max: 100, cat: '经济', desc: '京杭大运河江南至通州段。' }
    ];
    variables.forEach(function (v) { v.sid = SID; v.id = _uid('var_'); v.color = '#c9a84c'; v.icon = ''; v.visible = true; global.P.variables.push(v); });

    // ═══════════════════════════════════════════════════════════════════
    // § 7. 开局事件
    // ═══════════════════════════════════════════════════════════════════
    var events = [
      {
        name: '阉党请加魏忠贤上公号',
        narrative: '黄立极率内阁阉党诸员，联名请加魏忠贤"上公"之号，请陛下旨意天下立生祠、免其跪拜。',
        triggerTurn: 1, oneTime: true,
        choices: [
          { text: '准。(示弱以观其变)', effect: { '皇威': -5, '阉党权势值': +3, '皇权': -2 } },
          { text: '驳。此非臣下所当议。', effect: { '皇威': +3, '阉党权势值': -2, '党争烈度': +3 } },
          { text: '留中不发。', effect: {} }
        ]
      },
      {
        name: '客氏遣出宫外',
        narrative: '熹宗乳母客氏，阉党内援。陛下即位后诏命出宫。此举已令魏忠贤闻风胆寒。内廷已非九千岁家天下。',
        triggerTurn: 1, oneTime: true,
        choices: [{ text: '诏命已下。', effect: { '皇威': +5, '阉党权势值': -5, '宦官干政度': -4 } }]
      },
      {
        name: '户部告急：辽饷无出',
        narrative: '户部尚书郭允厚奏：太仓现银二百万，辽饷岁需四百万，九边合计岁支八百万。如此缺口，非加派不能补。',
        triggerTurn: 2, oneTime: true,
        choices: [
          { text: '准加派辽饷。(饮鸩止渴)', effect: { '国库资金': +800000, '民心': -5, '流民数量': +100000, '辽饷积欠': -20 } },
          { text: '先发内帑五十万济急。', effect: { '国库资金': +500000, '皇威': +5, '阉党权势值': -2 } },
          { text: '发廷议。令百官各抒己见。', effect: { '党争烈度': +5 } }
        ]
      },
      {
        name: '东江毛文龙请饷十五万',
        narrative: '东江总兵毛文龙奏：皮岛孤悬海外，兵十万需饷。然朝廷查实其兵不过三万。如何处？',
        triggerTurn: 2, oneTime: true,
        choices: [
          { text: '如数拨饷。', effect: { '国库资金': -150000, '辽东防线稳固度': +2 } },
          { text: '按实数拨饷五万。', effect: { '国库资金': -50000, '辽东防线稳固度': +1 } },
          { text: '遣科道查实。', effect: { '全局腐败': -3 } }
        ]
      },
      {
        name: '陕西抚按奏饥',
        narrative: '陕西巡抚胡廷宴、三边总督武之望联名奏：陕北延安、榆林三年大旱，民食观音土，饥民逃亡者十万。赈之则无银，不赈则必为盗。',
        triggerTurn: 3, oneTime: true,
        choices: [
          { text: '拨内帑十万赈之。', effect: { '国库资金': -100000, '西北灾荒怨气': -10, '民心': +4 } },
          { text: '免陕西本年田赋。', effect: { '国库资金': -300000, '西北灾荒怨气': -15, '民心': +6 } },
          { text: '令地方自赈。', effect: { '西北灾荒怨气': +8, '流民数量': +200000 } }
        ]
      },
      {
        name: '皇嫂张懿安密进言',
        narrative: '懿安皇后密召于坤宁宫：魏忠贤当速除。若过冬，则其党羽在京营军、在东厂、在各镇皆已定盘，发难必败。',
        triggerTurn: 1, oneTime: true,
        choices: [
          { text: '速图之。', effect: { '阉党权势值': -3, '党争烈度': +10 } },
          { text: '姑徐之，观其势。', effect: { '皇权': -2 } }
        ]
      },
      {
        name: '御史钱嘉徵劾魏忠贤十大罪',
        narrative: '贡士钱嘉徵上疏，劾魏忠贤十大罪：并帝、蔑后、弄兵、无二祖列宗、克削藩封、无圣、滥爵、掩边功、朘民、通关节。',
        triggerTurn: 4, oneTime: true,
        choices: [
          { text: '留中不发。', effect: { '党争烈度': +3 } },
          { text: '召魏忠贤面质十罪。', effect: { '皇威': +10, '阉党权势值': -15, '皇权': +5 } },
          { text: '黜钱嘉徵以安魏忠贤。', effect: { '皇威': -10, '党争烈度': -5, '民心': -5 } }
        ]
      },
      {
        name: '皇太极遣使议和',
        narrative: '后金汗皇太极遣方金纳来书：欲约兄弟之国，岁输银帛，互开马市。此书字迹倨傲，称明为"南朝"。',
        triggerTurn: 5, oneTime: true,
        choices: [
          { text: '斩使以示天威。', effect: { '皇威': +5, '辽东防线稳固度': -3 } },
          { text: '扣使观望。', effect: {} },
          { text: '许岁币暂缓辽事。', effect: { '国库资金': -200000, '辽东防线稳固度': +5, '皇威': -8 } }
        ]
      }
    ];
    events.forEach(function (e) { e.sid = SID; e.id = _uid('evt_'); e.triggered = false; e.type = 'scripted'; global.P.events.push(e); });

    console.log('[scenario] 天启七年·九月 已注册 (sid=' + SID + ')');
  }

  // ═══════════════════════════════════════════════════════════════════
  // § 官制树——内阁 / 六部 / 都察院 / 司礼监 / 锦衣卫 / 五军都督府
  // ═══════════════════════════════════════════════════════════════════
  function buildOfficeTree() {
    return [
      {
        id: _uid('off_'), name: '内阁', desc: '正五品大学士，然票拟天下事，实掌相权',
        positions: [
          { name: '首辅·建极殿大学士', rank: '正五品', holder: '黄立极', establishedCount: 1, vacancyCount: 0, authority: 'decision', succession: 'appointment', duties: '总摄票拟，调和阴阳。实际朝政之枢。', publicTreasuryInit: { money: 0, grain: 0, cloth: 0, quotaMoney: 0, quotaGrain: 0, quotaCloth: 0 }, bindingHint: 'ministry', privateIncome: { bonusType: '恩赏', illicitRisk: 'medium' }, powers: { appointment: true, impeach: true, supervise: false } },
          { name: '次辅·文华殿大学士', rank: '正五品', holder: '施凤来', establishedCount: 1, vacancyCount: 0, authority: 'decision', succession: 'appointment', duties: '辅佐首辅，分理庶政。' },
          { name: '武英殿大学士', rank: '正五品', holder: '冯铨', establishedCount: 1, vacancyCount: 0, authority: 'execution', succession: 'appointment', duties: '入值文渊，参与票拟。' },
          { name: '东阁大学士(缺)', rank: '正五品', holder: '', establishedCount: 2, vacancyCount: 2, authority: 'execution', succession: 'appointment', duties: '储相之位，常由东阁调用。目前空缺。' }
        ],
        subs: []
      },
      {
        id: _uid('off_'), name: '吏部', desc: '天官。掌铨选、考课、封爵',
        positions: [
          { name: '吏部尚书', rank: '正二品', holder: '王绍徽', establishedCount: 1, vacancyCount: 0, authority: 'decision', succession: 'appointment', duties: '掌文选考课。阉党王绍徽在任，以《东林点将录》为进身之阶。', publicTreasuryInit: { money: 50000, grain: 0, cloth: 0 }, bindingHint: 'ministry', powers: { appointment: true } },
          { name: '左侍郎', rank: '正三品', holder: '', establishedCount: 1, vacancyCount: 1 },
          { name: '右侍郎', rank: '正三品', holder: '', establishedCount: 1, vacancyCount: 1 }
        ],
        subs: []
      },
      {
        id: _uid('off_'), name: '户部', desc: '地官。掌户口、田赋、钱粮',
        positions: [
          { name: '户部尚书', rank: '正二品', holder: '郭允厚', establishedCount: 1, vacancyCount: 0, authority: 'decision', succession: 'appointment', duties: '掌天下钱粮。太仓银库出纳总纲。', publicTreasuryInit: { money: 2000000, grain: 5000000, cloth: 100000, quotaMoney: 8000000, quotaGrain: 20000000, quotaCloth: 500000 }, bindingHint: 'ministry', powers: { taxCollect: true } },
          { name: '左侍郎', rank: '正三品', holder: '', establishedCount: 1, vacancyCount: 1 },
          { name: '右侍郎·总督仓场', rank: '正三品', holder: '', establishedCount: 1, vacancyCount: 1, duties: '驻通州，掌京通十三仓。' }
        ],
        subs: []
      },
      {
        id: _uid('off_'), name: '礼部', desc: '春官。掌礼仪祭祀、科举、外藩',
        positions: [
          { name: '礼部尚书', rank: '正二品', holder: '来宗道', establishedCount: 1, vacancyCount: 0, authority: 'decision' },
          { name: '左侍郎', rank: '正三品', holder: '', establishedCount: 1, vacancyCount: 1 }
        ],
        subs: []
      },
      {
        id: _uid('off_'), name: '兵部', desc: '夏官。掌武选、武职、边防',
        positions: [
          { name: '兵部尚书', rank: '正二品', holder: '崔呈秀', establishedCount: 1, vacancyCount: 0, authority: 'decision', duties: '总督京营戎政。阉党之鹰犬。', publicTreasuryInit: { money: 500000, grain: 1000000, cloth: 50000, quotaMoney: 5000000, quotaGrain: 10000000 }, bindingHint: 'military', privateIncome: { illicitRisk: 'high' }, powers: { militaryCommand: true } },
          { name: '左侍郎', rank: '正三品', holder: '', establishedCount: 1, vacancyCount: 1 }
        ],
        subs: []
      },
      {
        id: _uid('off_'), name: '刑部', desc: '秋官。掌刑名、审录',
        positions: [
          { name: '刑部尚书', rank: '正二品', holder: '薛贞', establishedCount: 1, vacancyCount: 0, authority: 'decision' }
        ],
        subs: []
      },
      {
        id: _uid('off_'), name: '工部', desc: '冬官。掌营造、工役',
        positions: [
          { name: '工部尚书', rank: '正二品', holder: '薛凤翔', establishedCount: 1, vacancyCount: 0, authority: 'decision' }
        ],
        subs: []
      },
      {
        id: _uid('off_'), name: '都察院', desc: '掌风宪，监察百官',
        positions: [
          { name: '左都御史', rank: '正二品', holder: '贾继春', establishedCount: 1, vacancyCount: 0, authority: 'supervision', powers: { impeach: true, supervise: true } },
          { name: '右都御史', rank: '正二品', holder: '', establishedCount: 1, vacancyCount: 1 },
          { name: '十三道监察御史', rank: '正七品', holder: '', establishedCount: 110, vacancyCount: 20, authority: 'supervision', duties: '按道分察各省官员与吏治。', powers: { impeach: true } }
        ],
        subs: []
      },
      {
        id: _uid('off_'), name: '司礼监', desc: '内廷宦官首衙。掌御前批红',
        positions: [
          { name: '掌印太监·提督东厂·上公', rank: '正四品', holder: '魏忠贤', establishedCount: 1, vacancyCount: 0, authority: 'decision', succession: 'appointment', duties: '内廷首宦。批红盖印，直达天听。兼提督东厂。', publicTreasuryInit: { money: 3000000, grain: 100000, cloth: 50000 }, bindingHint: 'imperial', privateIncome: { illicitRisk: 'high' }, powers: { appointment: true, impeach: true, supervise: true } },
          { name: '秉笔太监·东厂掌刑', rank: '从四品', holder: '曹化淳', establishedCount: 4, vacancyCount: 0, authority: 'execution', duties: '代帝批红奏疏。' },
          { name: '随堂太监', rank: '从四品', holder: '', establishedCount: 8, vacancyCount: 3 }
        ],
        subs: []
      },
      {
        id: _uid('off_'), name: '锦衣卫', desc: '天子亲军二十六卫之首。掌侍卫、缉察、诏狱',
        positions: [
          { name: '指挥使', rank: '正三品', holder: '田尔耕', establishedCount: 1, vacancyCount: 0, authority: 'execution', duties: '阉党"五彪"之首。掌诏狱。', publicTreasuryInit: { money: 200000, grain: 0, cloth: 0 }, bindingHint: 'imperial', privateIncome: { illicitRisk: 'high' }, powers: { impeach: true, supervise: true } },
          { name: '北镇抚使·专理诏狱', rank: '正四品', holder: '许显纯', establishedCount: 1, vacancyCount: 0, duties: '阉党"五彪"之一。天启中诛杀东林六君子之手。' }
        ],
        subs: []
      },
      {
        id: _uid('off_'), name: '五军都督府', desc: '中·左·右·前·后 五都督',
        positions: [
          { name: '中军都督', rank: '正一品', holder: '', establishedCount: 1, vacancyCount: 1 },
          { name: '左军都督', rank: '正一品', holder: '赵率教', establishedCount: 1, vacancyCount: 0, duties: '兼山海关总兵。' },
          { name: '右军都督', rank: '正一品', holder: '满桂', establishedCount: 1, vacancyCount: 0, duties: '兼宁远总兵。' },
          { name: '前军都督·东江总兵', rank: '正一品', holder: '毛文龙', establishedCount: 1, vacancyCount: 0, duties: '驻皮岛，扰后金后方。', publicTreasuryInit: { money: 50000, grain: 200000, cloth: 20000 }, bindingHint: 'military', privateIncome: { illicitRisk: 'high' } },
          { name: '后军都督', rank: '正一品', holder: '', establishedCount: 1, vacancyCount: 1 }
        ],
        subs: []
      },
      {
        id: _uid('off_'), name: '翰林院·詹事府', desc: '清要之衙。儲相养望之地',
        positions: [
          { name: '翰林院掌院学士', rank: '正五品', holder: '', establishedCount: 1, vacancyCount: 1 },
          { name: '詹事府詹事', rank: '正三品', holder: '', establishedCount: 1, vacancyCount: 1, duties: '辅导东宫（今暂无太子）。' }
        ],
        subs: []
      }
    ];
  }

  // ═══════════════════════════════════════════════════════════════════
  // § 行政区划——北直隶 / 南直隶 / 陕西 / 辽东
  //   （其余布政使司用空骨架，游戏 AI 按需补足）
  // ═══════════════════════════════════════════════════════════════════
  function buildAdminHierarchy() {
    function division(opts) {
      var d = Object.assign({
        id: _uid('div_'),
        regionType: 'normal',
        populationDetail: { households: 0, mouths: 0, ding: 0, fugitives: 0, hiddenCount: 0 },
        byGender: { male: 0, female: 0, sexRatio: 1.05 },
        byAge: { old: { count: 0, ratio: 0.14 }, ding: { count: 0, ratio: 0.56 }, young: { count: 0, ratio: 0.30 } },
        byEthnicity: { '汉': 0.96, '其他': 0.04 },
        byFaith: { '儒': 0.35, '佛': 0.20, '道': 0.15, '民间': 0.30 },
        baojia: { baoCount: 0, jiaCount: 0, paiCount: 0, registerAccuracy: 0.62 },
        carryingCapacity: { arable: 0, water: 0, climate: 1.0, historicalCap: 0, currentLoad: 0.85, carryingRegime: 'strained' },
        minxinLocal: 45, corruptionLocal: 60,
        fiscalDetail: { claimedRevenue: 0, actualRevenue: 0, remittedToCenter: 0, retainedBudget: 0, compliance: 0.58, skimmingRate: 0.18, autonomyLevel: 0.2 },
        publicTreasuryInit: { money: 50000, grain: 100000, cloth: 10000 },
        children: []
      }, opts);
      // 自动推断未填数值
      if (d.populationDetail.mouths > 0) {
        if (!d.populationDetail.households) d.populationDetail.households = Math.floor(d.populationDetail.mouths / 5.2);
        if (!d.populationDetail.ding) d.populationDetail.ding = Math.floor(d.populationDetail.mouths * 0.26);
        d.population = d.populationDetail.mouths;
        d.byGender.male = Math.floor(d.populationDetail.mouths * 0.51);
        d.byGender.female = d.populationDetail.mouths - d.byGender.male;
        d.byAge.old.count = Math.floor(d.populationDetail.mouths * d.byAge.old.ratio);
        d.byAge.ding.count = Math.floor(d.populationDetail.mouths * d.byAge.ding.ratio);
        d.byAge.young.count = d.populationDetail.mouths - d.byAge.old.count - d.byAge.ding.count;
        d.baojia.baoCount = Math.floor(d.populationDetail.households / 100);
        d.baojia.jiaCount = Math.floor(d.populationDetail.households / 10);
        d.baojia.paiCount = d.baojia.jiaCount;
        d.carryingCapacity.arable = Math.round(d.populationDetail.mouths * 1.3);
        d.carryingCapacity.water = Math.round(d.populationDetail.mouths * 1.1);
        d.carryingCapacity.historicalCap = Math.round(d.populationDetail.mouths * 1.4);
        var annual = Math.round(d.populationDetail.mouths * 1.3);
        d.fiscalDetail.claimedRevenue = annual;
        d.fiscalDetail.actualRevenue = Math.round(annual * 0.82);
        d.fiscalDetail.remittedToCenter = Math.round(annual * 0.55);
        d.fiscalDetail.retainedBudget = Math.round(annual * 0.27);
      }
      return d;
    }

    return {
      player: {
        factionId: 'fac-ming',
        factionName: '明朝廷',
        divisions: [
          division({
            name: '北直隶', level: 'province', officialPosition: '顺天巡抚', governor: '刘诏',
            description: '京师所在，天下首善。下辖顺天/保定/河间/真定/大名/永平/顺德/广平/宣府 八府一镇。',
            populationDetail: { mouths: 8200000, households: 0, ding: 0, fugitives: 180000, hiddenCount: 200000 },
            terrain: '平原', specialResources: '漕运·煤·铁', taxLevel: '重',
            publicTreasuryInit: { money: 400000, grain: 800000, cloth: 60000 },
            minxinLocal: 48, corruptionLocal: 72,
            children: [
              division({ name: '顺天府', level: 'prefecture', officialPosition: '顺天府尹', governor: '',
                description: '京师。含大兴、宛平等县。', populationDetail: { mouths: 1500000 }, terrain: '平原' }),
              division({ name: '保定府', level: 'prefecture', populationDetail: { mouths: 900000 }, terrain: '平原' }),
              division({ name: '永平府', level: 'prefecture', populationDetail: { mouths: 450000 },
                description: '榆关所在，山海关节度于此。', terrain: '沿海' }),
              division({ name: '宣府镇', level: 'prefecture', regionType: 'normal',
                description: '九边之一，控蒙古。', populationDetail: { mouths: 300000 }, terrain: '山地',
                publicTreasuryInit: { money: 200000, grain: 400000, cloth: 30000 } })
            ]
          }),
          division({
            name: '南直隶', level: 'province', officialPosition: '应天巡抚', governor: '毛一鹭',
            description: '留都所在。财赋半天下。下辖应天/苏州/松江/常州/镇江/扬州/淮安/凤阳/徐州等十四府。',
            populationDetail: { mouths: 16500000, fugitives: 150000, hiddenCount: 500000 },
            terrain: '平原', specialResources: '丝绸·棉布·茶·漕米', taxLevel: '重',
            publicTreasuryInit: { money: 800000, grain: 1500000, cloth: 200000 },
            minxinLocal: 55, corruptionLocal: 65,
            children: [
              division({ name: '应天府', level: 'prefecture', officialPosition: '应天府尹',
                description: '南京。留都。', populationDetail: { mouths: 2100000 } }),
              division({ name: '苏州府', level: 'prefecture',
                description: '天下首府，赋最重。', populationDetail: { mouths: 2000000 }, specialResources: '丝绸·米', taxLevel: '重' }),
              division({ name: '松江府', level: 'prefecture',
                description: '东南布帛重镇，"衣被天下"。', populationDetail: { mouths: 1100000 }, specialResources: '棉布' }),
              division({ name: '扬州府', level: 'prefecture',
                description: '盐运总司驻地。', populationDetail: { mouths: 900000 }, specialResources: '盐' })
            ]
          }),
          division({
            name: '陕西布政使司', level: 'province', officialPosition: '陕西巡抚', governor: '胡廷宴',
            description: '三边总督武之望节制。秦地饥馑，民变之薪积。',
            populationDetail: { mouths: 5800000, fugitives: 350000, hiddenCount: 200000 },
            terrain: '山地', specialResources: '棉·盐·铁', taxLevel: '重',
            publicTreasuryInit: { money: 60000, grain: 80000, cloth: 10000 },
            minxinLocal: 22, corruptionLocal: 75,
            carryingCapacity: { arable: 6000000, water: 5500000, climate: 0.7, historicalCap: 7000000, currentLoad: 1.1, carryingRegime: 'famine' },
            children: [
              division({ name: '西安府', level: 'prefecture', populationDetail: { mouths: 1800000 }, terrain: '平原' }),
              division({ name: '延安府', level: 'prefecture',
                description: '旱魃三年，民食草根。', populationDetail: { mouths: 700000, fugitives: 120000 },
                terrain: '山地', minxinLocal: 12, taxLevel: '重',
                carryingCapacity: { arable: 600000, water: 400000, climate: 0.55, historicalCap: 800000, currentLoad: 1.3, carryingRegime: 'famine' } }),
              division({ name: '榆林镇', level: 'prefecture', regionType: 'normal',
                description: '九边之一。逃兵饥民最多。', populationDetail: { mouths: 250000, fugitives: 80000 },
                terrain: '山地', minxinLocal: 15 })
            ]
          }),
          division({
            name: '辽东都指挥使司', level: 'province', officialPosition: '辽东经略', governor: '王之臣',
            description: '九边之首。袁崇焕去后，现由王之臣兼领。宁远/山海关为关宁防线核心。',
            populationDetail: { mouths: 850000, fugitives: 200000 },
            terrain: '山地', specialResources: '马·皮毛·人参', taxLevel: '轻',
            publicTreasuryInit: { money: 150000, grain: 300000, cloth: 20000 },
            regionType: 'normal', minxinLocal: 40, corruptionLocal: 58,
            children: [
              division({ name: '宁远卫', level: 'prefecture', officialPosition: '宁远总兵', governor: '满桂',
                description: '关外要冲。宁远大战故地。', populationDetail: { mouths: 120000 }, terrain: '沿海' }),
              division({ name: '山海关', level: 'prefecture', officialPosition: '山海关总兵', governor: '赵率教',
                description: '天下第一关。', populationDetail: { mouths: 180000 }, terrain: '山地' }),
              division({ name: '东江镇·皮岛', level: 'prefecture', officialPosition: '东江总兵', governor: '毛文龙',
                description: '鸭绿江口海岛。孤悬海外，扰后金后方。', populationDetail: { mouths: 80000 }, terrain: '沿海',
                regionType: 'normal', minxinLocal: 55 })
            ]
          })
        ]
      }
    };
  }

  // DOM ready 后注册
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', register);
    } else {
      register();
    }
  } else {
    // Node / 测试环境
    setTimeout(register, 50);
  }
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
