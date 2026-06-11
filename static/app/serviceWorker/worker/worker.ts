import {init, isInitialized} from '@sentry/browser';
import {
  dedupeIntegration,
  functionToStringIntegration,
  inboundFiltersIntegration,
  linkedErrorsIntegration,
  setTag,
} from '@sentry/core';

import type {InitSentryMessage, WorkerMessage} from 'sentry/serviceWorker/types';

const sw = self as unknown as ServiceWorkerGlobalScope;

function initSentry(config: InitSentryMessage): void {
  if (isInitialized()) {
    return;
  }

  init({
    dsn: config.dsn,
    release: config.release,
    environment: config.environment,
    defaultIntegrations: false,
    integrations: [
      inboundFiltersIntegration(),
      functionToStringIntegration(),
      linkedErrorsIntegration(),
      dedupeIntegration(),
    ],
    tracesSampleRate: config.tracesSampleRate ?? 0,
    tracePropagationTargets: ['localhost', /^\//],
  });

  setTag('context', 'service-worker');
}

function handleMessage(event: ExtendableMessageEvent): void {
  const data = event.data as WorkerMessage;
  switch (data.type) {
    case 'init-sentry':
      initSentry(data);
      break;
    default:
      break;
  }
}

sw.addEventListener('install', () => {
  sw.skipWaiting();
});

sw.addEventListener('activate', event => {
  event.waitUntil(sw.clients.claim());
});

sw.addEventListener('message', handleMessage);
