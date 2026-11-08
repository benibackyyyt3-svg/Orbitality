const CACHE = "video-factory-v2";
const CORE = ["/", "/styles.css", "/app.js", "/manifest.webmanifest"];

self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)));
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith("video-factory-") && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Sempre buscar os arquivos do aplicativo na rede primeiro, para evitar servir JavaScript antigo.
  const isAppAsset = url.pathname === "/" || ["/index.html", "/app.js", "/styles.css", "/sw.js", "/manifest.webmanifest"].includes(url.pathname);
  if (isAppAsset) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request, { cache: "no-store" });
        if (fresh && fresh.ok && request.method === "GET") {
          const cache = await caches.open(CACHE);
          cache.put(request, fresh.clone()).catch(() => {});
        }
        return fresh;
      } catch (error) {
        const cached = await caches.match(request);
        if (cached) return cached;
        throw error;
      }
    })());
    return;
  }

  event.respondWith(caches.match(request).then(cached => cached || fetch(request)));
});
