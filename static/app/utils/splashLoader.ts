let splashLoader: Element | null = null;

/**
 * Remember the loader that the server-rendered Django view put inside the React
 * root, before React's first commit removes it. Holding a reference keeps the
 * detached node alive so it can be re-parented later.
 *
 * Note we deliberately do not detach it here — leaving the removal to React's
 * own commit avoids a blank flash between bootstrap and first paint.
 */
export function captureSplashLoader(container: Element) {
  splashLoader = container.querySelector('.splash-loader');
}

export function getSplashLoader() {
  return splashLoader;
}
