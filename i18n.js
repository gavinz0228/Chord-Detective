(function () {
  "use strict";

  const STORAGE_KEY = "chord-detective-language";
  const dictionaries = { en: {}, "zh-CN": {} };
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
    for (const locale of Object.keys(dictionaries)) Object.assign(dictionaries[locale], translations[locale] || {});
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
