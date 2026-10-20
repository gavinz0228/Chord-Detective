(function () {
  "use strict";

  const STORAGE_KEY = "chord-detective-language";
  const dictionaries = { en: {}, "zh-CN": {} };
  // Shared task-oriented copy takes precedence over page-specific engine labels.
  const friendlyCopy = {
    en: {
      visitCafe: "Explore Chord.Cafe ↗", cafeDescription: "Find chord charts. Practice guitar.",
      confidence: "Match score", minimumConfidence: "Minimum match score", noChordConfidence: "No segments above {pct}% match score", scoreMeaning: "About match scores & export",
      matchExplanation: "Match scores compare notes with chord templates; they are not accuracy percentages. Edited segments keep the original score. Editing and export use the original key and all segments, including hidden ones.",
      editResults: "Edit results", undoEdit: "Undo edit", exportResults: "Export results", exportFormat: "Export format", actions: "Actions",
      editSegment: "Edit", chordLabel: "Chord", startSeconds: "Start (seconds)", endSeconds: "End (seconds)", originalKeyNotice: "Edit in the original key. Times cannot overlap adjacent segments.",
      applyEdit: "Apply", cancelEdit: "Cancel", deleteSegment: "Delete segment", mergeNext: "Merge next (keep this chord)", manuallyEdited: "Edited",
      invalidChord: "Enter a chord such as C, Am7 or D/F#.", invalidTime: "Use valid start/end times within the audio duration.", overlapTime: "This time range overlaps an adjacent segment.",
      analysisFailed: "Detection failed. You can retry; your audio is still loaded.", statusDecoding: "Reading audio…",
      savingLocal: "Saving on this device…", savedLocal: "Saved on this device", saveFailed: "Local storage unavailable or full. This result is not safely saved — export it to keep it.", removedLocal: "Local history removed; the current audio remains open.",
      clearHistory: "Clear local history", confirmClearHistory: "Remove all locally saved songs, audio and results? This cannot be undone. The current audio stays open, but will no longer auto-save.", confirmDeleteHistory: "Remove this song, its audio and results from local history? This cannot be undone.",
      fileLimits: "Up to 64MB and 15 minutes per audio file.", separationLimits: "Up to 64MB and 5 minutes for separation. Results are not auto-saved — export them to keep them.",
      fileTooLarge: "Choose a non-empty audio file no larger than 64MB.", audioTooLong: "Audio must be no longer than 15 minutes. Trim it and try again.", separationTooLong: "For separation, choose audio no longer than 5 minutes. Trim it and try again.",
      heroSub: "Choose a song, find its chords, then listen and check the results.", inputSource: "Choose a tool",
      microphone: "Live instrument", micNote: "Play and detect", fileUpload: "Song chords", quickFile: "Song chords", quickAnalysis: "Song chords", fileNote: "Choose a song to begin", analysisNote: "Listen and check chords",
      stemSeparation: "Vocals & accompaniment", demucsNote: "Separate, then detect", currentMode: "Current tool",
      pageHeading: "Vocals & accompaniment", subhead: "Separate a song into vocals and instruments, then find chords in the accompaniment.",
      loadModel: "Retry detection", loading: "Preparing chord detection…", failed: "Could not prepare detection. Please retry. ({message})",
      engineSummary: "Results are a guide — listen and check", statusModelReady: "Ready", statusLoadFailed: "Could not prepare detection — retry below",
      statusPreprocessing: "Reading audio…", statusInference: "Finding chords…", statusInferenceProgress: "Finding chords {pct}%", statusMatching: "Organizing chords…",
      advancedSettings: "Advanced settings", technicalDetails: "Technical details", technicalCopy: "File detection uses Basic Pitch; live detection uses FFT. First file use downloads a model of about 725KB, plus runtime libraries.",
      privacyNotice: "Audio stays on this device. Songs and results are saved in this browser; remove them from song history. Detection is a guide — listen and check.",
      separationHint: "Vocals getting in the way? Try separating the accompaniment →",
      loadStep: "2. Separate & find chords", loadDemucs: "Start separation", emptyWorkflow: "Choose a song → Start separation → Listen and check", disclaimer: "Accompaniment is analyzed first. Choosing a different track detects its chords again.",
      separationNotice: "Audio is processed on this device, not uploaded. First use downloads about 172MB. Processing can take several minutes and use considerable battery on phones. Check the results by listening.",
      confirmSeparation: "First use downloads about 172MB, plus runtime libraries. Processing may take several minutes and use considerable battery. Continue?",
      downloadingModel: "Preparing separation…", connecting: "Downloading required files…", modelLoaded: "Ready", statusLoadedLoadModel: "Song ready — start separation", retryLoad: "Retry separation", statusModelLoadFailed: "Preparation failed — please retry", resampling: "Preparing audio…", demucsInference: "Separating vocals and instruments… This may take several minutes.",
      separationAgain: "Separate again", decodingFailed: "Could not read this audio file. Please choose another.", processingLog: "Processing details", micQuiet: "Play a chord, or move closer to the microphone."
    },
    "zh-CN": {
      visitCafe: "逛逛 Chord.Cafe ↗", cafeDescription: "找曲谱，练吉他",
      confidence: "匹配度", minimumConfidence: "最低匹配度", noChordConfidence: "没有匹配度达到 {pct}% 的片段", scoreMeaning: "匹配度与导出说明",
      matchExplanation: "匹配度是音符与和弦模板的相似程度，不代表正确率。人工修改后保留原始分数。编辑与导出采用原调，导出包含被筛选隐藏的片段。",
      editResults: "编辑结果", undoEdit: "撤销修改", exportResults: "导出结果", exportFormat: "导出格式", actions: "操作",
      editSegment: "编辑", chordLabel: "和弦", startSeconds: "开始时间（秒）", endSeconds: "结束时间（秒）", originalKeyNotice: "按原调编辑；时间段不能与相邻片段重叠。",
      applyEdit: "应用修改", cancelEdit: "取消", deleteSegment: "删除此段", mergeNext: "合并下一段（保留当前和弦）", manuallyEdited: "已修改",
      invalidChord: "请输入 C、Am7、D/F# 等和弦名称。", invalidTime: "请输入音频范围内有效的开始和结束时间。", overlapTime: "时间段与相邻片段重叠，请调整。",
      analysisFailed: "识别失败，可以重试；音频仍保留在当前页面。", statusDecoding: "正在读取音频…",
      savingLocal: "正在保存到本机…", savedLocal: "已保存到本机", saveFailed: "本地存储不可用或空间不足，结果未可靠保存，请导出保留。", removedLocal: "已移除本地历史，当前音频仍保持打开。",
      clearHistory: "清空本地历史", confirmClearHistory: "清除本机保存的所有歌曲、音频和结果？此操作不可撤销。当前音频保持打开，但不再自动保存。", confirmDeleteHistory: "删除此歌曲的本地音频和结果？此操作不可撤销。",
      fileLimits: "支持最大 64MB、15 分钟以内的音频。", separationLimits: "分离支持最大 64MB、5 分钟以内的音频。结果不自动保存，请导出保留。",
      fileTooLarge: "请选择不超过 64MB 的非空音频文件。", audioTooLong: "音频不能超过 15 分钟，请裁剪后重试。", separationTooLong: "音轨分离仅支持 5 分钟以内的音频，请裁剪后重试。",
      heroSub: "选择歌曲，识别和弦，边听边校对。", inputSource: "选择工具",
      microphone: "弹奏识别", micNote: "边弹边识别", fileUpload: "歌曲和弦识别", quickFile: "歌曲和弦识别", quickAnalysis: "歌曲和弦识别", fileNote: "选择歌曲开始分析", analysisNote: "边听边校对和弦",
      stemSeparation: "分离人声与伴奏", demucsNote: "分离后识别和弦", currentMode: "当前工具",
      pageHeading: "分离人声与伴奏", subhead: "将歌曲分成人声与乐器音轨，再从伴奏中识别和弦。",
      loadModel: "重试识别", loading: "正在准备识别…", failed: "识别准备失败，请重试。（{message}）",
      engineSummary: "识别仅供参考，请试听校对", statusModelReady: "已就绪", statusLoadFailed: "识别准备失败，请点击下方重试",
      statusPreprocessing: "正在读取音频…", statusInference: "正在识别和弦…", statusInferenceProgress: "正在识别和弦 {pct}%", statusMatching: "正在整理和弦…",
      advancedSettings: "高级设置", technicalDetails: "技术说明", technicalCopy: "文件识别使用 Basic Pitch；麦克风使用 FFT。首次文件识别需下载约 725KB 模型，另需加载运行库。",
      privacyNotice: "音频在本机处理；歌曲和结果会保存在此浏览器，可在历史记录中删除。识别仅供参考，请试听校对。",
      separationHint: "人声干扰识别？试试分离伴奏后分析 →",
      loadStep: "2. 分离并识别和弦", loadDemucs: "开始分离", emptyWorkflow: "选择歌曲 → 开始分离 → 试听校对", disclaimer: "分离完成后默认分析伴奏；切换音轨会重新识别和弦。",
      separationNotice: "音频仅在本机处理，不上传。首次使用需下载约 172MB，处理可能需要数分钟，手机较耗电。分离与识别结果仅供参考。",
      confirmSeparation: "首次使用需下载约 172MB，另需加载运行库。处理可能需要数分钟，手机较耗电。是否继续？",
      downloadingModel: "正在准备分离…", connecting: "正在下载所需文件…", modelLoaded: "已就绪", statusLoadedLoadModel: "歌曲已就绪，点击开始分离", retryLoad: "重试分离", statusModelLoadFailed: "准备失败，请重试", resampling: "正在准备音频…", demucsInference: "正在分离人声与乐器…可能需要数分钟。",
      separationAgain: "重新分离", decodingFailed: "无法读取此音频文件，请换一个文件重试。", processingLog: "处理详情", micQuiet: "请弹奏和弦，或靠近一点麦克风。"
    }
  };
  let language = getInitialLanguage();

  function getInitialLanguage() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "en" || saved === "zh-CN") return saved;
    return navigator.language && navigator.language.toLowerCase().startsWith("zh") ? "zh-CN" : "en";
  }

  function interpolate(value, params) {
    return String(value).replace(/\{(\w+)\}/g, (_, key) => params[key] ?? `{${key}}`);
  }

  function t(key, params = {}) {
    const value = dictionaries[language][key] ?? dictionaries.en[key] ?? dictionaries["zh-CN"][key] ?? key;
    return interpolate(value, params);
  }

  function apply(root = document) {
    document.documentElement.lang = language;
    root.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
    root.querySelectorAll("[data-i18n-title]").forEach((el) => { el.title = t(el.dataset.i18nTitle); });
    root.querySelectorAll("[data-i18n-aria-label]").forEach((el) => { el.setAttribute("aria-label", t(el.dataset.i18nAriaLabel)); });
    root.querySelectorAll("[data-language-select]").forEach((el) => { el.value = language; });
  }

  function register(translations) {
    for (const locale of Object.keys(dictionaries)) Object.assign(dictionaries[locale], translations[locale] || {}, friendlyCopy[locale]);
    apply();
  }

  function setLanguage(nextLanguage) {
    if (!dictionaries[nextLanguage] || nextLanguage === language) return;
    language = nextLanguage;
    localStorage.setItem(STORAGE_KEY, language);
    apply();
    window.dispatchEvent(new CustomEvent("chorddetective:languagechange", { detail: { language } }));
  }

  document.addEventListener("change", (event) => {
    if (event.target.matches("[data-language-select]")) setLanguage(event.target.value);
  });
  document.addEventListener("DOMContentLoaded", () => apply());

  window.ChordI18n = { apply, getLanguage: () => language, register, setLanguage, t };
})();
