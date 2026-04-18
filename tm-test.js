// ============================================================
// 天命 基础测试套件
// 纯函数测试，可在Node.js或浏览器控制台运行
// 用法: 在Electron控制台中执行 runAllTests()
// ============================================================

var _testResults = { passed: 0, failed: 0, errors: [] };

function _assert(condition, testName, detail) {
  if (condition) {
    _testResults.passed++;
  } else {
    _testResults.failed++;
    _testResults.errors.push(testName + (detail ? ': ' + detail : ''));
    console.error('[TEST FAIL] ' + testName + (detail ? ': ' + detail : ''));
  }
}

// ═══ 时间换算测试 ═══

function test_turnsForMonths() {
  // 模拟不同时间制
  var origGetTR = (typeof getTimeRatio === 'function') ? getTimeRatio : null;

  // 月制: 24月 = 24回合
  P.time = { perTurn: '1m' };
  _assert(turnsForMonths(24) === 24, 'turnsForMonths: 月制24月=24回合');
  _assert(turnsForMonths(0) === 0, 'turnsForMonths: 0月=0回合');
  _assert(turnsForMonths(1) === 1, 'turnsForMonths: 月制1月=1回合');

  // 年制: 24月 = 2回合
  P.time = { perTurn: '1y' };
  _assert(turnsForMonths(24) === 2, 'turnsForMonths: 年制24月=2回合');

  // 季制: 24月 = 8回合
  P.time = { perTurn: '1s' };
  _assert(turnsForMonths(24) === 8, 'turnsForMonths: 季制24月=8回合');

  // 恢复
  P.time = { perTurn: '1m' };
}

function test_ratePerTurn() {
  P.time = { perTurn: '1m' };
  var r = ratePerTurn(0.12); // 12%/年 → 月制=1%/回合
  _assert(Math.abs(r - 0.01) < 0.001, 'ratePerTurn: 月制12%/年≈1%/回合', '实际:' + r);

  P.time = { perTurn: '1y' };
  r = ratePerTurn(0.12);
  _assert(Math.abs(r - 0.12) < 0.001, 'ratePerTurn: 年制12%/年=12%/回合', '实际:' + r);

  P.time = { perTurn: '1m' };
}

function test_isYearBoundary() {
  P.time = { perTurn: '1m' };
  GM.turn = 12;
  _assert(isYearBoundary() === true, 'isYearBoundary: 月制T12=跨年');
  GM.turn = 11;
  _assert(isYearBoundary() === false, 'isYearBoundary: 月制T11=非跨年');

  P.time = { perTurn: '1y' };
  GM.turn = 1;
  _assert(isYearBoundary() === true, 'isYearBoundary: 年制任意回合=跨年');

  P.time = { perTurn: '1m' };
  GM.turn = 1;
}

// ═══ RNG测试 ═══

function test_createSubRng() {
  var rng1 = createSubRng('battle_T5');
  var rng2 = createSubRng('battle_T5');
  var v1 = rng1();
  var v2 = rng2();
  _assert(v1 === v2, 'createSubRng: 同种子=同结果', v1 + ' vs ' + v2);

  var rng3 = createSubRng('battle_T6');
  var v3 = rng3();
  _assert(v1 !== v3, 'createSubRng: 不同种子≠相同结果');
}

// ═══ 五常测试 ═══

function test_calculateWuchang() {
  if (typeof calculateWuchang !== 'function') { _assert(false, 'calculateWuchang: 函数不存在'); return; }

  // 高compassion+高honor → 高仁高礼
  var char1 = { traitIds: [], _calculatedDims: { compassion: 0.8, honor: 0.7, sociability: 0.5, rationality: 0.3, boldness: 0.2, vengefulness: 0.1, energy: 0.4, greed: -0.2 } };
  var wc1 = calculateWuchang(char1);
  _assert(wc1.仁 > 60, '五常: 高compassion→高仁', '仁=' + wc1.仁);
  _assert(wc1.礼 > 50, '五常: 高honor+sociability→高礼', '礼=' + wc1.礼);
  _assert(wc1.气质 !== undefined, '五常: 气质已计算', '气质=' + wc1.气质);

  // 覆盖测试
  var char2 = { traitIds: [], wuchangOverride: { 仁: 90, 义: 10 } };
  var wc2 = calculateWuchang(char2);
  _assert(wc2.仁 === 90, '五常覆盖: 仁=90', '实际:' + wc2.仁);
  _assert(wc2.义 === 10, '五常覆盖: 义=10', '实际:' + wc2.义);
}

