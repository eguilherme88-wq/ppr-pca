/* Service worker: guarda o app para abrir sem internet (os dados do Firebase têm cache próprio). */
const CACHE = 'partner-ppr-pca-v1';
const ASSETS = ['./', './index.html', './js/platform.js', './firebase-config.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/logo.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (u.origin === location.origin) {
    // rede primeiro (pega atualizações), cache como reserva
    e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(ca => ca.put(e.request, c)); return r; }).catch(() => caches.match(e.request)));
  } else if (/gstatic\.com\/firebasejs|fonts\.(googleapis|gstatic)\.com/.test(u.href)) {
    e.respondWith(caches.match(e.request).then(h => h || fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(ca => ca.put(e.request, c)); return r; })));
  }
});
