// ============================================================
// CHOZ SERVICE WORKER — Offline Shell + Caching
// ============================================================

const CACHE_NAME = 'choz-v1';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/dashboard.html',
    '/about.html',
    '/faq.html',
    '/contact.html',
    '/privacy.html',
    '/terms.html',
    '/css/style.css',
    '/js/config.js',
    '/js/app.js',
    '/js/comparison.js',
    '/js/dashboard.js',
    '/manifest.json'
];

// Install — cache static assets
self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return Promise.allSettled(
                STATIC_ASSETS.map(url => 
                    cache.add(url).catch(err => console.log('Skip cache:', url))
                )
            );
        })
    );
    self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
            )
        )
    );
    self.clients.claim();
});

// Fetch — network first, cache fallback for HTML; cache first for assets
self.addEventListener('fetch', (e) => {
    const { request } = e;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    // Skip Supabase and external APIs
    if (url.origin !== location.origin) return;

    // HTML files: network first
    if (request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname === '/') {
        e.respondWith(
            fetch(request)
                .then(res => {
                    const clone = res.clone();
                    caches.open(CACHE_NAME).then(c => c.put(request, clone));
                    return res;
                })
                .catch(() => caches.match(request).then(r => r || caches.match('/index.html')))
        );
        return;
    }

    // Static assets: cache first
    e.respondWith(
        caches.match(request).then(cached => {
            if (cached) return cached;
            return fetch(request).then(res => {
                if (res.ok && res.type === 'basic') {
                    const clone = res.clone();
                    caches.open(CACHE_NAME).then(c => c.put(request, clone));
                }
                return res;
            });
        })
    );
});
