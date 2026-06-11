import {addIntegration, webWorkerIntegration} from '@sentry/react';

function getWorkerUrl(): string {
  if (window.__SENTRY_DEV_UI) {
    return '/_assets/entrypoints/worker.js';
  }
  const distPrefix = window.__initialData?.distPrefix ?? '/_static/dist/sentry/';
  return `${distPrefix}entrypoints/worker.js`;
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
        addIntegration(webWorkerIntegration({worker: worker as unknown as Worker}));
      }
    })
    .catch(() => {
      // Registration failed — not critical, silently ignore
    });
}
