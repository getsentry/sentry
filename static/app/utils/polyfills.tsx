import ResizeObserverPolyfill from 'resize-observer-polyfill';

/**
 * Installs polyfills required for browser compatibility
 */
export function installPolyfills() {
  if (!window.ResizeObserver) {
    window.ResizeObserver = ResizeObserverPolyfill;
  }
}