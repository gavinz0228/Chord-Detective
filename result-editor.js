(function (root) {
  'use strict';
  function mount(host, adapter) {
    const t = key => root.ChordI18n.t(key);
    let editing = false, busy = false, selected = -1, undo = [];
    const toolbar = document.createElement('div');
    toolbar.className = 'result-tools';
    toolbar.innerHTML = '<button type="button" data-key="editResults"></button><button type="button" data-key="undoEdit"></button><select aria-label="Export format"><option value="json">JSON</option><option value="csv">CSV</option><option value="txt">TXT</option></select><button type="button" data-key="exportResults"></button><details class="result-explanation"><summary data-key="scoreMeaning"></summary><p data-key="matchExplanation"></p></details>';
    host.append(toolbar);
    const dialog = document.createElement('dialog');
    dialog.className = 'segment-dialog';
    dialog.innerHTML = '<form><h2 data-key="editSegment"></h2><p data-key="originalKeyNotice"></p><label><span data-key="chordLabel"></span><input name="chord" required maxlength="32" placeholder="C / Am7 / D/F#"></label><label><span data-key="startSeconds"></span><input name="start" type="number" min="0" step="0.001" required></label><label><span data-key="endSeconds"></span><input name="end" type="number" min="0" step="0.001" required></label><p class="segment-error" role="alert"></p><div class="segment-actions"><button type="submit" data-key="applyEdit"></button><button type="button" data-key="cancelEdit"></button><button type="button" data-key="deleteSegment"></button><button type="button" data-key="mergeNext"></button></div></form>';
    document.body.append(dialog);
    const form = dialog.querySelector('form');
    const controls = Object.fromEntries([...toolbar.querySelectorAll('button'), ...dialog.querySelectorAll('button')].map(b => [b.dataset.key, b]));
    const error = dialog.querySelector('.segment-error');
    function translate() {
      for (const element of [...toolbar.querySelectorAll('[data-key]'), ...dialog.querySelectorAll('[data-key]')]) element.textContent = t(element.dataset.key);
      toolbar.querySelector('select').setAttribute('aria-label', t('exportFormat'));
      update();
    }
    function update() {
      const count = adapter.get().length;
      controls.editResults.disabled = busy || !count || adapter.live?.();
      controls.editResults.setAttribute('aria-pressed', String(editing));
      controls.undoEdit.disabled = busy || !undo.length;
      controls.exportResults.disabled = busy || !count;
      controls.editResults.classList.toggle('active', editing);
    }
    function commit(segments) {
      undo.push(structuredClone(adapter.get()));
      if (undo.length > 20) undo.shift();
      adapter.set(segments);
      adapter.changed();
      dialog.close(); selected = -1;
      update();
    }
    function open(index) {
      const rows = adapter.get(), segment = rows[index];
      if (busy || !segment) return;
      adapter.stop?.();
      selected = index;
      form.elements.chord.value = ToolCore.chordName(segment.chord);
      form.elements.start.value = segment.start.toFixed(3);
      form.elements.end.value = segment.end.toFixed(3);
      error.textContent = '';
      controls.mergeNext.disabled = index === rows.length - 1;
      dialog.showModal();
      form.elements.chord.focus();
    }
    form.addEventListener('submit', event => {
      event.preventDefault();
      try {
        if (selected < 0 || busy) return;
        const rows = structuredClone(adapter.get());
        const start = Number(form.elements.start.value), end = Number(form.elements.end.value);
        ToolCore.validateSegment(rows, selected, start, end, adapter.duration());
        const parsed = ToolCore.parseChord(form.elements.chord.value);
        const row = rows[selected];
        rows[selected] = { ...row, start, end, chord: { ...row.chord, ...parsed }, edited: true };
        commit(rows);
      } catch (reason) { error.textContent = t(reason.message); }
    });
    controls.cancelEdit.onclick = () => dialog.close();
    controls.deleteSegment.onclick = () => {
      if (selected < 0 || busy) return;
      const rows = structuredClone(adapter.get()); rows.splice(selected, 1); commit(rows);
    };
    controls.mergeNext.onclick = () => {
      const rows = structuredClone(adapter.get());
      if (selected < 0 || busy || selected + 1 >= rows.length) return;
      // Keep the selected chord and extend it through the following segment.
      rows[selected] = { ...rows[selected], end: rows[selected + 1].end, edited: true };
      rows.splice(selected + 1, 1); commit(rows);
    };
    dialog.addEventListener('close', () => { selected = -1; });
    controls.editResults.onclick = () => { editing = !editing; adapter.render(); update(); };
    controls.undoEdit.onclick = () => {
      if (busy || !undo.length) return;
      adapter.set(undo.pop()); adapter.changed(); update();
    };
    controls.exportResults.onclick = () => {
      const format = toolbar.querySelector('select').value;
      const content = ToolCore.exportData(adapter.get(), format, adapter.name());
      const type = format === 'json' ? 'application/json' : format === 'csv' ? 'text/csv' : 'text/plain';
      const url = URL.createObjectURL(new Blob([format === 'csv' ? '\uFEFF' + content : content], { type: type + ';charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url; link.download = (adapter.name() || 'chords').replace(/[\\/:*?"<>|]/g, '_') + '-chords.' + format;
      document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    };
    root.addEventListener('chorddetective:languagechange', translate);
    translate();
    return {
      update,
      busy(value) { busy = value; if (value && dialog.open) dialog.close(); update(); },
      reset() { undo = []; editing = false; if (dialog.open) dialog.close(); update(); },
      row(rowElement, segment, index) {
        if (segment.edited) { const badge = document.createElement('small'); badge.className = 'edited-badge'; badge.textContent = t('manuallyEdited'); rowElement.cells[1]?.append(badge); }
        if (!editing || busy) return;
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'segment-edit'; button.textContent = t('editSegment');
        button.setAttribute('aria-label', t('editSegment') + ' ' + ToolCore.chordName(segment.chord));
        button.onclick = event => { event.stopPropagation(); open(index); };
        rowElement.cells[1]?.append(button);
      }
    };
  }
  root.ToolEditor = { mount };
})(globalThis);
