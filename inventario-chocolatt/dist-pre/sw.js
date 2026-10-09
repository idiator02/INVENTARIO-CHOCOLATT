/* Generated from this build's exact files. */
const ROOT = new URL('./', self.location.href);
const PREFIX = 'chocolatt-' + ROOT.pathname + '-';
const CACHE = PREFIX + '58c3360a33a42102';
const FILES = ["assets/browser-CB9WaMml.js","assets/firebaseRepository-CrTVvHPv.js","assets/index-B91ubkwf.js","assets/index-Bad0j6T0.css","favicon.svg","icons.svg","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/maskable-512.png","index.html","manifest.webmanifest","pwa-192x192.png","pwa-512x512.png"].map(file => new URL(file, ROOT).href);
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
