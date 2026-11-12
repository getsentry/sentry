declare global {
  var __zod_globalConfig: {jitless?: boolean} | undefined;
}

/**
 * Set the public path at runtime. This is necessary so that imports and asset
 * URLs in injected CSS can be resolved properly
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
import.meta.rspackPublicPath = window.__initialData?.distPrefix || '/_assets/';

// Zod probes `new Function` the first time it builds an object schema, and our
// CSP reports that as a violation. Turning off its JIT before any schema exists
// skips the probe. Zod reads this global when it loads.
globalThis.__zod_globalConfig = {jitless: true};

// Fonts only download once text using them is laid out, which for the app is
// after React's first render. Start the Latin Rubik file now so it loads in
// parallel with the app bundle. The @font-face rules in sentry.css own the
// URL, so this never fetches a second copy.
if (typeof document !== 'undefined' && 'fonts' in document) {
  document.fonts.load('1em Rubik').catch(() => {});
}
