import test from 'node:test';
import assert from 'node:assert/strict';
import { renderRadioState } from './radioPresentation.js';
import { railFixture } from './railTestFixture.mjs';
import { setLocale } from '../i18n/core.js';

test('Chinese radio state updates localize playback, accessibility and lifecycle feedback', () => {
  const { document } = railFixture();
  document.getElementById = () => null;
  const previousDocument = globalThis.document;
  globalThis.document = document;
  setLocale('zh-CN');
  const host = {
    _radioPanel: document.createElement('section'),
    _radioPlayBtn: document.createElement('button'),
    _contextRadioMiniPlayBtn: document.createElement('button'),
    _cockpitRadioPlayBtn: document.createElement('button'),
    _radioPlaybackState: document.createElement('div'),
    _radioEnableBtn: document.createElement('button'),
    actions: { getLifecycle: () => null, scheduleLayout() {} },
    _syncContextRadioLauncherState() {},
  };
  const state = { enabled: true, categories: [], filteredCount: 1, stationCount: 1, selected: { name: 'BBC' }, volume: 1, selectedIndex: 0 };
  try {
    for (const [audioState, action, feedback] of [
      ['stopped', '播放', '就绪：只有执行播放操作后才会开始播放'],
      ['playing', '暂停', '正在播放 BBC'],
      ['paused', '继续', '已暂停 BBC'],
    ]) {
      renderRadioState.call(host, { ...state, audioState });
      assert.equal(host._radioPlayBtn.textContent, action);
      assert.equal(host._radioPlaybackState.textContent, feedback);
      for (const node of [host._radioPlayBtn, host._contextRadioMiniPlayBtn, host._cockpitRadioPlayBtn]) {
        assert.equal(node.getAttribute('aria-label'), `${action}所选电台`);
      }
      assert.equal(host._cockpitRadioPlayBtn.title, action);
    }
    renderRadioState.call(host, { ...state, selected: null, audioState: 'stopped', degraded: true, stale: true });
    assert.equal(host._radioPlayBtn.getAttribute('aria-label'), '播放最近电台');
    assert.match(host._radioPlaybackState.textContent, /目录已过期且服务降级/);
    host.actions.getLifecycle = () => ({ enabled: true, lifecycleState: 'enabling' });
    renderRadioState.call(host, { ...state, audioState: 'stopped' });
    assert.equal(host._radioEnableBtn.textContent, '正在启用');
    assert.equal(host._radioPlaybackState.textContent, '正在启用广播……');
  } finally {
    globalThis.document = previousDocument;
    setLocale('en');
  }
});
