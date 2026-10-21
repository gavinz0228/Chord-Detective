import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';

const main = fs.readFileSync(new URL('index.html', import.meta.url), 'utf8');
const separation = fs.readFileSync(new URL('index_demucs.html', import.meta.url), 'utf8');
for (const file of ['index.html', 'index_demucs.html', 'transpose.html']) {
  const html = fs.readFileSync(new URL(file, import.meta.url), 'utf8');
  for (const [, attributes, source] of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/src=|importmap/.test(attributes)) continue;
    const args = attributes.includes('module') ? ['--input-type=module', '--check'] : ['--check'];
    const check = spawnSync(process.execPath, args, { input: source, encoding: 'utf8' });
    assert.equal(check.status, 0, `${file}: ${check.stderr}`);
  }
}
for(const file of ['i18n.js','tool-core.js','result-editor.js']){
  const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8',cwd:new URL('.',import.meta.url)});
  assert.equal(result.status,0,result.stderr);
}

// Exercise the actual loading function, without downloading models or audio.
const nodes = new Map();
const node = id => {
  if (!nodes.has(id)) nodes.set(id, { style: {}, querySelector: () => ({ style: {} }) });
  return nodes.get(id);
};
let loads = 0, analyses = 0, fail = true;
const mainContext = vm.createContext({
  $: node, S: { ml: false, mode: 'file', buf: {}, res: [] }, BP_URL: 'fixture', fileDecoding:false,
  t: key => key, setStatus() {},
  tf: { async loadGraphModel() { loads++; if (fail) throw Error('fixture download failed'); return {}; } },
  async analyzeFile() { analyses++; }
});
vm.runInContext(main.slice(main.indexOf('let modelLoading = false;'), main.indexOf('function showInputMode')), mainContext);
await vm.runInContext('loadModel()', mainContext);
assert.equal(node('loadModelBtn').hidden, false, 'Failure must expose retry');
assert.equal(node('loadModelBtn').disabled, false);
fail = false;
await vm.runInContext('loadModel()', mainContext);
assert.equal(node('loadModelBtn').hidden, true, 'Successful retry hides model controls');
assert.equal(analyses, 1, 'Successful preparation starts analysis');
await vm.runInContext('loadModel()', mainContext);
assert.equal(loads, 2, 'Ready models must not load twice');

