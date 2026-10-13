import test from 'node:test';
import assert from 'node:assert/strict';

function fixture() {
  const listeners = new Map();
  const text = {
    dataset: { i18n: 'language.label' },
    children: [],
    textContent: 'Language',
  };
  const icon = { textContent: 'public' };
  const container = {
    dataset: { i18n: 'language.label' },
    children: [icon],
    textContent: 'public',
  };
  const attrs = {};
  const title = {
    dataset: { i18nTitle: 'language.label' },
    setAttribute: (name, value) => {
      attrs[name] = value;
    },
  };
  const selector = {
    value: '',
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: (name) => listeners.delete(name),
  };
  const document = {
    documentElement: {},
    querySelector: () => selector,
    querySelectorAll: (query) =>
      query === '[data-i18n]'
        ? [text, container]
        : query === '[data-i18n-title]'
          ? [title]
          : [],
  };
  return { document, selector, text, icon, attrs, listeners };
}
test('startup translates explicit text and attributes without destroying icons', async () => {
  const { initializeLanguage } = await import('./dom.js');
  const f = fixture();
  const session = initializeLanguage({
    document: f.document,
    storage: { getItem: () => null },
    navigator: { languages: ['zh-CN'] },
    reload() {},
  });
  assert.equal(f.document.documentElement.lang, 'zh-CN');
  assert.equal(f.text.textContent, '语言');
  assert.equal(f.attrs.title, '语言');
  assert.equal(f.icon.textContent, 'public');
  session.dispose();
  assert.equal(f.listeners.size, 0);
});
test('preference survives selection and reload is requested once', async () => {
  const { initializeLanguage, LANGUAGE_STORAGE_KEY } = await import('./dom.js');
  const f = fixture();
  const written = [];
  let reloads = 0;
  initializeLanguage({
    document: f.document,
    storage: { getItem: () => 'en', setItem: (...args) => written.push(args) },
    navigator: { languages: ['zh'] },
    reload: () => reloads++,
  });
  assert.equal(f.selector.value, 'en');
  f.selector.value = 'zh-CN';
  f.listeners.get('change')();
  assert.deepEqual(written, [[LANGUAGE_STORAGE_KEY, 'zh-CN']]);
  assert.equal(reloads, 1);
});
test('blocked localStorage still allows startup and language selection', async () => {
  const { initializeLanguage } = await import('./dom.js');
  const f = fixture();
  let reloads = 0;
  initializeLanguage({
    document: f.document,
    storage: {
      getItem() {
        throw new Error('blocked');
      },
      setItem() {
        throw new Error('blocked');
      },
    },
    navigator: { languages: ['en'] },
    reload: () => reloads++,
  });
  f.selector.value = 'zh-CN';
  f.listeners.get('change')();
  assert.equal(f.document.documentElement.lang, 'zh-CN');
  assert.equal(f.text.textContent, '语言');
  assert.equal(reloads, 0);
});
