/* 面试闯关 Service Worker
   2026.10.11n 修复：
   1) CACHE 名带上 APP_VERSION —— 每次发版自动换缓存，旧的带水印图片立刻失效
   2) 图片/音频等静态资源改为「网络优先 + 后台更新」—— 原来「缓存优先」会让
      换过的图（如去掉水印的城市背景图）永远命中旧缓存，用户反复看到旧图
   3) install时预清理所有非当前版本缓存
   HTML 仍是网络优先，保证页面更新及时；离线时统一回落缓存。 */
const APP_VERSION = "2026.10.13n";
const CACHE = "mianshi-v3-" + APP_VERSION;
const CACHE_PREFIX = "mianshi-v3-";

self.addEventListener("install", function (e) {
  self.skipWaiting();
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k.indexOf(CACHE_PREFIX) !== 0; })
            .map(function (k) { return caches.delete(k); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;

  var isHtml = req.mode === "navigate" ||
               (req.headers.get("accept") || "").indexOf("text/html") !== -1;
  var isStatic = /\.(jpg|jpeg|png|gif|webp|svg|mp3|wav|ogg|css|woff2?)$/i.test(
                   new URL(req.url).pathname);

  // HTML / 图片 / 静态资源：网络优先，拿到新响应就顺手刷新缓存，失败才回落缓存
  if (isHtml || isStatic) {
    e.respondWith(
      fetch(req).then(function (resp) {
        var copy = resp.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); }).catch(function () {});
        return resp;
      }).catch(function () {
        return caches.match(req);
      })
    );
    return;
  }

  // 其它：缓存优先
  e.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (resp) {
        var copy = resp.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); }).catch(function () {});
        return resp;
      });
    })
  );
});