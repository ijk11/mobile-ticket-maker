/* 모바일 티켓 메이커 - 서비스워커
   앱 껍데기를 캐시에 넣어 비행기 모드에서도 열리게 한다.
   전략: 먼저 캐시로 바로 그리고, 뒤에서 네트워크로 조용히 갱신(stale-while-revalidate). */

const VERSION = 'v1';
const CACHE = `mtm-${VERSION}`;

const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'assets/icon-192.png',
  'assets/icon-512.png',
  'assets/icon-maskable-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      // 하나가 404여도 설치가 통째로 깨지지 않게 개별로 담는다
      .then(cache => Promise.all(SHELL.map(url => cache.add(url).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);

    // 주소창 진입(새로고침 포함)은 index.html 로 되돌려 준다
    const key = req.mode === 'navigate' ? new Request('index.html') : req;
    const hit = await cache.match(key, { ignoreSearch: true });

    const fresh = fetch(req).then(res => {
      if (res && res.ok && res.type !== 'opaque') cache.put(key, res.clone()).catch(() => {});
      return res;
    }).catch(() => null);

    if (hit) {
      event.waitUntil(fresh);
      return hit;
    }
    const res = await fresh;
    if (res) return res;

    return new Response('오프라인입니다. 한 번 접속한 뒤에는 인터넷 없이도 열립니다.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  })());
});
