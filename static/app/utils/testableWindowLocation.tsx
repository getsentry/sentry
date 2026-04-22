/**
 * This object is mocked in tests to work around JSDOM's non configurable location.
 */
export const testableWindowLocation = globalThis.location as Pick<
  typeof globalThis.location,
  // Use `setWindowLocation` to modify the window.location.pathname instead of mocking properties on the testableLocation object
  'assign' | 'replace' | 'reload'
>;
