/* eslint-disable unicorn/filename-case, no-undef */
/**
 * Custom jest environment for page-level snapshot tests.
 *
 * Inherits from the Sentry jsdom environment but restores Node's native
 * Fetch API globals (Request, Response, Headers, fetch, ReadableStream, etc.)
 * which jsdom strips. MSW and the real sentry/api Client need them.
 */
const wrapWithStructuredClone = require('./wrapWithStructuredClone');
const SentryJsdomEnv = wrapWithStructuredClone(require('@sentry/jest-environment/jsdom'));

class PageSnapshotEnvironment extends SentryJsdomEnv {
  async setup() {
    await super.setup();

    // Restore Node's native Fetch API globals into jsdom's global scope.
    // jsdom doesn't implement them, so they're undefined in the test environment.
    const globals = [
      'fetch',
      'Request',
      'Response',
      'Headers',
      'ReadableStream',
      'WritableStream',
      'TransformStream',
      'FormData',
      'Blob',
      'File',
      'AbortController',
      'AbortSignal',
      'ByteLengthQueuingStrategy',
      'CountQueuingStrategy',
      'TextEncoderStream',
      'TextDecoderStream',
      'CompressionStream',
      'DecompressionStream',
      'BroadcastChannel',
      'MessageChannel',
      'MessagePort',
      'URL',
      'URLSearchParams',
    ];

    // These must always use Node's versions even if jsdom provides its own,
    // because MSW/fetch reject cross-realm instances (e.g. jsdom's AbortSignal
    // fails instanceof checks in Node's fetch).
    const forceOverwrite = new Set([
      'AbortController',
      'AbortSignal',
      'Request',
      'Response',
      'Headers',
      'ReadableStream',
      'WritableStream',
      'TransformStream',
      'FormData',
      'Blob',
      'File',
    ]);

    const staticGlobals = globals.filter(n => n !== 'fetch');
    for (const name of staticGlobals) {
      const shouldOverwrite = forceOverwrite.has(name)
        ? globalThis[name] !== undefined
        : this.global[name] === undefined && globalThis[name] !== undefined;
      if (shouldOverwrite) {
        this.global[name] = globalThis[name];
      }
    }

    // Set fetch as a plain writable property so MSW can patch it.
    // Relative URL resolution is handled after MSW patches in the test setup
    // (see wrapFetchForRelativeURLs in pageSnapshotSetup.ts).
    if (this.global.fetch === undefined) {
      this.global.fetch = globalThis.fetch;
    }
  }
}

module.exports = PageSnapshotEnvironment;
