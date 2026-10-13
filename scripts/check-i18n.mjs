import { readdir, readFile } from 'node:fs/promises';
import { messages } from '../src/i18n/messages.js';

const keys = Object.keys(messages.en).sort();
if (
  JSON.stringify(keys) !== JSON.stringify(Object.keys(messages['zh-CN']).sort())
)
  throw new Error('Locale catalog keys differ');
const slots = (text) =>
  [...text.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)].map((m) => m[1]).sort();
for (const key of keys) {
  if (
    JSON.stringify(slots(messages.en[key])) !==
    JSON.stringify(slots(messages['zh-CN'][key]))
  )
    throw new Error(`Parameter mismatch: ${key}`);
}
let references = 0;
for (const file of await readdir(
  new URL('../src/ui/templates/', import.meta.url),
)) {
  if (!file.endsWith('.html')) continue;
  const source = await readFile(
    new URL(`../src/ui/templates/${file}`, import.meta.url),
    'utf8',
  );
  for (const match of source.matchAll(
    /data-i18n(?:-(?:title|placeholder|aria-label|alt))?="([^"]+)"/g,
  )) {
    if (!Object.hasOwn(messages.en, match[1]))
      throw new Error(`${file}: unknown key ${match[1]}`);
    references++;
  }
}
console.log(
  `PASS: ${keys.length} aligned messages, ${references} explicit template references`,
);