let click, accepted = false, confirmations = 0, modelLoads = 0, separations = 0, failDownload = false;
const state = { buffer: null, modelLoaded: false, busy: false, separatedTracks: null };
const els = {
  loadModelBtn: { addEventListener: (_type, handler) => { click = handler; } },
  fileInput: {}, trackList: {}, modelProgressBar: { style: {}, querySelector: () => ({ style: {} }) },
  modelProgressText: {}
};
class Processor {
  async loadModel() { modelLoads++; if (failDownload) throw Error('fixture download failure'); }
}
const separationContext = vm.createContext({
  state, els, resultEditor:undefined, window: { confirm: () => { confirmations++; return accepted; } },
  t: key => key, setModelButton: key => { state.modelButtonKey = key; },
  setProgress() {}, setStatus: key => { state.statusKey = key; },
  byId: node, ort: {}, DemucsProcessor: Processor, CONSTANTS: { DEFAULT_MODEL_URL: 'fixture' },
  async runSeparation() { separations++; state.separatedTracks = {}; }, console: { error() {} }
});
const handlerStart = separation.indexOf("els.loadModelBtn.addEventListener('click'");
const handlerEnd = separation.indexOf('// File upload', handlerStart);
vm.runInContext(separation.slice(handlerStart, handlerEnd), separationContext);
await click();
assert.equal(confirmations, 0, 'No download before a song is selected');
state.buffer = {};
await click();
assert.equal(modelLoads, 0, 'Cancel must not download');
assert.equal(state.busy, false);
accepted = true; failDownload = true;
await click();
assert.equal(state.modelButtonKey, 'retryLoad');
assert.equal(els.loadModelBtn.disabled, false);
assert.equal(els.fileInput.disabled, false);
failDownload = false;
await click();
assert.equal(modelLoads, 2);
assert.equal(separations, 1);
assert.equal(els.trackList.inert, false);
const previousConfirmations = confirmations;
await click();
assert.equal(confirmations, previousConfirmations, 'Loaded model does not ask to download again');
assert.equal(modelLoads, 2);
assert.equal(separations, 2);
state.busy = true;
await click();
assert.equal(separations, 2, 'Busy action cannot start duplicate processing');
assert.match(separation, /const input = state\.originalBuffer/, 'Repeat separation must use original audio');
assert.doesNotMatch(main, /setTimeout\(loadModel/, 'Do not download a file-only model when entering the microphone tool');
assert.match(main, /requestedMode==="mic"\?"mic":"file"/, 'File recognition is the default');

const translations = vm.createContext({
  document: { documentElement: {}, querySelectorAll: () => [], addEventListener() {} },
  window: {}, localStorage: { getItem: () => 'zh-CN', setItem() {} }, navigator: { language: 'zh-CN' }
});
vm.runInContext(fs.readFileSync(new URL('i18n.js', import.meta.url), 'utf8'), translations);
translations.window.ChordI18n.register({ 'zh-CN': { fileUpload: 'old technical label' } });
assert.equal(translations.window.ChordI18n.t('fileUpload'), '歌曲和弦识别');
assert.match(translations.window.ChordI18n.t('confirmSeparation'), /172MB/);
assert.match(translations.window.ChordI18n.t('privacyNotice'), /保存在此浏览器/);
const i18nSource=fs.readFileSync(new URL('i18n.js',import.meta.url),'utf8');
for(const storageMode of ['read-denied','write-denied','getter-denied']){
  let changes=0;
  const translatedNode={dataset:{i18n:'fileUpload'},textContent:''};
  const environment={
    document:{documentElement:{},querySelectorAll:selector=>selector==='[data-i18n]'?[translatedNode]:[],addEventListener(){}},
    navigator:{language:'zh-TW'},window:{dispatchEvent(){changes++}},CustomEvent:class{}
  };
  if(storageMode==='getter-denied')Object.defineProperty(environment,'localStorage',{get(){throw Error('SecurityError')}});
  else environment.localStorage={getItem(){if(storageMode==='read-denied')throw Error('SecurityError');return null},setItem(){throw Error('QuotaExceededError')}};
  const restricted=vm.createContext(environment);
  vm.runInContext(i18nSource,restricted);
  const api=restricted.window.ChordI18n;
  api.register({});
  assert.equal(api.getLanguage(),'zh-TW',storageMode+' falls back to traditional browser language');
  api.setLanguage('en');
  assert.equal(api.getLanguage(),'en',storageMode+' keeps the selection in memory');
  assert.equal(translatedNode.textContent,'Song chords');
  assert.equal(environment.document.documentElement.lang,'en');
  assert.equal(changes,1,storageMode+' still notifies the page after a language change');
}
// Browser preference, explicit scripts, regional variants and saved choices.
for (const [browserLanguage, saved, expected, languages] of [
  ['zh-TW', null, 'zh-TW'], ['zh-HK', null, 'zh-TW'], ['zh-MO', null, 'zh-TW'],
  ['zh-Hant', null, 'zh-TW'], ['zh-Hant-US', null, 'zh-TW'],
  ['zh-CN', null, 'zh-CN'], ['zh-SG', null, 'zh-CN'], ['zh', null, 'zh-CN'],
  ['zh-Hans-HK', null, 'zh-CN'], ['zh-Hant-CN', null, 'zh-TW'],
  ['en-US', null, 'en'], ['ja-JP', null, 'en'], ['fr', null, 'en'],
  ['zh-TW', null, 'en', ['en-US', 'zh-TW']],
  ['en-US', null, 'zh-TW', ['zh-HK', 'en-US']],
  ['en-US', 'zh-TW', 'zh-TW'], ['zh-TW', 'en', 'en'],
  ['zh-TW', 'zh-CN', 'zh-CN'], ['ja', 'invalid', 'en'],
  [undefined, null, 'en']
]) {
  let persisted;
  const env = vm.createContext({
    document: { documentElement: {}, querySelectorAll: () => [], addEventListener() {} },
    navigator: { language: browserLanguage, languages },
    localStorage: { getItem: () => saved, setItem: (_key, value) => { persisted = value; } },
    window: { dispatchEvent() {} }, CustomEvent: class {}
  });
  vm.runInContext(i18nSource, env);
  const api = env.window.ChordI18n;
  assert.equal(api.getLanguage(), expected, JSON.stringify({browserLanguage,saved,languages}));
  api.setLanguage(expected === 'zh-TW' ? 'en' : 'zh-TW');
  assert.equal(persisted, api.getLanguage(), 'Manual choice is persisted');
}
for (const file of ['index.html', 'index_demucs.html', 'transpose.html']) {
  const html = fs.readFileSync(new URL(file, import.meta.url), 'utf8');
  assert.match(html, /<option value="zh-TW">繁體中文<\/option>/);
  const register = html.slice(html.indexOf('ChordI18n.register('), html.indexOf('const t', html.indexOf('ChordI18n.register(')));
  let copy;
  vm.runInNewContext(register, { ChordI18n: { register(value) { copy = value; } } });
  assert.deepEqual(Object.keys(copy['zh-TW']).sort(), Object.keys(copy['zh-CN']).sort(), file+' traditional copy is complete');
  for (const key of Object.keys(copy['zh-CN'])) {
    assert.deepEqual(copy['zh-TW'][key].match(/\{\w+\}/g), copy['zh-CN'][key].match(/\{\w+\}/g), file+': '+key+' placeholders');
  }
  const env = vm.createContext({
    document: { documentElement: {}, querySelectorAll: () => [], addEventListener() {} },
    navigator: { language: 'zh-TW' }, localStorage: { getItem: () => null }, window: {}
  });
  vm.runInContext(i18nSource, env);
  env.window.ChordI18n.register(copy);
  assert.equal(env.window.ChordI18n.t('fileUpload'), '歌曲和弦識別');
  assert.match(env.window.ChordI18n.t('privacyNotice'), /瀏覽器/);
  assert.notEqual(env.window.ChordI18n.t('pageTitle'), 'pageTitle');
}
console.log('PASS: script syntax, automatic preparation/retry, separation consent/retry/busy guard, original audio, default mode, shared copy');
