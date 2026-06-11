import {addIntegration, webWorkerIntegration} from '@sentry/react';

function getWorkerUrl(): string {
  if (window.__SENTRY_DEV_UI) {
    return '/_assets/entrypoints/worker.js';
  }
  const distPrefix = window.__initialData?.distPrefix ?? '/_static/dist/sentry/';
  return `${distPrefix}entrypoints/worker.js`;
}

function connectIntegration(worker: ServiceWorker): void {
  addIntegration(webWorkerIntegration({worker: worker as unknown as Worker}));
}

function waitForActivation(worker: ServiceWorker): void {
  if (worker.state === 'activated') {
    connectIntegration(worker);
    return;
  }
  worker.addEventListener('statechange', () => {
    if (worker.state === 'activated') {
      connectIntegration(worker);
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
        connectIntegration(registration.active);
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
