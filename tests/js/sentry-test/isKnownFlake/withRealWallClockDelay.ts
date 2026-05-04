import {delay, invokeProvidesCallback} from './flakeStressUtils';

const wallClockTickDelayMs = 15;
const wallClockPaddingMs = 15;
const wallClockParallelLoops = 3;

/**
 * Simulates a slow machine with many timers by continuously running no-op async delays.
 */
export function withRealWallClockDelay(fn: jest.ProvidesCallback): jest.ProvidesCallback {
  return function wrapped(this: unknown) {
    return (async () => {
      const abortController = new AbortController();
      const {signal} = abortController;

      const makeBackground = async () => {
        while (!signal.aborted) {
          await delay(wallClockTickDelayMs);
        }
      };

      const backgrounds = Promise.all(
        Array.from({length: wallClockParallelLoops}, makeBackground)
      );

      try {
        await delay(wallClockPaddingMs);
        await invokeProvidesCallback(fn, this);
        await delay(wallClockPaddingMs);
      } finally {
        abortController.abort();
        await backgrounds.catch(() => {});
      }
    })();
  };
}
