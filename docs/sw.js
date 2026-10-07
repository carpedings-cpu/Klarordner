// Legt die App beim ersten Aufruf im Gerät ab, danach läuft sie ohne Verbindung.
// Nutzerdaten gehen hier nie durch, sie liegen im Gerätespeicher des Browsers und in der Sicherungsdatei des Nutzers.
const CACHE = "klarordner-b17fdcda72";
// Die Texterkennung wird erst beim ersten Scannen geladen und bleibt über App-Updates hinweg erhalten.
const OCR_CACHE = "klarordner-ocr-6f40ccab56";
const DATEIEN = ["./", "./index.html", "./manifest.webmanifest", "./icons/icon-180.png", "./icons/icon-192.png", "./icons/icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(DATEIEN)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(namen => Promise.all(namen.filter(n => n !== CACHE && n !== OCR_CACHE).map(n => caches.delete(n))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  if (new URL(e.request.url).pathname.includes("/ocr/")) {
    e.respondWith(caches.open(OCR_CACHE).then(c => c.match(e.request).then(treffer => treffer || fetch(e.request).then(antwort => {
      if (antwort.ok) c.put(e.request, antwort.clone());
      return antwort;
    }))));
    return;
  }
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(treffer => treffer || fetch(e.request)));
});
