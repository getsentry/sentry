/**
 * Returns true if the Service Worker API is available and accessible in the
 * current context.
 *
 * Accessing `navigator.serviceWorker` throws a SecurityError in sandboxed
 * iframes that lack the `allow-same-origin` flag, even though the `'in'`
 * operator reports the property as present. This helper catches that error
 * and returns false instead of propagating it.
 */
export function isServiceWorkerSupported(): boolean {
  try {
    return 'serviceWorker' in navigator && Boolean(navigator.serviceWorker);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'SecurityError') {
      // SecurityError is thrown when accessing navigator.serviceWorker in a
      // sandboxed iframe that lacks the `allow-same-origin` flag.
      return false;
    }
    throw error;
  }
}
