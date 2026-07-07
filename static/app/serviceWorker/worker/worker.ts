import * as Sentry from '@sentry/browser';

import {getUnhandledRejectionError} from 'sentry/serviceWorker/worker/getUnhandledRejectionError';
import {handleInboundEvent} from 'sentry/serviceWorker/worker/handleInboundEvent';
import {initializeSentry} from 'sentry/serviceWorker/worker/initializeSentry';

const sw = self as unknown as ServiceWorkerGlobalScope;

const DEBUG_LOGGING = false;

function log(message: string) {
  Sentry.metrics.count(`service-worker.worker.${message}`);
  if (DEBUG_LOGGING) {
    // eslint-disable-next-line no-console
    console.log(`service-worker.worker.${message}`);
  }
}

sw.addEventListener('install', event => {
  log('onInstall');
  event.waitUntil(
    Promise.all([
      // Force activation to happen without waiting for the current worker to
      // have zero clients. This worker instance will activate and claim all
      // the clients for itself.
      sw.skipWaiting(),
      // If this fetch fails, or initializeSentry throws an error, the worker
      // will not be 'installed' and cannot be activated. We'll try again when
      // the next update-check downloads a new version.
      fetch('/api/client-config/', {
        credentials: 'include',
        headers: {'Content-Type': 'application/json'},
      })
        .then(data => data.json())
        .then(initializeSentry),
    ]).then(() => {
      log('didInstall');
    })
  );
});

sw.addEventListener('activate', event => {
  log('onActivate');

  event.waitUntil(sw.clients.claim());
});

sw.addEventListener('unhandledrejection', (event: unknown) => {
  log('onUnhandledRejection');
  const reason = getUnhandledRejectionError(event);
  Sentry.captureException(reason);
});

sw.addEventListener('message', event => {
  if (!event.data || typeof event.data !== 'object') {
    return;
  }
  event.waitUntil(
    Sentry.startSpan(
      {
        name: 'service-worker.worker.onMessage',
        op: 'sw.onmessage',
        attributes: {
          type: event.data.type,
          name: event.data.name,
          messageId: event.data.messageId,
        },
      },
      async () => {
        if (DEBUG_LOGGING) {
          // eslint-disable-next-line no-console
          console.log('service-worker.worker.onMessage');
        }
        if (event.data.type === 'event') {
          await handleInboundEvent(sw, event.data);
        }
      }
    )
  );
});
