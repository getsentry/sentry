let splashLoader: Element | null = null;

/**
 * Capture the server-rendered loader before React's first commit clears the
 * root, so the same node can be re-parented later. We only read it — React's
 * own commit removes it, avoiding a blank flash. Guarded so a later render into
 * a loader-less container cannot null the reference.
 */
export function captureSplashLoader(container: Element) {
  const loader = container.querySelector('.splash-loader');
  if (loader) {
    splashLoader = loader;
  }
}

export function getSplashLoader() {
  return splashLoader;
}

/**
 * Clear the captured loader between tests.
 * @public used only in organizationContainer.spec.tsx (knip prod run ignores specs)
 */
export function resetSplashLoader() {
  splashLoader = null;
}
