import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import puppeteer from 'puppeteer';

const urlIndex = process.argv.indexOf('--url');
const url = urlIndex < 0 ? 'http://127.0.0.1:4173' : process.argv[urlIndex + 1];
const browser = await puppeteer.launch({
  ...(process.env.PUPPETEER_EXECUTABLE_PATH
    ? { executablePath: process.env.PUPPETEER_EXECUTABLE_PATH }
    : {}),
  headless: true,
  args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader'],
});
await mkdir('qa-artifacts/i18n', { recursive: true });
try {
  for (const locale of ['en', 'zh-CN']) {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.setViewport({ width: 1440, height: 960 });
    await page.evaluateOnNewDocument((value) => {
      localStorage.setItem('gev.ui.language', value);
      localStorage.removeItem('gev.firstRun.suppressed');
    }, locale);
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(
      (value) =>
        document.documentElement.lang === value &&
        document.querySelector('#language-select')?.value === value,
      { timeout: 30000 },
      locale,
    );
    assert.equal(
      await page.$eval('#first-run-title', (el) => el.textContent),
      locale === 'en' ? 'Choose your first view' : '选择初始视角',
    );
    assert.equal(
      await page.$eval('#language-control > span', (el) => el.textContent),
      locale === 'en' ? 'Language' : '语言',
    );
    assert.equal(
      await page
        .$eval('#location-search', (el) => el.placeholder)
        .catch(() => ''),
      locale === 'en' ? 'Search any location...' : '搜索任意位置……',
    );
    const dynamic = await page.evaluate(async () => {
      const { LayerPanel } = await import('/src/ui/layerPanel.js');
      const { keySetupChipLabel } = await import('/src/keySetup.js');
      const button = document.createElement('button');
      LayerPanel.prototype._syncToggleButton(button, {
        id: 'ais-live-vessels',
        name: 'Live Vessels',
        enabled: true,
        stats: { partial: true, count: 2, acceptedRowCount: 2, rawRowCount: 3 },
      });
      return {
        feed: button.textContent,
        chip: keySetupChipLabel({ total: 3, setCount: 1 }),
      };
    });
    assert.equal(dynamic.feed, locale === 'en' ? 'PARTIAL' : '部分可用');
    assert.equal(
      dynamic.chip,
      locale === 'en' ? 'POWER UP · 2 KEYS WAITING' : '待配置 · 2 个密钥',
    );
    const icons = await page.$$eval('.material-symbols-outlined', (elements) =>
      elements.map((el) => el.textContent.trim()),
    );
    assert.ok(icons.includes('radar') && icons.includes('layers_clear'));
    assert.ok(
      icons.every((icon) => !/[\u4e00-\u9fff]/.test(icon)),
      'Icon ligatures must never be translated',
    );
    const ids = await page.$$eval('[data-first-run-choice]', (nodes) =>
      nodes.map((n) => n.dataset.firstRunChoice),
    );
    assert.deepEqual(ids, [
      'contacts',
      'space-missions',
      'environmental',
      'explore',
    ]);
    const localIcons = await page.evaluate(async () => {
      const faces = await document.fonts.load(
        '24px "GEV Material Symbols"',
        'radar',
      );
      return faces.some((face) => face.status === 'loaded');
    });
    assert.ok(
      localIcons,
      'Icons must load from the bundled font even when Google Fonts is blocked',
    );
    await page.screenshot({ path: `qa-artifacts/i18n/${locale}-desktop.png` });
    await page.setViewport({ width: 390, height: 844 });
    assert.ok(
      await page.$eval('#language-select', (el) => {
        const r = el.getBoundingClientRect();
        return r.left >= 0 && r.right <= innerWidth && r.top >= 0;
      }),
      'Language selector must be reachable on narrow screens',
    );
    await page.screenshot({ path: `qa-artifacts/i18n/${locale}-mobile.png` });
    assert.deepEqual(
      errors,
      [],
      'Application JavaScript must start without errors',
    );
    await page.close();
    console.log(
      `PASS: ${locale} startup, controls, accessibility, icons and narrow layout`,
    );
  }
} finally {
  await browser.close();
}
