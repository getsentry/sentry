import {invokeProvidesCallback} from './flakeStressUtils';

const mainThreadIntervalMs = 2;
const mainThreadSpinIterations = 500_000;

/**
 * Simulates an overloaded main thread by doing busy-work on a fixed interval.
 */
export function withMainThreadCpuLoad(fn: jest.ProvidesCallback): jest.ProvidesCallback {
  return function wrapped(this: unknown) {
    const spin = () => {
      let sink = 0;
      for (let i = 0; i < mainThreadSpinIterations; i++) {
        sink ^= i;
      }
      sink.toLocaleString();
    };

    const id = setInterval(spin, mainThreadIntervalMs);

    return (async () => {
      try {
        await invokeProvidesCallback(fn, this);
      } finally {
        clearInterval(id);
      }
    })();
  };
}
