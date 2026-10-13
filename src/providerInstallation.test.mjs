import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';

test('provider host has explicit registration and idempotent cleanup', async () => {
  const { installProviderMiddleware } =
    await import('../server/providers/install.js');
  const httpServer = new EventEmitter();
  const middlewares = { use() {} };
  let installs = 0,
    disposals = 0;
  const cleanup = installProviderMiddleware(
    { httpServer, middlewares },
    {
      providers: [
        {
          install(host) {
            assert.equal(host.middlewares, middlewares);
            installs++;
          },
          closeBundle() {
            disposals++;
          },
        },
      ],
    },
  );
  assert.equal(installs, 1);
  httpServer.emit('close');
  cleanup();
  assert.equal(disposals, 1);
});
test('all shipped deployment providers expose the shared installer', async () => {
  const { localProviderPlugins } = await import('../server/providers/local.js');
  const providers = localProviderPlugins();
  assert.ok(providers.length > 20);
  assert.ok(
    providers.every((provider) => typeof provider.install === 'function'),
  );
  assert.ok(
    providers.every((provider) => provider.name !== 'key-setup-endpoint'),
  );
});
