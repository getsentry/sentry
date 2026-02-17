/// <reference types="vitest/globals" />
/**
 * Compatibility shims for running shared test utilities under Vitest.
 *
 * 1. CJS `module` global — Some dependencies (e.g. @sentry/core's `loadModule`)
 *    reference `module.require()` which only exists in CommonJS. This shim uses
 *    Node's `createRequire` to make those calls work in Vitest's ESM environment.
 *
 * 2. `jest` global — Many shared test utilities (fixtures, helpers) reference
 *    `jest.fn()`, `jest.spyOn()`, etc. During the migration period we alias the
 *    `jest` global to Vitest's `vi` object so those calls work transparently.
 */
import {createRequire} from 'node:module';

if (typeof globalThis.module === 'undefined') {
  const require = createRequire(import.meta.url);
  (globalThis as any).module = {require};
}

// Provide a `jest` global backed by `vi` so that shared test utilities
// (RouterFixture, initializeOrg, etc.) that use jest.fn() / jest.spyOn()
// work without modification during the migration period.
if (typeof globalThis.jest === 'undefined') {
  (globalThis as any).jest = vi;
}
