import * as Sentry from '@sentry/browser';

import {getUnhandledRejectionError} from 'sentry/serviceWorker/worker/getUnhandledRejectionError';
import {initNotificationHandler} from 'sentry/serviceWorker/worker/triggerTestNotification';
import {initInboundHandler} from 'sentry/serviceWorker/worker/worker-inbound-handler';
import {initOutboundHandler} from 'sentry/serviceWorker/worker/worker-outbound-messages';

const sw = self as unknown as ServiceWorkerGlobalScope;

Sentry.metrics.count('service-worker.worker.running');
console.log('service-worker.worker.running');

sw.addEventListener('install', event => {
  Sentry.metrics.count('service-worker.worker.installed');
  console.log('service-worker.worker.installed');
  event.waitUntil(sw.skipWaiting());
});

sw.addEventListener('activate', event => {
  Sentry.metrics.count('service-worker.worker.activated');
  console.log('service-worker.worker.activated');
  event.waitUntil(sw.clients.claim());
});

sw.addEventListener('unhandledrejection', (event: unknown) => {
  Sentry.metrics.count('service-worker.worker.unhandledrejection');
  console.log('service-worker.worker.unhandledrejection');
  const reason = getUnhandledRejectionError(event);
  Sentry.captureException(reason);
});

initNotificationHandler(sw);
initInboundHandler(sw);
initOutboundHandler(sw);
