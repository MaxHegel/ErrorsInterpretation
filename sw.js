/* Service worker: офлайн-книга.
   Навигации — network-first (no-store) с фолбэком к index.html → всегда свежая оболочка.
   Хэшированные ассеты (immutable) — stale-while-revalidate.
   VERSION подставляется на сборке (хэш index.html): каждый деплой = новое имя кэша,
   старый кэш удаляется при activate → нет устаревших бандлов у пользователя. */
const VERSION = 'tolk-PfDRZnvw';
const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Навигации: всегда свежий index.html из сети (no-store — мимо HTTP-кэша),
  // при офлайне отдаём сохранённый index.html
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req, { cache: 'no-store' })
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put('./index.html', copy));
          }
          return res;
        })
        .catch(() =>
          caches.match('./index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  // Статика и данные: stale-while-revalidate
  e.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
