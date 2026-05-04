import {invokeProvidesCallback} from './flakeStressUtils';

const microtaskIntervalMs = 1;
const microtasksPerTick = 250;
const microtaskChainDepth = 24;

/**
 * Simulates a busy machine by continuously queueing microtasks.
 */
export function withMicrotaskChurn(fn: jest.ProvidesCallback): jest.ProvidesCallback {
  return function wrapped(this: unknown) {
    const id = setInterval(() => {
      for (let i = 0; i < microtasksPerTick; i++) {
        queueMicrotask(() => {});
      }

      queueMicrotask(() => {
        const chain = (depth: number) => {
          if (depth) {
            queueMicrotask(() => chain(depth - 1));
          }
        };

        chain(microtaskChainDepth);
      });
    }, microtaskIntervalMs);

    return (async () => {
      try {
        await invokeProvidesCallback(fn, this);
      } finally {
        clearInterval(id);
      }
    })();
  };
}
