/* DRC Hub service worker — keeps the app auto-updating.
   Strategy:
   • The app page (HTML) is fetched fresh from the network every time you open
     it (so you always get the latest version when online).
   • Other files (icon, manifest, video) are served from cache for speed, and
     fall back to the network the first time.
   • Offline, everything falls back to the last cached copy. */
const CACHE = 'drc-app-v1';

self.addEventListener('install', e => self.skipWaiting());

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  // only handle same-origin GETs; let Supabase / CDN requests pass through untouched
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  const isDoc = req.mode === 'navigate'
    || req.destination === 'document'
    || url.pathname.endsWith('.html')
    || url.pathname.endsWith('/');

  if (isDoc) {
    // network-first: always try to get the newest app, fall back to cache offline
    e.respondWith(
      fetch(req, { cache: 'no-store' })
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
  } else {
    // cache-first for assets (icon, manifest, video) — fast, no re-downloads
    e.respondWith(
      caches.match(req).then(hit =>
        hit || fetch(req).then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
          return res;
        })
      )
    );
  }
});
