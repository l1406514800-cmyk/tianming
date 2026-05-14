// smoke-settings-media-theme.js - guard Esc settings migration for audio/theme UI.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const patches = fs.readFileSync(path.join(ROOT, 'tm-patches.js'), 'utf8');

function assert(cond, msg) {
  if (!cond) throw new Error('[assert] ' + msg);
}

assert(/_renderSettingsAudioSection/.test(patches), 'settings audio section helper missing');
assert(/_renderSettingsThemeFontSection/.test(patches), 'settings theme/font section helper missing');
assert(/<h4>声乐<\/h4>/.test(patches) || /\\u58F0\\u4E50/.test(patches), 'settings page should expose 声乐 section');
assert(/<h4>主题字号<\/h4>/.test(patches) || /\\u4E3B\\u9898\\u5B57\\u53F7/.test(patches), 'settings page should expose 主题字号 section');
assert(/_renderSettingsAudioSection\(\)\+/.test(patches), 'settings page should mount 声乐 section');
assert(/_renderSettingsThemeFontSection\(\)\+/.test(patches), 'settings page should mount 主题字号 section');
assert(/AudioSystem\.(setBgmVolume|setSfxVolume|playTrack|setLoopMode|ensureBgmPlaying)/.test(patches), '声乐 section should use AudioSystem controls');
assert(/ThemeSystem\.setTheme/.test(patches), '主题字号 section should use ThemeSystem');
assert(/_settingsSizeApply/.test(patches) && /_tmApplySize/.test(patches), '主题字号 section should expose left-drawer font-size controls');
assert(/_tmApplyBodyFont|_tmApplyTitleFont/.test(patches), '主题字号 section should bridge existing left-drawer font controls');
assert(/_settingsMediaThemeInit/.test(patches), 'settings media/theme init hook missing');

console.log('[smoke-settings-media-theme] PASS settings media/theme sections present');
