import {delay, invokeProvidesCallback} from './flakeStressUtils';

const fetchDelayMs = 100;
const originalFetch = globalThis.fetch;

/**
 * Simulates a slow network by adding delays to global fetch calls.
 */
export function withDelayedFetch(fn: jest.ProvidesCallback): jest.ProvidesCallback {
  return function wrapped(this: unknown) {
    return (async () => {
      if (typeof originalFetch !== 'function') {
        await invokeProvidesCallback(fn, this);
        return;
      }

      globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
        await delay(fetchDelayMs);
        return originalFetch.apply(globalThis, args);
      }) as typeof fetch;

      try {
        await invokeProvidesCallback(fn, this);
      } finally {
        globalThis.fetch = originalFetch;
      }
    })();
  };
}
