import type {InitSentryMessage} from 'sentry/serviceWorker/types';

function getWorkerUrl(): string {
  if (window.__SENTRY_DEV_UI) {
    return '/_assets/entrypoints/worker.js';
  }
  const distPrefix = window.__initialData?.distPrefix ?? '/_static/dist/sentry/';
  return `${distPrefix}entrypoints/worker.js`;
}

function getSentryConfig(): InitSentryMessage | null {
  const config = window.__initialData;
  const dsn = config?.sentryConfig?.dsn;
  if (!dsn) {
    return null;
  }
  return {
    type: 'init-sentry',
    dsn,
    release: config.sentryConfig?.release,
    environment: config.sentryConfig?.environment,
    tracesSampleRate: config.apmSampling ?? 0,
  };
}

function sendSentryConfig(worker: ServiceWorker): void {
  const sentryConfig = getSentryConfig();
  if (sentryConfig) {
    worker.postMessage(sentryConfig);
  }
}

export function registerWorker(): void {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  navigator.serviceWorker
    .register(getWorkerUrl(), {scope: '/'})
    .then(registration => {
      const worker =
        registration.active ?? registration.waiting ?? registration.installing;
      if (worker) {
        sendSentryConfig(worker);
      }

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'activated') {
              sendSentryConfig(newWorker);
            }
          });
        }
      });
    })
    .catch(() => {
      // Registration failed — not critical, silently ignore
    });
}
