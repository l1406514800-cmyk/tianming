// scripts/smoke-tinyi-fix.js
// 验证廷议三处修复：
//   1. attendees 过滤——后宫/无官职者剔除
//   2. _ty3_pickFallbackSpeakers 兜底选人
//   3. _ty3_isControversial 分歧度判定
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

function fakeEl() {
  return {classList:{add(){},remove(){},toggle(){},contains(){return false}},style:{cssText:''},appendChild(c){return c},removeChild(c){return c},insertBefore(c){return c},setAttribute(){},getAttribute(){return null},addEventListener(){},removeEventListener(){},querySelector(){return fakeEl()},querySelectorAll(){return[]},children:[],childNodes:[],firstChild:null,parentNode:null,innerHTML:'',textContent:'',value:'',dataset:{}};
}
const sandbox = {
  console, setTimeout, clearTimeout, setInterval, clearInterval,
  Math, Date, JSON, RegExp, Error, Promise,
  Array, Object, String, Number, Boolean,
  parseInt, parseFloat, isNaN, isFinite,
  document: { getElementById:()=>fakeEl(), querySelector:()=>fakeEl(), querySelectorAll:()=>[], addEventListener(){}, createElement:()=>fakeEl(), body:fakeEl(), readyState:'complete' },
  window: {}, localStorage: {getItem:()=>null,setItem:()=>{},removeItem:()=>{}},
  navigator: {userAgent:'node'}, performance: {now:()=>Date.now()},
  fetch:()=>Promise.reject(new Error('no fetch')),
  alert:()=>{}, confirm:()=>true, prompt:()=>null,
  HTMLElement:function(){}, Event:function(){}, requestAnimationFrame:cb=>setTimeout(cb,16)
};
sandbox.window = sandbox; sandbox.global = sandbox; sandbox.globalThis = sandbox;
sandbox.addEventListener = ()=>{}; sandbox.removeEventListener = ()=>{};
vm.createContext(sandbox);

const html = fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const re = /<script[^>]+src="([^"]+\.js)/g;
let m;
while ((m = re.exec(html))) {
  const fp = path.join(ROOT, m[1].split('?')[0]);
  if (!fs.existsSync(fp)) continue;
  try { vm.runInContext(fs.readFileSync(fp,'utf8'), sandbox, { filename: m[1] }); } catch(e) {}
}
try { vm.runInContext(fs.readFileSync(path.join(ROOT,'scenarios/tianqi7-1627.js'),'utf8'), sandbox); } catch(e) {}

