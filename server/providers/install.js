import { localProviderPlugins } from './local.js';

/** Register provider middleware against an explicit HTTP host shared with Vite.
 * The host owns a Connect-compatible middleware stack and an HTTP close event.
 */
export function installProviderMiddleware(host, { providers, realtime } = {}) {
  const supplied = providers ?? localProviderPlugins({ realtime });
  let disposed = false;
  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    for (const provider of supplied) {
      if (typeof provider.closeBundle === 'function') provider.closeBundle();
    }
  };
  try {
    for (const provider of supplied) {
      if (typeof provider.install !== 'function')
        throw new TypeError(
          `Provider ${provider.name || 'unknown'} has no installer`,
        );
      provider.install(host);
    }
  } catch (error) {
    cleanup();
    throw error;
  }
  host.httpServer?.once('close', cleanup);
  return cleanup;
}
