import http from 'node:http';
import path from 'node:path';
import { existsSync, realpathSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import connect from 'connect';
import sirv from 'sirv';
import { BROWSER_HEADERS } from '../../build/browser-headers.js';
import {
  isAllowedHost,
  resolveAllowedHosts,
} from '../../build/allowedHosts.js';
import { installProviderMiddleware } from '../providers/install.js';

const defaultRoot = fileURLToPath(new URL('../../', import.meta.url));
const json = (response, status, body) => {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(body));
};

/** Serve only the built frontend, with the existing provider APIs. */
export function createDeploymentServer({
  root = defaultRoot,
  host = '127.0.0.1',
  port = 4173,
  allowedHosts = resolveAllowedHosts(process.env.GEV_ALLOWED_HOSTS),
  providers,
  realtime,
} = {}) {
  const directory = path.join(root, 'dist');
  if (!existsSync(path.join(directory, 'index.html')))
    throw new Error('Missing dist/index.html; run npm run build first');
  const staticRoot = realpathSync(directory);
  if (
    !Number.isInteger(Number(port)) ||
    Number(port) < 0 ||
    Number(port) > 65535
  )
    throw new RangeError('PORT must be an integer between 0 and 65535');
  const app = connect();
  const server = http.createServer(app);
  server.headersTimeout = 15000;
  server.requestTimeout = 30000;
  const middlewares = {
    use(...args) {
      const handler = args.pop();
      app.use(...args, (request, response, next) => {
        try {
          Promise.resolve(handler(request, response, next)).catch(next);
        } catch (error) {
          next(error);
        }
      });
      return this;
    },
  };
  app.use((request, response, next) => {
    for (const [key, value] of Object.entries(BROWSER_HEADERS))
      response.setHeader(key, value);
    if (!isAllowedHost(request.headers.host, allowedHosts, [host]))
      return json(response, 403, {
        error: 'Blocked request. This host is not allowed.',
      });
    // Fragments are not part of an HTTP request target. Reject them before
    // downstream parsers can disagree about the path being validated.
    if (request.url?.includes('#'))
      return json(response, 400, { error: 'Malformed path' });
    next();
  });
  app.use((request, response, next) => {
    if (request.url?.split('?')[0] !== '/healthz') return next();
    if (!['GET', 'HEAD'].includes(request.method))
      return json(response, 405, { error: 'Method not allowed' });
    const ready = existsSync(path.join(staticRoot, 'index.html'));
    json(response, ready ? 200 : 503, { status: ready ? 'ok' : 'unavailable' });
  });
  const dispose = installProviderMiddleware(
    { middlewares, httpServer: server },
    { providers, realtime },
  );
  app.use((request, response, next) => {
    const pathname = request.url?.split('?')[0] || '/';
    if (
      pathname === '/api' ||
      pathname.startsWith('/api/') ||
      pathname === '/mcp' ||
      pathname.startsWith('/mcp/')
    )
      return json(response, 404, { error: 'Unknown API route' });
    next();
  });
  app.use((request, response, next) => {
    if (!['GET', 'HEAD'].includes(request.method))
      return json(response, 405, { error: 'Method not allowed' });
    let pathname;
    try {
      pathname = decodeURIComponent((request.url || '/').split('?')[0]);
    } catch {
      return json(response, 400, { error: 'Malformed path' });
    }
    if (
      pathname.includes('\0') ||
      pathname.includes('\\') ||
      pathname.split('/').some((segment) => segment.startsWith('.'))
    )
      return json(response, 403, { error: 'Forbidden path' });
    if (pathname === '/') {
      pathname = '/index.html';
      request.url =
        '/index.html' +
        ((request.url || '').includes('?')
          ? request.url.slice(request.url.indexOf('?'))
          : '');
    }
    const candidate = path.resolve(staticRoot, '.' + pathname);
    if (
      candidate !== staticRoot &&
      !candidate.startsWith(staticRoot + path.sep)
    )
      return json(response, 403, { error: 'Forbidden path' });
    // A generated asset may be a symlink. Resolve it before the static server
    // can follow a link outside the one directory we permit it to serve.
    if (existsSync(candidate)) {
      if (statSync(candidate).isDirectory())
        return json(response, 404, { error: 'Not found' });
      const real = realpathSync(candidate);
      if (real !== staticRoot && !real.startsWith(staticRoot + path.sep))
        return json(response, 403, { error: 'Forbidden path' });
    }
    next();
  });
  app.use(
    sirv(staticRoot, {
      dev: true,
      dotfiles: false,
      etag: true,
      single: false,
      extensions: [],
    }),
  );
  app.use((_request, response) => json(response, 404, { error: 'Not found' }));
  app.use((_error, _request, response, _next) => {
    if (!response.headersSent)
      json(response, 500, { error: 'Internal server error' });
    else response.destroy();
  });
  let closing;
  return {
    httpServer: server,
    listen() {
      if (closing) return Promise.reject(new Error('Server is closed'));
      return new Promise((resolve, reject) => {
        const onError = (error) => {
          server.off('listening', onListen);
          reject(error);
        };
        const onListen = () => {
          server.off('error', onError);
          resolve(server.address());
        };
        server.once('error', onError);
        server.once('listening', onListen);
        server.listen(Number(port), host);
      });
    },
    close() {
      if (closing) return closing;
      closing = new Promise((resolve, reject) => {
        dispose();
        const deadline = setTimeout(() => server.closeAllConnections(), 5000);
        deadline.unref();
        server.close((error) => {
          clearTimeout(deadline);
          if (error && error.code !== 'ERR_SERVER_NOT_RUNNING') reject(error);
          else resolve();
        });
        server.closeIdleConnections();
      });
      return closing;
    },
  };
}
