// App shell cache. Bump VERSION whenever files change so phones pick up the update.
const VERSION = "v3";
const SHELL = ["./", "index.html", "app.js", "firebase-config.js", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Same-origin files: network first, fall back to cache when offline. Firebase and fonts go straight to the network.
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;
  // Bypass the browser's HTTP cache (GitHub Pages caches for 10 minutes) so updates show up right away.
  const fresh = e.request.mode === "navigate" ? new Request(url.href, { cache: "no-cache" }) : new Request(e.request, { cache: "no-cache" });
  e.respondWith(
    fetch(fresh).then(res => {
      const copy = res.clone();
      if (res.ok) caches.open(VERSION).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request).then(r => r || caches.match("index.html")))
  );
});
