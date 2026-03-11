// ============================================================
// NEMA TRADER — SERVICE WORKER (Offline PWA)
// Version: 1.0.0
// ============================================================

const CACHE_NAME = 'nema-trader-v1';
const OFFLINE_URL = 'index.html';

// All files to cache for offline use
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './swapnil.css',
  './swapnil.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  // CDN resources — cached on first load
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/webfonts/fa-solid-900.woff2',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/webfonts/fa-regular-400.woff2',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
];

// ---- INSTALL: cache all assets ----
self.addEventListener('install', event => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching app shell');
        // Cache local files strictly; CDN files best-effort
        const localAssets = ASSETS_TO_CACHE.filter(url => !url.startsWith('http'));
        const cdnAssets   = ASSETS_TO_CACHE.filter(url => url.startsWith('http'));

        return cache.addAll(localAssets).then(() => {
          return Promise.allSettled(
            cdnAssets.map(url => cache.add(url).catch(e => console.warn('[SW] CDN cache miss:', url)))
          );
        });
      })
      .then(() => self.skipWaiting())
  );
});

// ---- ACTIVATE: clean old caches ----
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// ---- FETCH: Cache-first strategy ----
self.addEventListener('fetch', event => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          // Return cached version immediately
          return cachedResponse;
        }

        // Not in cache — fetch from network and cache it
        return fetch(event.request)
          .then(networkResponse => {
            if (!networkResponse || networkResponse.status !== 200) {
              return networkResponse;
            }
            // Clone and store in cache
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
            return networkResponse;
          })
          .catch(() => {
            // Network failed — return offline page for navigation
            if (event.request.mode === 'navigate') {
              return caches.match(OFFLINE_URL);
            }
          });
      })
  );
});

// ---- BACKGROUND SYNC: notify clients of updates ----
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
