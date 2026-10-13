import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';

async function fixture(t, options = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'gev-server-'));
  await mkdir(path.join(root, 'dist', 'assets'), { recursive: true });
  await writeFile(
    path.join(root, 'dist', 'index.html'),
    '<!doctype html><title>GEV fixture</title>',
  );
  await writeFile(
    path.join(root, 'dist', 'assets', 'app.js'),
    'globalThis.fixture = true;',
  );
  const { createDeploymentServer } =
    await import('../server/standalone/http-server.js');
  const server = createDeploymentServer({
    root,
    host: '127.0.0.1',
    port: 0,
    providers: [],
    ...options,
  });
  const address = await server.listen();
  const base = `http://127.0.0.1:${address.port}`;
  t.after(async () => {
    await server.close();
    await rm(root, { recursive: true, force: true });
  });
  return { root, server, base };
}

test('deployment refuses startup without built assets', async () => {
  const { createDeploymentServer } =
    await import('../server/standalone/http-server.js');
  assert.throws(
    () => createDeploymentServer({ root: '/does-not-exist', providers: [] }),
    /build|dist/i,
  );
});
test('built HTML, assets and health are served with browser protections', async (t) => {
  const { base } = await fixture(t);
  const page = await fetch(base + '/');
  assert.equal(page.status, 200);
  assert.match(await page.text(), /GEV fixture/);
  assert.equal(page.headers.get('x-content-type-options'), 'nosniff');
  assert.match(
    page.headers.get('content-security-policy'),
    /frame-ancestors 'none'/,
  );
  const asset = await fetch(base + '/assets/app.js');
  assert.match(asset.headers.get('content-type'), /javascript/);
  assert.match(await asset.text(), /fixture/);
  assert.equal((await fetch(base + '/missing.js')).status, 404);
  assert.deepEqual(await (await fetch(base + '/healthz')).json(), {
    status: 'ok',
  });
});
test('unknown API and dev-only configuration stay JSON 404', async (t) => {
  const { base } = await fixture(t);
  for (const endpoint of [
    '/api/unknown',
    '/api/setup/status',
    '/api/setup/keys',
    '/mcp',
  ]) {
    const response = await fetch(base + endpoint);
    assert.equal(response.status, 404, endpoint);
    assert.match(response.headers.get('content-type'), /json/);
    assert.ok((await response.json()).error);
  }
});
test('host checking runs before provider routes', async (t) => {
  const { base } = await fixture(t);
  const status = await new Promise((resolve, reject) => {
    http
      .get(
        base + '/healthz',
        { headers: { Host: 'untrusted.example' } },
        (response) => {
          response.resume();
          resolve(response.statusCode);
        },
      )
      .on('error', reject);
  });
  assert.equal(status, 403);
});
test('dotenv, encoded paths, source and escaping symlinks cannot be served', async (t) => {
  const { base, root } = await fixture(t);
  await writeFile(path.join(root, 'outside.txt'), 'private fixture');
  await writeFile(path.join(root, 'dist', '.env.local'), 'private fixture');
  await symlink(
    path.join(root, 'outside.txt'),
    path.join(root, 'dist', 'escape.txt'),
  );
  await symlink(
    path.join(root, 'outside.txt'),
    path.join(root, 'dist', 'escape.html'),
  );
  for (const requestPath of [
    '/.env.local',
    '/%2eenv.local',
    '/src/main.js',
    '/escape.txt',
    '/escape.html',
    '/escape',
  ]) {
    const response = await fetch(base + requestPath);
    assert.ok([403, 404].includes(response.status), requestPath);
    assert.doesNotMatch(await response.text(), /private fixture/);
  }
  const port = Number(new URL(base).port);
  const status = await new Promise((resolve, reject) => {
    http
      .get(
        {
          hostname: '127.0.0.1',
          port,
          path: '/assets/%2e%2e/%2e%2e/outside.txt',
        },
        (response) => {
          response.resume();
          resolve(response.statusCode);
        },
      )
      .on('error', reject);
  });
  assert.equal(status, 403);
});
test('shared provider registration serves a real keyless transit catalog and cleans up', async (t) => {
  const { transitProxy } = await import('../server/providers/transit.js');
  const provider = transitProxy({
    fetchImpl() {
      throw new Error('Catalog must not call upstream');
    },
  });
  // The production installation interface uses the same middleware as Vite.
  provider.install = provider.configurePreviewServer;
  const { base, server } = await fixture(t, { providers: [provider] });
  const response = await fetch(base + '/api/transit/feeds');
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.ok(result.feeds.some((feed) => feed.id === 'mbta'));
  await server.close();
  await server.close();
});
