const SUPPORTS_QUEUE_MICROTASK = window && 'queueMicrotask' in window;

export function scheduleMicroTask(callback: () => void) {
  if (SUPPORTS_QUEUE_MICROTASK) {
    window.queueMicrotask(callback);
  } else {
    Promise.resolve()
      .then(callback)
      .catch(e => {
        // Escape the promise and throw the error so it gets reported
        if (window) {
          window.setTimeout(() => {
            throw e;
          });
        } else {
          // Best effort and just rethrow
          throw e;
        }
      });
  }
}
