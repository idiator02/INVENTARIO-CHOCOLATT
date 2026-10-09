import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
const directory = process.argv[2] || 'dist';
async function filesAt(path, prefix = '') {
  const entries = await readdir(path, { withFileTypes: true });
  return (await Promise.all(entries.map(entry => entry.isDirectory() ? filesAt(join(path, entry.name), `${prefix}${entry.name}/`) : `${prefix}${entry.name}`))).flat();
}
const files = (await filesAt(directory)).filter(name => name !== 'sw.js').sort();
const hash = createHash('sha256');
for (const file of files) { hash.update(file); hash.update(await readFile(join(directory, file))); }
const version = hash.digest('hex').slice(0, 16);
const source = `/* Generated from this build's exact files. */
const ROOT = new URL('./', self.location.href);
const PREFIX = 'chocolatt-' + ROOT.pathname + '-';
const CACHE = PREFIX + '${version}';
const FILES = ${JSON.stringify(files)}.map(file => new URL(file, ROOT).href);
const SHELL = new URL('index.html', ROOT).href;
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES))));
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const name of await caches.keys()) if (name.startsWith(PREFIX) && name !== CACHE) await caches.delete(name);
  await self.clients.claim();
})()));
self.addEventListener('message', event => { if (event.data?.type === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== ROOT.origin || !url.pathname.startsWith(ROOT.pathname)) return;
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (!response.ok) throw new Error('Navigation failed');
        return response;
      } catch { return (await caches.open(CACHE)).match(SHELL, { ignoreVary: true }); }
    })());
    return;
  }
  if (!FILES.includes(url.href)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE), stored = await cache.match(request, { ignoreVary: true });
    return stored || fetch(request);
  })());
});
`;
await writeFile(join(directory, 'sw.js'), source);
console.log(`PWA: ${files.length} archivos, versión ${version}`);
