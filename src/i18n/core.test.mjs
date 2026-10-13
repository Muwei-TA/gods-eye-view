import test from 'node:test';
import assert from 'node:assert/strict';

test('locale aliases distinguish Simplified Chinese from Traditional Chinese', async () => {
  const { normalizeLocale } = await import('./core.js');
  for (const value of ['zh', 'zh-CN', 'zh-SG', 'zh-Hans', 'zh-Hans-CN'])
    assert.equal(normalizeLocale(value), 'zh-CN');
  for (const value of ['zh-TW', 'zh-HK', 'zh-Hant', 'fr', '', null])
    assert.equal(normalizeLocale(value), null);
  assert.equal(normalizeLocale('en-US'), 'en');
});
test('explicit preference wins and unavailable browser locales fall back', async () => {
  const { resolveLocale } = await import('./core.js');
  assert.equal(resolveLocale({ saved: 'en', languages: ['zh-CN'] }), 'en');
  assert.equal(resolveLocale({ saved: 'zh-CN', languages: ['en'] }), 'zh-CN');
  assert.equal(
    resolveLocale({ saved: 'invalid', languages: ['fr', 'zh-Hans'] }),
    'zh-CN',
  );
  assert.equal(resolveLocale({ languages: ['zh-TW'] }), 'en');
});
test('messages preserve literal parameters and fall back to English', async () => {
  const { translate } = await import('./core.js');
  assert.equal(translate('language.label', {}, 'zh-CN'), '语言');
  assert.equal(translate('language.label', {}, 'en'), 'Language');
  assert.equal(
    translate('status.error', { detail: '<script>x</script>' }, 'zh-CN'),
    '错误：<script>x</script>',
  );
  assert.equal(translate('language.label', {}, 'unknown'), 'Language');
  assert.equal(translate('missing.key', {}, 'zh-CN'), 'missing.key');
});
