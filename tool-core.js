(function (root) {
  'use strict';
  const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  function createTasks() {
    let generation = 0;
    return { next: () => ++generation, current: token => token === generation };
  }
  function parseChord(value) {
    const match = String(value).trim().replaceAll('♯', '#').replaceAll('♭', 'b')
      .match(/^([A-G])([#b]?)([A-Za-z0-9#b()+°ø∆Δ-]{0,24}(?:\/[A-G][#b]?)?)$/);
    if (!match) throw Error('invalidChord');
    const natural = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    return { root: (natural[match[1]] + (match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0) + 12) % 12, suffix: match[3] };
  }
  const chordName = chord => NOTES[((chord.root % 12) + 12) % 12] + (chord.suffix || '');
  function validateSegment(segments, index, start, end, duration) {
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || end > duration + .001) throw Error('invalidTime');
    if ((index > 0 && start < segments[index - 1].end - .001) ||
        (index + 1 < segments.length && end > segments[index + 1].start + .001)) throw Error('overlapTime');
  }
  const LIMIT_BYTES = 64 * 1024 * 1024;
  function validateFile(file) { if (!file.size || file.size > LIMIT_BYTES) throw Error('fileTooLarge'); }
  function validateDuration(duration, separation = false) {
    if (!Number.isFinite(duration) || duration <= 0 || duration > (separation ? 300 : 900)) throw Error(separation ? 'separationTooLong' : 'audioTooLong');
  }
  function exportData(segments, format, name) {
    const rows = segments.map(s => ({ start: +s.start.toFixed(3), end: +s.end.toFixed(3), chord: chordName(s.chord), matchScore: s.chord.confidence ?? null, edited: !!s.edited }));
    if (format === 'json') return JSON.stringify({ version: 1, song: name, tuning: 'original', scoreMeaning: 'Algorithm match score, not probability of correctness', segments: rows }, null, 2);
    if (format === 'csv') return 'start_seconds,end_seconds,chord,match_score,edited\r\n' + rows.map(s => [s.start, s.end, s.chord, s.matchScore ?? '', s.edited].join(',')).join('\r\n');
    return rows.map(s => `${s.start.toFixed(2)}–${s.end.toFixed(2)}\t${s.chord}`).join('\n');
  }
  function createStorage(idb) {
    let opening;
    function open() {
      if (!opening) opening = new Promise((resolve, reject) => {
        const request = idb.open('chord-detective', 2);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains('songs')) db.createObjectStore('songs', { keyPath: 'id' });
          if (!db.objectStoreNames.contains('songMeta')) {
            const meta = db.createObjectStore('songMeta', { keyPath: 'id' });
            const cursor = request.transaction.objectStore('songs').openCursor();
            cursor.onsuccess = () => {
              const c = cursor.result;
              if (!c) return;
              const s = c.value;
              meta.put({ id: s.id, name: s.name, size: s.size || s.audioData?.byteLength || 0, lastOpened: s.lastOpened || 0 });
              c.continue();
            };
          }
        };
        request.onerror = () => { opening = null; reject(request.error); };
        request.onblocked = () => { opening = null; reject(Error('storageBlocked')); };
        request.onsuccess = () => {
          const db = request.result;
          db.onversionchange = () => { db.close(); opening = null; };
          resolve(db);
        };
      });
      return opening;
    }
    async function transaction(stores, mode, work) {
      const db = await open();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(stores, mode);
        let result;
        tx.oncomplete = () => resolve(result);
        tx.onerror = tx.onabort = () => reject(tx.error || Error('storageFailed'));
        try { work(tx, value => { result = value; }); }
        catch (error) { tx.abort(); reject(error); }
      });
    }
    return {
      list: () => transaction(['songMeta'], 'readonly', (tx, done) => { const r = tx.objectStore('songMeta').getAll(); r.onsuccess = () => done(r.result); }),
      get: id => transaction(['songs'], 'readonly', (tx, done) => { const r = tx.objectStore('songs').get(id); r.onsuccess = () => done(r.result); }),
      put: song => transaction(['songs', 'songMeta'], 'readwrite', tx => {
        tx.objectStore('songs').put(song);
        tx.objectStore('songMeta').put({ id: song.id, name: song.name, size: song.size, lastOpened: song.lastOpened });
      }),
      remove: id => transaction(['songs', 'songMeta'], 'readwrite', tx => { for (const s of ['songs', 'songMeta']) tx.objectStore(s).delete(id); }),
      clear: () => transaction(['songs', 'songMeta'], 'readwrite', tx => { for (const s of ['songs', 'songMeta']) tx.objectStore(s).clear(); })
    };
  }
  root.ToolCore = { createTasks, parseChord, chordName, validateSegment, validateFile, validateDuration, exportData, createStorage };
})(globalThis);
