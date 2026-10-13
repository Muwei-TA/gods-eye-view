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
    await page.waitForFunction(
      () => window.__godsEyeView?.viewer && window.__godsEyeView?.dataManager,
      { timeout: 60000 },
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
    const panelUpdates = await page.evaluate(async () => {
      const { renderRadioState } = await import('/src/ui/radioPresentation.js');
      const { createWeatherPanel } = await import('/src/ui/weatherPanel.js');
      const host = {
        _radioPanel: document.getElementById('radio-panel'),
        _radioPlayBtn: document.getElementById('radio-play-btn'),
        _radioPlaybackState: document.getElementById('radio-playback-state'),
        _contextRadioMiniPlayBtn: document.getElementById('context-radio-mini-play-btn'),
        _cockpitRadioPlayBtn: document.getElementById('cockpit-radio-play-btn'),
        actions: { getLifecycle: () => null, scheduleLayout() {} },
        _syncContextRadioLauncherState() {},
      };
      const radio = [];
      for (const audioState of ['playing', 'paused', 'stopped']) {
        renderRadioState.call(host, { enabled: true, audioState, selected: { name: 'BBC' }, categories: [], stationCount: 1, filteredCount: 1, selectedIndex: 0, volume: 1 });
        radio.push({ text: host._radioPlayBtn.textContent, aria: host._radioPlayBtn.getAttribute('aria-label'), feedback: host._radioPlaybackState.textContent });
      }
      const ticks = ['2026-09-22T01:00:00Z', '2026-09-22T01:05:00Z'];
      let state = { mode: 'latest', timeline: ticks, products: [] };
      let notify;
      const panel = createWeatherPanel({
        container: document.getElementById('weather-panel-body'),
        clock: { getState: () => state, subscribe: (fn) => { notify = fn; return () => {}; } },
      });
      panel.update([
        { id: 'wind', summary: { label: 'Wind motion', validTime: ticks[0], issuedTime: ticks[0] } },
        { id: 'weather-radar', summary: { label: 'Rain radar' } },
      ]);
      const root = document.querySelector('#weather-panel-body .weather-readout:last-child');
      const latest = root.querySelector('.rail-timeline-readout').textContent;
      const forecast = root.querySelector('[data-card-id="wind"] [data-line-id="time"]').textContent;
      state = { ...state, mode: 'history', target: ticks[1], products: [{ id: 'weather-radar', selected: null }] };
      notify(state);
      const missing = root.querySelector('[data-card-id="weather-radar"] [data-line-id="time"]').textContent;
      panel.destroy();
      return { radio, latest, forecast, missing, brand: document.querySelector('#title-bar h1').innerText.trim() };
    });
    assert.deepEqual(panelUpdates.radio.map(({ text }) => text), locale === 'en' ? ['PAUSE', 'RESUME', 'PLAY'] : ['暂停', '继续', '播放']);
    assert.deepEqual(panelUpdates.radio.map(({ aria }) => aria), locale === 'en' ? ['Pause selected radio station', 'Resume selected radio station', 'Play selected radio station'] : ['暂停所选电台', '继续所选电台', '播放所选电台']);
    assert.equal(panelUpdates.latest, locale === 'en' ? 'LATEST · newest per product' : '最新 · 每个产品的最新画面');
    assert.match(panelUpdates.forecast, locale === 'en' ? /Forecast · valid .* · issued/ : /预报 · 有效时间 .* · 发布时间/);
    assert.equal(panelUpdates.missing, locale === 'en' ? 'No frame within 30 min of 01:05 UTC' : '01:05 UTC 前后 30 分钟内没有画面');
    assert.equal(panelUpdates.brand, "GOD'S EYE VIEW");
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
