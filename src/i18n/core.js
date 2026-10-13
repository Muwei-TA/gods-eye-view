import { messages } from './messages.js';

let activeLocale = 'en';

/** Only supported locales are admitted; Traditional Chinese stays unsupported. */
export function normalizeLocale(value) {
  const tag = String(value ?? '')
    .trim()
    .replaceAll('_', '-')
    .toLowerCase();
  if (/^en(?:-|$)/.test(tag)) return 'en';
  if (['zh', 'zh-cn', 'zh-sg'].includes(tag) || /^zh-hans(?:-|$)/.test(tag))
    return 'zh-CN';
  return null;
}

/** Explicit stored preferences take precedence over browser preferences. */
export function resolveLocale({ saved, languages = [] } = {}) {
  return (
    normalizeLocale(saved) ||
    languages.map(normalizeLocale).find(Boolean) ||
    'en'
  );
}

export function setLocale(value) {
  activeLocale = normalizeLocale(value) || 'en';
  return activeLocale;
}

export function getLocale() {
  return activeLocale;
}

/** Return plain text; parameters never become executable markup. */
export function translate(key, parameters = {}, locale = activeLocale) {
  const pattern =
    messages[normalizeLocale(locale) || 'en']?.[key] ?? messages.en[key] ?? key;
  return pattern.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (match, name) =>
    Object.hasOwn(parameters, name) ? String(parameters[name]) : match,
  );
}
