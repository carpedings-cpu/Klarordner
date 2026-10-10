// Die App liegt jetzt unter app/. Diese Datei löst eine ältere Installation an der Wurzel ab.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(
  caches.keys()
    .then(namen => Promise.all(namen.filter(n => n !== "klarordner-384e80f75f" && n !== "klarordner-ocr-6f40ccab56").map(n => caches.delete(n))))
    .then(() => self.registration.unregister())
    .then(() => self.clients.matchAll({ type: "window" }))
    .then(fenster => fenster.forEach(f => f.navigate(f.url)))));
