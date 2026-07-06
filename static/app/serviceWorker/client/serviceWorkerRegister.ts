import * as Sentry from '@sentry/react';

/**
 * Register a service worker and return a promise that resolves when the worker
 * is activated.
 *
 * Uses `Sentry.metrics.*` for observability.
 */
export function serviceWorkerRegister(
  url: string,
  onReadyCallback: () => void
): Promise<ServiceWorker> {
  return new Promise((resolve, reject) => {
    if (!('serviceWorker' in navigator)) {
      Sentry.metrics.count('service-worker.register.not-supported');
      console.log('service-worker.register.not-supported');
      return reject(new Error('Service Worker is not supported'));
    }
    Sentry.metrics.count('service-worker.register.supported');
    console.log('service-worker.register.supported');

    function waitForActivation(worker: ServiceWorker): void {
      if (worker.state === 'activated') {
        Sentry.metrics.count('service-worker.register.activated');
        console.log('service-worker.register.activated');
        resolve(worker);
        return;
      }
      worker.addEventListener('statechange', () => {
        if (worker.state === 'activated') {
          Sentry.metrics.count('service-worker.register.activated');
          console.log('service-worker.register.activated');
          resolve(worker);
        }
      });
    }

    navigator.serviceWorker
      // https://rspack.rs/guide/features/web-workers
      .register(url, {scope: '/'})
      .then(registration => {
        Sentry.metrics.count('service-worker.register.registered', 1, {
          attributes: {
            // An old version could be active while the new instance is incoming
            active: registration.active ? 'true' : 'false',
            installing: registration.installing ? 'true' : 'false',
            waiting: registration.waiting ? 'true' : 'false',
          },
        });
        console.log('service-worker.register.registered', registration);

        const incoming = registration.installing ?? registration.waiting;
        if (incoming) {
          waitForActivation(incoming);
        } else if (registration.active) {
          Sentry.metrics.count('service-worker.register.active');
          console.log('service-worker.register.active');
          resolve(registration.active);
        }

        registration.addEventListener('updatefound', () => {
          Sentry.metrics.count('service-worker.register.updatefound');
          console.log('service-worker.register.updatefound');

          if (registration.installing) {
            waitForActivation(registration.installing);
          }
        });
      })
      .then(() => onReadyCallback());

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      Sentry.metrics.count('service-worker.register.controllerchange');
      console.log('service-worker.register.controllerchange');

      onReadyCallback();
    });
  });
}
