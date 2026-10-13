import { applicationHtmlPlugin } from './application-html.js';
import cesium from 'vite-plugin-cesium';
import { DEFAULT_ALLOWED_HOSTS, hostCheckPlugin } from './allowedHosts.js';
import { embedFramingPlugin } from './embed-framing.js';
import { panelBuildPlugin } from './panel.js';

import { BROWSER_HEADERS } from './browser-headers.js';
export { BROWSER_CSP, BROWSER_HEADERS } from './browser-headers.js';

/** Build browser assets with explicit inputs; never load environment or providers. */
export function createBrowserViteConfig({
  plugins = [],
  publicDir,
  googleApiKey,
  cesiumToken,
  mapillaryToken,
  host = 'localhost',
  port = 4173,
  allowedHosts = DEFAULT_ALLOWED_HOSTS,
  command,
} = {}) {
  return {
    plugins: [
      // First, so no provider route answers a Host the server does not allow.
      hostCheckPlugin(),
      cesium(),
      applicationHtmlPlugin(),
      ...plugins,
      embedFramingPlugin(),
      panelBuildPlugin(),
    ],
    ...(publicDir === undefined ? {} : { publicDir }),
    // A production build must not clean the dependency cache a running dev
    // server is still serving optimized module URLs from.
    ...(command === 'build' ? { cacheDir: 'node_modules/.vite-build' } : {}),
    optimizeDeps: {
      // First reached through the SDR worker or a dynamic import. Pre-bundle
      // them at startup so first use cannot invalidate already-transformed
      // URLs with Vite's "Outdated Optimize Dep" 504 response.
      include: [
        '@jtarrio/signals/demod/demodulator.js',
        '@jtarrio/signals/demod/modes.js',
        '@jtarrio/webrtlsdr/rtlsdr.js',
        'egm96-universal',
        // Loaded on demand when the first street-level image opens.
        'mapillary-js',
      ],
    },
    server: {
      host: host || 'localhost',
      port: parseInt(port, 10) || 4173,
      // A wildcard bind only chooses interfaces; it never disables Vite's
      // Host-header check. LAN hostnames are added explicitly (see
      // build/allowedHosts.js); IP addresses are always accepted.
      allowedHosts: [...allowedHosts],
      fs: {
        deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/ENVIRONMENT'],
      },
      // These headers protect the document containing Provider Settings and
      // give the whole page a real Content-Security-Policy (BROWSER_CSP).
      // Embed-mode documents are framable instead: embed-framing.js rewrites
      // only the frame-ancestors directive and keeps the rest of the policy.
      headers: BROWSER_HEADERS,
    },
    // The preview server serves the same documents, so it carries the same
    // framing + CSP hardening (one constant, no drift).
    preview: { headers: BROWSER_HEADERS },
    define: {
      'import.meta.env.GOOGLE_MAPS_API_KEY': JSON.stringify(googleApiKey),
      'import.meta.env.CESIUM_ION_TOKEN': JSON.stringify(cesiumToken),
      // Mapillary client tokens are public by design (see SECURITY.md).
      'import.meta.env.MAPILLARY_CLIENT_TOKEN': JSON.stringify(
        mapillaryToken ?? '',
      ),
    },
    build: { chunkSizeWarningLimit: 1500 },
  };
}
