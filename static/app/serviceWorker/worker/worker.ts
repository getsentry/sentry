import {registerWebWorker} from '@sentry/browser';

const sw = self as unknown as ServiceWorkerGlobalScope;

// registerWebWorker expects DedicatedWorkerGlobalScope.postMessage, which
// doesn't exist on ServiceWorkerGlobalScope. The cast is safe: the only
// call to postMessage sends debug IDs and will be a no-op here; the
// unhandledrejection handler still registers correctly.
registerWebWorker({self: sw as any});

sw.addEventListener('install', () => {
  sw.skipWaiting();
});

sw.addEventListener('activate', event => {
  event.waitUntil(sw.clients.claim());
});
