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
    // When browser APIs throw security-related errors, they throw a DOMException
    // object with its name property set to "SecurityError" (and historically, a
    // code property of 18).
    if (error instanceof DOMException && error.name === 'SecurityError') {
      return false;
    }
    throw error;
  }
}
