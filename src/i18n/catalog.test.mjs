import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { messages } from './messages.js';
import { translate } from './core.js';

test('core user journeys have Simplified Chinese copy', () => {
  assert.equal(
    translate('ui.choose_your_first_view', {}, 'zh-CN'),
    '选择初始视角',
  );
  assert.equal(translate('ui.data_layers', {}, 'zh-CN'), '数据图层');
  assert.equal(translate('ui.save_keys', {}, 'zh-CN'), '保存密钥');
});
test('both catalogs have the same keys and named parameters', () => {
  assert.deepEqual(
    Object.keys(messages.en).sort(),
    Object.keys(messages['zh-CN']).sort(),
  );
  const placeholders = (value) =>
    [...value.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)].map((m) => m[1]).sort();
  for (const [key, value] of Object.entries(messages.en)) {
    assert.equal(typeof messages['zh-CN'][key], 'string', key);
    assert.deepEqual(
      placeholders(value),
      placeholders(messages['zh-CN'][key]),
      key,
    );
  }
});
test('templates explicitly mark all translated controls and reference real keys', async () => {
  let count = 0;
  for (const name of await readdir(
    new URL('../ui/templates/', import.meta.url),
  )) {
    if (!name.endsWith('.html')) continue;
    const source = await readFile(
      new URL(`../ui/templates/${name}`, import.meta.url),
      'utf8',
    );
    for (const match of source.matchAll(
      /data-i18n(?:-(?:title|placeholder|aria-label|alt))?="([^"]+)"/g,
    )) {
      assert.ok(Object.hasOwn(messages.en, match[1]), `${name}: ${match[1]}`);
      count++;
    }
  }
  assert.ok(count >= 300, `Only ${count} explicit translated controls`);
});

test('provider chip reports missing keys in Chinese without changing the counts', async () => {
  const { setLocale } = await import('./core.js');
  const { keySetupChipLabel } = await import('../keySetup.js');
  try {
    setLocale('zh-CN');
    assert.equal(
      keySetupChipLabel({ total: 3, setCount: 1 }),
      '待配置 · 2 个密钥',
    );
    assert.equal(keySetupChipLabel({ total: 3, setCount: 3 }), '已配置');
  } finally {
    setLocale('en');
  }
});
