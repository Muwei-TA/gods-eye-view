import {
  resolveLocale,
  normalizeLocale,
  setLocale,
  translate,
} from './core.js';

export const LANGUAGE_STORAGE_KEY = 'gev.ui.language';
const attributes = ['title', 'placeholder', 'aria-label', 'alt'];

/** Translate only explicitly marked leaf text and attributes. */
export function applyTranslations(root, locale) {
  for (const element of root.querySelectorAll('[data-i18n]')) {
    // A container may contain a material icon, a link or an input. Mark its
    // text-bearing span instead; never destroy those controls or their listeners.
    if (element.children?.length) continue;
    element.textContent = translate(element.dataset.i18n, {}, locale);
  }
  for (const attribute of attributes) {
    const dataName = `i18n${attribute
      .split('-')
      .map((part) => part[0].toUpperCase() + part.slice(1))
      .join('')}`;
    for (const element of root.querySelectorAll(`[data-i18n-${attribute}]`)) {
      element.setAttribute(
        attribute,
        translate(element.dataset[dataName], {}, locale),
      );
    }
  }
}

/** Initialize before application construction. Reload keeps the current URL. */
export function initializeLanguage(options = {}) {
  const documentRef = options.document ?? globalThis.document;
  const navigatorRef = options.navigator ?? globalThis.navigator;
  let storage;
  let saved;
  try {
    storage = options.storage ?? globalThis.localStorage;
    saved = storage?.getItem(LANGUAGE_STORAGE_KEY);
  } catch {
    /* Private browsing can deny access to the storage object itself. */
  }
  let locale = resolveLocale({
    saved,
    languages: navigatorRef?.languages ?? [navigatorRef?.language],
  });
  const apply = () => {
    setLocale(locale);
    documentRef.documentElement.lang = locale;
    applyTranslations(documentRef, locale);
  };
  apply();
  const selector = documentRef.querySelector('#language-select');
  if (selector) selector.value = locale;
  const onChange = () => {
    const selected = normalizeLocale(selector.value);
    if (!selected || selected === locale) return;
    locale = selected;
    apply();
    let persisted = false;
    try {
      if (storage) {
        storage.setItem(LANGUAGE_STORAGE_KEY, locale);
        persisted = true;
      }
    } catch {
      /* Keep the page usable when preferences cannot be persisted. */
    }
    // Without storage, reloading would immediately discard the selection.
    if (persisted) (options.reload ?? (() => globalThis.location.reload()))();
  };
  selector?.addEventListener('change', onChange);
  return {
    get locale() {
      return locale;
    },
    dispose: () => selector?.removeEventListener('change', onChange),
  };
}
