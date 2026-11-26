/* 모바일 티켓 메이커 - 서비스워커
   앱 껍데기를 캐시에 넣어 비행기 모드에서도 열리게 한다.

   전략이 둘로 나뉜다.
   - 페이지(index.html): 네트워크 우선. 인터넷이 되면 항상 최신을 보여 주고, 안 되면 캐시로 연다.
     캐시 우선으로 두면 배포한 내용이 "한 번 더 열어야" 보여서 바뀐 걸 모른다.
   - 그 밖의 파일(아이콘·매니페스트): 캐시 먼저 주고 뒤에서 조용히 갱신. */

const VERSION = 'v3';
const CACHE = `mtm-${VERSION}`;
const PAGE = 'index.html';

const SHELL = [
  './',
  PAGE,
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

self.addEventListener('message', event => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // 주소창 진입·새로고침 → 네트워크 우선
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        // no-cache: 브라우저 HTTP 캐시를 건너뛰지 않고 서버에 '바뀌었나' 물어본다
        const fresh = await fetch(PAGE, { cache: 'no-cache' });
        if (fresh && fresh.ok) {
          cache.put(PAGE, fresh.clone()).catch(() => {});
          return fresh;
        }
      } catch (e) { /* 오프라인 */ }

      const hit = await cache.match(PAGE, { ignoreSearch: true });
      if (hit) return hit;

      return new Response('오프라인입니다. 한 번 접속한 뒤에는 인터넷 없이도 열립니다.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    })());
    return;
  }

  // 나머지 → 캐시 먼저, 뒤에서 갱신
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: true });

    const fresh = fetch(req).then(res => {
      if (res && res.ok && res.type !== 'opaque') cache.put(req, res.clone()).catch(() => {});
      return res;
    }).catch(() => null);

    if (hit) {
      event.waitUntil(fresh);
      return hit;
    }
    const res = await fresh;
    if (res) return res;

    return new Response('', { status: 504 });
  })());
});
