const SUPPORTS_QUEUE_MICROTASK = globalThis && 'queueMicrotask' in globalThis;

export function scheduleMicroTask(callback: () => void) {
  if (SUPPORTS_QUEUE_MICROTASK) {
    globalThis.queueMicrotask(callback);
  } else {
    Promise.resolve()
      .then(callback)
      .catch(e => {
        // Escape the promise and throw the error so it gets reported
        if (globalThis) {
          globalThis.setTimeout(() => {
            throw e;
          });
        } else {
          // Best effort and just rethrow
          throw e;
        }
      });
  }
}
