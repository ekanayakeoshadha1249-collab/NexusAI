/*
 * Nexus AI - Service Worker
 * Provides offline functionality and caching for PWA
 */

const CACHE_NAME = 'nexus-ai-v1.0.0';
const RUNTIME_CACHE = 'nexus-runtime';

// Files to cache immediately (App Shell)
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    '/database.js',
    '/manifest.json',
    '/logo.png',
    // External CDN resources (cache on first load)
    'https://cdn.tailwindcss.com',
    'https://unpkg.com/dexie@latest/dist/dexie.js',
    'https://unpkg.com/lucide@latest',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap'
];

// Install Event - Cache static assets
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Caching app shell');
            // Cache essential files only, ignore failures for CDN resources
            return cache.addAll(STATIC_ASSETS.slice(0, 7)).catch(err => {
                console.warn('[Service Worker] Some assets failed to cache:', err);
            });
        }).then(() => {
            console.log('[Service Worker] Skip waiting');
            return self.skipWaiting();
        })
    );
});

// Activate Event - Clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
                        console.log('[Service Worker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('[Service Worker] Claiming clients');
            return self.clients.claim();
        })
    );
});

// Fetch Event - Network First, fallback to Cache
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip API calls (always need fresh data)
    if (url.hostname.includes('googleapis.com') ||
        url.hostname.includes('openai.com')) {
        return; // Let it go to network
    }

    // For navigation requests (HTML pages)
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    // Cache the new version
                    const responseClone = response.clone();
                    caches.open(RUNTIME_CACHE).then((cache) => {
                        cache.put(request, responseClone);
                    });
                    return response;
                })
                .catch(() => {
                    // Offline - serve from cache
                    return caches.match(request).then((cachedResponse) => {
                        return cachedResponse || caches.match('/index.html');
                    });
                })
        );
        return;
    }

    // For all other requests - Cache First strategy
    event.respondWith(
        caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }

            // Not in cache - fetch from network
            return fetch(request).then((response) => {
                // Don't cache non-successful responses
                if (!response || response.status !== 200 || response.type === 'error') {
                    return response;
                }

                // Cache the fetched resource
                const responseClone = response.clone();
                caches.open(RUNTIME_CACHE).then((cache) => {
                    cache.put(request, responseClone);
                });

                return response;
            }).catch((error) => {
                console.error('[Service Worker] Fetch failed:', error);
                // Return offline page or placeholder if available
                return caches.match('/index.html');
            });
        })
    );
});

// Background Sync (for future enhancement - send messages when back online)
self.addEventListener('sync', (event) => {
    console.log('[Service Worker] Background sync:', event.tag);
    if (event.tag === 'sync-messages') {
        event.waitUntil(syncMessages());
    }
});

async function syncMessages() {
    // Placeholder for syncing queued messages when connection restored
    console.log('[Service Worker] Syncing queued messages...');
}

// Push Notifications (for future enhancement)
self.addEventListener('push', (event) => {
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'Nexus AI';
    const options = {
        body: data.body || 'You have a new message',
        icon: '/logo.png',
        badge: '/logo.png',
        vibrate: [200, 100, 200],
        data: data.url || '/'
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

// Notification Click
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow(event.notification.data)
    );
});
