/* 반짝 회로 실험실 — 인터넷이 끊겨도 열리도록 앱 파일을 기기에 저장해 둔다. */
const CACHE = 'banjjak-circuit-v3';
const CORE = ['./', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // index.html이 불러오는 빌드 파일(이름에 해시가 붙음)을 찾아 함께 저장한다.
      const res = await fetch('./', { cache: 'no-cache' });
      const html = await res.clone().text();
      const assets = [...html.matchAll(/(?:src|href)="\.\/(assets\/[^"]+)"/g)].map((m) => './' + m[1]);
      await cache.put('./', res);
      await cache.addAll([...CORE.slice(1), ...assets]);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  // 페이지: 인터넷이 되면 새 버전, 안 되면 저장해 둔 버전
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./', copy));
          return res;
        })
        .catch(() => caches.match('./', { ignoreVary: true })),
    );
    return;
  }

  // 그 밖의 파일: 저장해 둔 것을 먼저 쓰고, 없으면 받아서 저장
  event.respondWith(
    caches.match(req, { ignoreVary: true }).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
