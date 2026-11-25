/* Service worker do Partner PPR e PCA.
 * Vários apps dividem o mesmo endereço (eguilherme88-wq.github.io): este SW só mexe
 * nos caches com o prefixo deste app e só intercepta páginas da pasta /ppr-pca/. */
const PREFIXO = 'partner-ppr-pca-';
const CACHE = PREFIXO + 'v3';
const BASE = new URL('./', self.location).pathname; // ex.: /ppr-pca/
const ASSETS = ['./', './index.html', './js/platform.js', './firebase-config.js', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/logo.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => (k.startsWith(PREFIXO) || k === 'partner-ppr-pca-v1') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  if (u.origin === location.origin) {
    if (!u.pathname.startsWith(BASE)) return; // páginas de outros apps: não interfere
    e.respondWith(fetch(e.request).then(r => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then(ca => ca.put(e.request, c)); } return r; })
      .catch(() => caches.match(e.request)));
  } else if (/gstatic\.com\/firebasejs|fonts\.(googleapis|gstatic)\.com/.test(u.href)) {
    e.respondWith(caches.match(e.request).then(h => h || fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(ca => ca.put(e.request, c)); return r; })));
  }
});