// ═══ 恩怨系统测试 ═══

function test_enYuanSystem() {
  if (typeof EnYuanSystem === 'undefined') { _assert(false, 'EnYuanSystem: 不存在'); return; }

  GM.enYuanRecords = [];
  EnYuanSystem.add('en', '张三', '李四', 3, '提拔之恩', false);
  _assert(GM.enYuanRecords.length === 1, '恩怨: 添加成功');
  var mod = EnYuanSystem.getModifier('张三', '李四');
  _assert(mod > 0, '恩怨: 恩→正向修正', '修正=' + mod);

  EnYuanSystem.add('yuan', '王五', '李四', 4, '杀父之仇', true);
  var mod2 = EnYuanSystem.getModifier('王五', '李四');
  _assert(mod2 < 0, '恩怨: 怨→负向修正', '修正=' + mod2);

  // 不共戴天不衰减
  EnYuanSystem.decay();
  EnYuanSystem.decay();
  EnYuanSystem.decay();
  var yuanRec = GM.enYuanRecords.find(function(r) { return r.不共戴天; });
  _assert(yuanRec && yuanRec.currentValue > 50, '恩怨: 不共戴天不衰减', '当前值=' + (yuanRec ? yuanRec.currentValue : 0));

  GM.enYuanRecords = [];
}

// ═══ 事件白名单测试 ═══

// ═══ 宣战理由测试 ═══

function test_casusBelli() {
  if (typeof CasusBelliSystem === 'undefined') { _assert(false, 'CasusBelliSystem: 不存在'); return; }

  var cb = CasusBelliSystem.findCB('rebellion');
  _assert(cb !== null, 'CB: 平叛存在');

  var cbNone = CasusBelliSystem.findCB('none');
  _assert(cbNone !== null, 'CB: 无端开衅存在');
}

// ═══ 面子系统测试 ═══

function test_faceSystem() {
  if (typeof FaceSystem === 'undefined') { _assert(false, 'FaceSystem: 不存在'); return; }

  var char = { name: '测试', _face: undefined };
  _assert(FaceSystem.getFace(char) === 60, '面子: 初始值60');

  FaceSystem.publicHumiliation(char, '被贬');
  _assert(char._face === 40, '面子: 受辱后40', '实际:' + char._face);

  FaceSystem.publicHonor(char, '升迁');
  _assert(char._face === 55, '面子: 受赏后55', '实际:' + char._face);
}

// ═══ 家世门第测试 ═══

function test_familyStatus() {
  if (typeof getFamilyBarrierMultiplier !== 'function') { _assert(false, 'getFamilyBarrierMultiplier: 不存在'); return; }

  var imperial = { familyStatus: { 门第: 'imperial' } };
  _assert(getFamilyBarrierMultiplier(imperial) === 1.0, '家世: 皇族门槛×1.0');

  var outcast = { familyStatus: { 门第: 'outcast' } };
  _assert(Math.abs(getFamilyBarrierMultiplier(outcast) - 1.60) < 0.01, '家世: 贱籍门槛×1.60', '实际:' + getFamilyBarrierMultiplier(outcast));
}

// ═══ 运行全部测试 ═══

function runAllTests() {
  _testResults = { passed: 0, failed: 0, errors: [] };
  console.log('═══ 天命测试套件 开始 ═══');

  var tests = [
    test_turnsForMonths,
    test_ratePerTurn,
    test_isYearBoundary,
    test_createSubRng,
    test_calculateWuchang,
    test_enYuanSystem,
    test_casusBelli,
    test_faceSystem,
    test_familyStatus
  ];

  tests.forEach(function(fn) {
    try {
      fn();
    } catch(e) {
      _testResults.failed++;
      _testResults.errors.push(fn.name + ' 抛出异常: ' + e.message);
      console.error('[TEST ERROR] ' + fn.name + ':', e);
    }
  });

  console.log('═══ 测试完成 ═══');
  console.log('通过: ' + _testResults.passed + '  失败: ' + _testResults.failed);
  if (_testResults.errors.length > 0) {
    console.log('失败项:');
    _testResults.errors.forEach(function(e) { console.log('  ✗ ' + e); });
  }

  return _testResults;
}
