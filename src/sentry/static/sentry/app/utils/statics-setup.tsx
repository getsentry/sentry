/* eslint no-native-reassign:0 */

// eslint-disable-next-line no-var
declare var __webpack_public_path__: string;

/**
 * Set the webpack public path at runtime. The __sentryGlobalStaticPrefix will
 * be declared in layout.html.
 *
 * NOTE: This MUST be loaded before any other app modules in the entrypoint.
 */
if (window.__sentryGlobalStaticPrefix) {
  __webpack_public_path__ = window.__sentryGlobalStaticPrefix;
}
