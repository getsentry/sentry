/* eslint no-native-reassign:0 */

// This (global) errors for some reason :|
/* eslint-disable-next-line no-unused-vars */
/* global __webpack_public_path__ */

/**
 * Set the webpack public path at runtime. The __sentryGlobalStaticPrefix will
 * be declared in layout.html.
 *
 * NOTE: This MUST be loaded before any other app modules in the entrypoint.
 */
if (window.__sentryGlobalStaticPrefix) {
  __webpack_public_path__ = window.__sentryGlobalStaticPrefix;
}