setTimeout(() => {
  try {
    const sc = sandbox.P.scenarios.find(s=>s.id==='sc-tianqi7-1627');
    const GM = sandbox.GM = {
      running:true, sid:sc.id, turn:1, busy:false,
      vars:{}, rels:{}, evtLog:[], officeChanges:[], qijuHistory:[],
      facs:(sandbox.P.factions||[]).filter(f=>f.sid===sc.id).map(f=>Object.assign({},f)),
      chars:(sandbox.P.characters||[]).filter(c=>c.sid===sc.id).map(c=>Object.assign({},c)),
      _capital:'京师'
    };
    sandbox.P.conf = { gameMode: 'strict_hist' };

    // ===== 测试 1: _ty3_pickFallbackSpeakers 兜底选人 =====
    console.log('========== 测试 1: _ty3_pickFallbackSpeakers ==========');
    const sun = GM.chars.find(c=>c.name==='孙承宗');
    const yuan = GM.chars.find(c=>c.name==='袁崇焕');
    const wei = GM.chars.find(c=>c.name==='魏忠贤');
    const ke = GM.chars.find(c=>c.name==='客氏');
    sandbox.CY = sandbox.CY || {};
    sandbox.CY._ty3 = {
      attendees: [sun.name, yuan.name, wei.name, '徐光启', '钱龙锡'].filter(Boolean)
    };
    const fb1 = sandbox._ty3_pickFallbackSpeakers([], 3);
    console.log('  attendees=5·取 3 → 选出:', fb1, '(应 3 人·按 prestige 排)');
    const fb2 = sandbox._ty3_pickFallbackSpeakers([sun.name], 3);
    console.log('  排除孙承宗后取 3:', fb2, '(应不含孙承宗)');

    // ===== 测试 2: _ty3_isControversial 分歧判定 =====
    console.log('\n========== 测试 2: _ty3_isControversial ==========');
    sandbox.CY._ty2 = {
      stances: {
        '孙承宗': { current: '支持' },
        '袁崇焕': { current: '反对' },
        '徐光启': { current: '中立' },
        '钱龙锡': { current: '倾向支持' },
        '魏忠贤': { current: '极力反对' }
      }
    };
    console.log('  支持/反对/中立 各占 1/3 → 应 controversial:', sandbox._ty3_isControversial(), '(应 true)');

    sandbox.CY._ty2.stances = {
      '孙承宗': { current: '支持' },
      '袁崇焕': { current: '支持' },
      '徐光启': { current: '倾向支持' },
      '钱龙锡': { current: '极力支持' },
      '魏忠贤': { current: '中立' }
    };
    console.log('  4 支持 + 1 中立 → 应 NOT controversial:', sandbox._ty3_isControversial(), '(应 false)');

    sandbox.CY._ty2.stances = {
      '孙承宗': { current: '待定' },
      '袁崇焕': { current: '待定' },
      '徐光启': { current: '待定' },
      '钱龙锡': { current: '待定' },
      '魏忠贤': { current: '支持' }
    };
    console.log('  5 人中 4 待定 (80%) → 应 controversial:', sandbox._ty3_isControversial(), '(应 true·待定 ≥40%)');

    sandbox.CY._ty2.stances = {
      '孙承宗': { current: '支持' },
      '袁崇焕': { current: '反对' },
      '徐光启': { current: '中立' }
    };
    console.log('  3 人各持一态 → 应 controversial:', sandbox._ty3_isControversial(), '(应 true)');

    // ===== 测试 3: _ty3_progRender / _ty3_progClear 不抛 =====
    console.log('\n========== 测试 3: 进度条函数不抛 ==========');
    try {
      sandbox._ty3_progRender(2, 5, '测试');
      sandbox._ty3_progClear();
      console.log('  progRender + progClear 跑完无异常: ✓');
    } catch(e) {
      console.log('  ✗ 异常:', e.message);
    }

    // ===== 测试 4: _ty3_isHaremTitle 后宫称号识别 =====
    console.log('\n========== 测试 4: _ty3_isHaremTitle ==========');
    const cases = [
      ['皇后', true], ['贵妃', true], ['淑妃', true], ['奉圣夫人', true],
      ['公主', true], ['太后', true], ['乳母', true], ['宫人', true],
      ['吏部尚书', false], ['内阁大学士', false], ['锦衣卫指挥使', false],
      ['翰林院侍读', false], ['', false], [null, false]
    ];
    let pass = 0, fail = 0;
    cases.forEach(([title, expected]) => {
      const got = !!sandbox._ty3_isHaremTitle(title);
      if (got === expected) { pass++; }
      else { fail++; console.log(`  ✗ ${JSON.stringify(title)}: got=${got} expected=${expected}`); }
    });
    console.log(`  ${pass}/${cases.length} 用例通过${fail===0 ? ' ✓' : ' ✗'}`);

    // 实际剧本中的后宫角色测试
    console.log('\n========== 测试 5: 剧本后宫角色被识别 ==========');
    const haremActual = GM.chars.filter(c => c && (c.officialTitle || c.title) && sandbox._ty3_isHaremTitle(c.officialTitle || c.title));
    console.log('  剧本中被识别为后宫/外戚的角色数:', haremActual.length);
    haremActual.slice(0, 8).forEach(c => {
      console.log('    ' + c.name + ' · ' + (c.officialTitle || c.title));
    });

    // 反向：有 title 且不被识别为后宫的（应是廷臣）
    const officials = GM.chars.filter(c => c && (c.officialTitle || c.title) && !sandbox._ty3_isHaremTitle(c.officialTitle || c.title));
    console.log('  剧本中正常廷臣数:', officials.length, '(应 ≥ 30)');

    process.exit(0);
  } catch(e) {
    console.error('SIM ERROR:', e.message, '\n', e.stack);
    process.exit(1);
  }
}, 250);
