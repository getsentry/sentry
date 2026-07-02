import {addIntegration, webWorkerIntegration} from '@sentry/react';

type WebWorkerIntegration = ReturnType<typeof webWorkerIntegration>;
let integration: WebWorkerIntegration | null = null;

function getWorkerUrl(): string {
  return window.__SENTRY_DEV_UI ? '/entrypoints/service-worker.js' : '/service-worker.js';
}

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
    // https://rspack.rs/guide/features/web-workers
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
