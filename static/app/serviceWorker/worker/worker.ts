import {registerWebWorker} from '@sentry/browser';
import {startSpan} from '@sentry/core';

const sw = self as unknown as ServiceWorkerGlobalScope;

// registerWebWorker expects DedicatedWorkerGlobalScope.postMessage, which
// doesn't exist on ServiceWorkerGlobalScope. The cast is safe: the only
// call to postMessage sends debug IDs and will be a no-op here; the
// unhandledrejection handler still registers correctly.
registerWebWorker({self: sw as any});

sw.addEventListener('install', () => {
  startSpan({name: 'service-worker.install', op: 'sw.lifecycle'}, () => {
    sw.skipWaiting();
  });
});

sw.addEventListener('activate', event => {
  event.waitUntil(
    startSpan({name: 'service-worker.activate', op: 'sw.lifecycle'}, () =>
      sw.clients.claim()
    )
  );
});

sw.addEventListener('message', _event => {
  startSpan({name: 'service-worker.message', op: 'sw.message'}, () => {
    // No custom message handlers yet
  });
});
