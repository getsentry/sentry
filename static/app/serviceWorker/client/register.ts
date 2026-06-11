import {addIntegration, webWorkerIntegration} from '@sentry/react';

function getWorkerUrl(): string {
  if (window.__SENTRY_DEV_UI) {
    return '/_assets/entrypoints/worker.js';
  }
  const distPrefix = window.__initialData?.distPrefix ?? '/_static/dist/sentry/';
  return `${distPrefix}entrypoints/worker.js`;
}

type WebWorkerIntegration = ReturnType<typeof webWorkerIntegration>;
let integration: WebWorkerIntegration | null = null;

function connectWorker(worker: ServiceWorker): void {
  const w = worker as unknown as Worker;
  if (integration) {
    integration.addWorker(w);
  } else {
    integration = webWorkerIntegration({worker: w});
    addIntegration(integration);
  }
}

function waitForActivation(worker: ServiceWorker): void {
  if (worker.state === 'activated') {
    connectWorker(worker);
    return;
  }
  worker.addEventListener('statechange', () => {
    if (worker.state === 'activated') {
      connectWorker(worker);
    }
  });
}

export function registerWorker(): void {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  navigator.serviceWorker
    .register(getWorkerUrl(), {scope: '/'})
    .then(registration => {
      const incoming = registration.installing ?? registration.waiting;
      if (incoming) {
        waitForActivation(incoming);
      } else if (registration.active) {
        connectWorker(registration.active);
      }

      registration.addEventListener('updatefound', () => {
        if (registration.installing) {
          waitForActivation(registration.installing);
        }
      });
    })
    .catch(() => {
      // Registration failed — not critical, silently ignore
    });
}
