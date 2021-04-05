/* eslint no-native-reassign:0 */

// eslint-disable-next-line no-var
declare var __webpack_public_path__: string;

/**
 * Set the webpack public path at runtime. This is necessary so that imports can be resolved properly
 *
 * NOTE: This MUST be loaded before any other app modules in the entrypoint.
 *
 * XXX(epurkhiser): Currently we only boot with hydration in experimental SPA
 * mode, where assets are *currently not versioned*. We hardcode `/_assets/` here
 * for now as a quick workaround for the index.html being aware of versioned
 * asset paths.
 */
__webpack_public_path__ = window.__initialData?.distPrefix || '/_assets/';
