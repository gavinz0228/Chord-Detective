import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { IDBFactory } from 'fake-indexeddb';

const sandbox = vm.createContext({});
vm.runInContext(fs.readFileSync(new URL('tool-core.js', import.meta.url), 'utf8'), sandbox);
const core = sandbox.ToolCore;
const tasks = core.createTasks(), first = tasks.next(), second = tasks.next();
assert.equal(tasks.current(first), false); assert.equal(tasks.current(second), true);
assert.equal(core.chordName(core.parseChord('Bbmaj7')), 'A#maj7');
assert.equal(core.chordName(core.parseChord('D/F#')), 'D/F#');
assert.throws(() => core.parseChord('<img src=x>'), /invalidChord/);
assert.throws(() => core.parseChord('=SUM(1)'), /invalidChord/);
assert.throws(() => core.validateFile({ size: 65 * 1024 * 1024 }), /fileTooLarge/);
assert.throws(() => core.validateDuration(301, true), /separationTooLong/);
assert.throws(() => core.validateDuration(901), /audioTooLong/);
const segments = [{ start: 0, end: 2, chord: { root: 0, suffix: '', confidence: 0 } }, { start: 2, end: 4, chord: { root: 9, suffix: 'm', confidence: .7 } }];
core.validateSegment(segments, 0, 0, 1.9, 4);
assert.throws(() => core.validateSegment(segments, 0, 0, 2.1, 4), /overlapTime/);
assert.throws(() => core.validateSegment(segments, 0, NaN, 2, 4), /invalidTime/);
const json = JSON.parse(core.exportData(segments, 'json', 'fixture'));
assert.equal(json.segments[0].matchScore, 0);
assert.equal(json.tuning, 'original');
assert.equal(json.segments[1].chord, 'Am');
assert.match(core.exportData(segments, 'csv', ''), /0,2,C,0,false/);
assert.match(core.exportData(segments, 'txt', ''), /2\.00–4\.00\tAm/);

// Seed an old v1 database and verify the upgrade preserves audio/results while
// history listing returns metadata only. No production/browser storage is touched.
const idb = new IDBFactory();
const old = await new Promise((resolve, reject) => {
  const r = idb.open('chord-detective', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('songs', { keyPath: 'id' });
  r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
});
const audio = new Uint8Array([1, 2, 3, 4]).buffer;
await new Promise((resolve, reject) => {
  const tx = old.transaction('songs', 'readwrite');
  tx.objectStore('songs').put({ id: 'old', name: 'Old song', audioData: audio, results: segments });
  tx.oncomplete = resolve; tx.onerror = () => reject(tx.error);
});
old.close();
const storage = core.createStorage(idb);
let listed = await storage.list();
assert.equal(listed.length, 1);
assert.equal(listed[0].audioData, undefined);
assert.equal(listed[0].results, undefined);
assert.equal((await storage.get('old')).audioData.byteLength, 4);
await storage.put({ id: 'new', name: 'New song', size: 4, audioData: audio, results: segments, lastOpened: 2 });
assert.equal((await storage.list()).length, 2);
await storage.remove('old');
assert.equal(await storage.get('old'), undefined);
assert.equal((await storage.list()).length, 1);
await storage.clear();
assert.equal((await storage.list()).length, 0);
assert.equal(await storage.get('new'), undefined);
await storage.put({ id:'empty-edited', name:'Deliberately empty', audioData:audio, results:[], resultsReady:true });
assert.equal((await storage.get('empty-edited')).resultsReady,true,'An intentionally empty edit must stay empty on restore');
await assert.rejects(core.createStorage({ open() { throw Error('Storage disabled'); } }).list(), /Storage disabled/);

// Run the actual analysis function with controllable audio rendering to simulate
// song switching and failures at await boundaries.
const main = fs.readFileSync(new URL('index.html', import.meta.url), 'utf8');
const source = main.slice(main.indexOf('async function analyzeFile(){'), main.indexOf('function mergeRes'));
let renderResolve, renderReject, saved = 0, hidden = 0, status;
const bufferA = { sampleRate: 48000, duration: 1 }, bufferB = { sampleRate: 48000, duration: 2 };
const S = { buf: bufferA, ml: true, mode: 'file', res: [] };
const guard = core.createTasks();
const nodes = new Map();
function node(id) { if (!nodes.has(id)) nodes.set(id, { classList: { add() {}, remove() {} } }); return nodes.get(id); }
class AudioFixture {
  constructor() { this.destination = {}; }
  createBufferSource() { return { connect() {}, start() {} }; }
  createBuffer() { return { getChannelData: () => new Float32Array(48000) }; }
  startRendering() { return new Promise((resolve, reject) => { renderResolve = resolve; renderReject = reject; }); }
}
const ctx = vm.createContext({
  S, analysisTasks: guard, fileDecoding: false, resultEditor: { reset() {}, busy() {} },
  $: node, stopPlay() {}, showSkeleton() {}, hideSkeleton() { hidden++; },
  setStatus(key) { status = key; }, analysisRunning: false,
  mixMono: () => new Float32Array(48000), OfflineAudioContext: AudioFixture, SR: 22050,
  renderRes() {}, drawWaveform() {}, async persistSong() { saved++; }, console: { error() {} }
});
vm.runInContext(source, ctx);
const staleAnalysis = vm.runInContext('analyzeFile()', ctx);
guard.next(); S.buf = bufferB; S.res = [{ belongsTo: 'B' }];
renderResolve({ getChannelData: () => new Float32Array(22050) });
await staleAnalysis;
assert.equal(S.res[0].belongsTo, 'B'); assert.equal(saved, 0, 'Old task must not save into the new song');
const failingAnalysis = vm.runInContext('analyzeFile()', ctx);
renderReject(Error('Fixture inference/render failure'));
await failingAnalysis;
assert.equal(status, 'analysisFailed'); assert.equal(hidden, 1);
assert.equal(node('loadModelBtn').hidden, false); assert.equal(node('loadModelBtn').disabled, false);
assert.equal(ctx.analysisRunning, false);
let disposed=0;
const output={shape:[1,100,88],slice(){return this},reshape(){return this},async array(){throw Error('Fixture tensor read failure')}};
S.model={execute:()=>[output,output]};
Object.assign(ctx,{
  tf:{tensor:()=>({}),tidy:work=>work(),dispose:tensors=>{disposed+=tensors.length}},
  updateSkeleton(){},zz:async()=>{}
});
const tensorFailure=vm.runInContext('analyzeFile()',ctx);
renderResolve({getChannelData:()=>new Float32Array(22050)});
await tensorFailure;
assert.equal(disposed,2,'Tensor outputs must be released even when reading them fails');
assert.equal(status,'analysisFailed');
console.log('PASS: task isolation, segment validation, safe chord/export handling, v1 storage migration, metadata-only listing, clear/delete, storage failure, analysis cancellation/retry cleanup');
