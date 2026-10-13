import { translate } from '../i18n/core.js';
import { keySetupRequirement } from '../keySetupCore.mjs';

// Street Level UI state to panel strings and flags. Pure, so it is testable.

const DAY_MS = 86_400_000;

/** SINCE slider stops, in relative days so a share link keeps its meaning. */
export const SINCE_STOPS = Object.freeze([
  Object.freeze({ days: 0, label: translate('ui.any_date') }),
  Object.freeze({ days: 3652, label: translate('ui.last_10_years') }),
  Object.freeze({ days: 1826, label: translate('ui.last_5_years') }),
  Object.freeze({ days: 1095, label: translate('ui.last_3_years') }),
  Object.freeze({ days: 730, label: translate('ui.last_2_years') }),
  Object.freeze({ days: 365, label: translate('ui.last_year') }),
  Object.freeze({ days: 182, label: translate('ui.last_6_months') }),
  Object.freeze({ days: 91, label: translate('ui.last_3_months') }),
  Object.freeze({ days: 30, label: translate('ui.last_month') }),
]);

/** The exact stop for a day count, else the nearest one. */
export function sinceStopIndex(days) {
  const value = Number(days) || 0;
  if (value <= 0) return 0;
  let best = 1;
  for (let i = 1; i < SINCE_STOPS.length; i++)
    if (
      Math.abs(SINCE_STOPS[i].days - value) <
      Math.abs(SINCE_STOPS[best].days - value)
    )
      best = i;
  return best;
}

function presentSince(days, now) {
  const value = Number(days) || 0;
  const index = sinceStopIndex(value);
  if (value <= 0) return { index, days: 0, label: translate('ui.any_date') };
  const stop = SINCE_STOPS[index];
  const window = stop.days === value ? stop.label : `LAST ${value} DAYS`;
  return {
    index,
    days: value,
    label: translate('ui.p0_since_p1', {
      p0: window,
      p1: formatDate(now - value * DAY_MS),
    }),
  };
}

function formatDate(ms) {
  if (!Number.isFinite(ms)) return '';
  try {
    return new Date(ms).toISOString().slice(0, 10);
  } catch {
    return '';
  }
}

function presentStatus(state) {
  const pressed = state.enabled === true;
  const title = pressed ? 'Turn Street Level off' : 'Turn Street Level on';
  if (state.keyRejected)
    return { text: 'KEY REJECTED', tone: 'warn', pressed, title };
  if (state.keyRequired)
    return { text: 'KEY REQUIRED', tone: 'warn', pressed, title };
  if (state.coverage.loading)
    return { text: 'LOADING', tone: 'busy', pressed, title };
  return pressed
    ? { text: 'ON', tone: 'on', pressed, title }
    : { text: 'OFF', tone: '', pressed, title };
}

/** A chip is lit only while the layer and its provider are both on. */
function presentProviders(state) {
  const enabled = state.enabled === true;
  return (state.providers || []).map((provider) => {
    const keyRequired = provider.keyRequired === true;
    const on = enabled && provider.on === true;
    let title = `${provider.name} imagery ${on ? 'on' : 'off'}`;
    if (provider.keyRejected && provider.error)
      title = `${provider.name}: ${provider.error}`;
    else if (keyRequired && provider.requiresKeyId)
      title = `${provider.name}: ${keySetupRequirement(provider.requiresKeyId)}`;
    else if (provider.error) title = `${provider.name}: ${provider.error}`;
    return {
      id: provider.id,
      label: provider.label,
      color: provider.color || null,
      title,
      active: on,
      disabled: false,
      state: keyRequired
        ? 'error'
        : on && provider.loading
          ? 'loading'
          : on
            ? 'active'
            : 'idle',
      busy: on && provider.loading === true,
    };
  });
}

function presentViewer(state) {
  const { street } = state;
  const right = [];
  if (street.isPano) right.push('360°');
  if (Number.isFinite(street.bearing))
    right.push(`${Math.round(street.bearing)}°`);
  if (street.capturedAt) right.push(formatDate(street.capturedAt));
  return {
    open: street.open === true,
    loading: street.loading === true && !street.imageId,
    renderMode: street.renderMode === 'fill' ? 'fill' : 'letterbox',
    captionLeft: street.creator ? `Image by ${street.creator}` : '',
    captionRight: right.join(' · '),
    link: street.externalUrl || null,
    linkLabel: street.providerLabel ? `${street.providerLabel} ↗` : '',
    follow: {
      pressed: street.follow === true,
      disabled: street.open !== true || street.followAvailable !== true,
      title:
        street.followAvailable === true
          ? translate(
              'ui.camera_follows_view_move_the_globe_camera_wherever_the_street_level_vi',
            )
          : translate(
              'ui.camera_follow_needs_the_google_3d_map_choose_google_3d_under_map_sourc',
            ),
    },
  };
}

function presentMeta(state) {
  if (state.providers.length === 0) return state.coverage.hint || '';
  if (!state.enabled) return 'Switch a provider on to draw its coverage.';
  if (state.sequence.selectedId)
    return state.sequence.loading
      ? 'Loading this sequence…'
      : `${state.sequence.images.toLocaleString()} images in this sequence · Esc clears`;
  if (state.coverage.count > 0)
    return `${state.coverage.count.toLocaleString()} sequences in view · click a line for its photos`;
  return state.coverage.hint || '';
}

/** @param {{now?: number}} [options] Clock for the SINCE readout. */
export function presentStreetLevelPanel(state, { now = Date.now() } = {}) {
  const enabled = state.enabled === true;
  const keyRequired = state.keyRequired === true;
  const filter = state.filter || { pano: 'all', sinceDays: 0 };
  // A missing key is already shown by the status and chip tooltip; only a
  // rejected key keeps its error line, since that message names the fix.
  const keyMissing = keyRequired && state.keyRejected !== true;
  return {
    enabled,
    keyRequired,
    status: presentStatus(state),
    controlsDisabled: keyRequired || state.providers.length === 0,
    providers: presentProviders(state),
    error: keyMissing
      ? null
      : state.street.error || state.coverage.error || null,
    filter: { pano: filter.pano, sinceDays: Number(filter.sinceDays) || 0 },
    since: presentSince(filter.sinceDays, now),
    legend: state.legend || [],
    viewer: presentViewer(state),
    meta: presentMeta(state),
    wantsOpen: state.street.open === true,
  };
}
