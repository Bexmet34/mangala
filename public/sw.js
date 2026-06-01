const CACHE_NAME = 'mangala-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  // Let the browser handle standard requests for Vite correctly
  // but cache fallback. We will use a network-first strategy.
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
