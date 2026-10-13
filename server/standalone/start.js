import { fileURLToPath } from 'node:url';
import { createDeploymentServer } from './http-server.js';
import { standaloneVoiceTools } from './voiceTools.js';

// Provider disk caches have historically used the repository working directory.
process.chdir(fileURLToPath(new URL('../../', import.meta.url)));
const server = createDeploymentServer({
  host: process.env.HOST || '127.0.0.1',
  port: process.env.PORT === undefined ? 4173 : Number(process.env.PORT),
  realtime: { tools: standaloneVoiceTools() },
});
let stopping = false;
const stop = async () => {
  if (stopping) return;
  stopping = true;
  try {
    await server.close();
  } catch {
    process.exitCode = 1;
  }
};
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
try {
  const address = await server.listen();
  console.log(`God's Eye View listening on ${address.address}:${address.port}`);
} catch (error) {
  console.error(`Cannot start God's Eye View: ${error.message}`);
  await stop();
  process.exitCode = 1;
}
