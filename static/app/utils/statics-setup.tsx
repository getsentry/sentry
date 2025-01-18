/* eslint no-native-reassign:0 */

// biome-ignore lint/style/noVar: Not required
declare var __webpack_public_path__: string; // eslint-disable-line no-var

/**
 * Set the webpack public path at runtime. This is necessary so that imports
 * can be resolved properly
 *
 * NOTE: This MUST be loaded before any other app modules in the entrypoint.
 *
 * This may not be as necessary without versioned asset URLs. (Rather, instead of a version directory
 * that is generated on backend, frontend assets will be "versioned" by webpack with a content hash in
 * its filename). This means that the public path does not need to be piped from the backend.
 *
 * XXX(epurkhiser): Currently we only boot with hydration in experimental SPA
 * mode, where assets are *currently not versioned*. We hardcode `/_assets/` here
 * for now as a quick workaround for the index.html being aware of versioned
 * asset paths.
 */
__webpack_public_path__ = window.__initialData?.distPrefix || '/_assets/';
