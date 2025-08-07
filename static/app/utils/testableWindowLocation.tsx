/**
 * This object is mocked in tests to work around JSDOM's non configurable location.
 */
export const testableWindowLocation = window.location as Pick<
  typeof window.location,
  // Use `setWindowLocation` to modify the window.location.pathname instead of mocking properties on the testableLocation object
  'assign' | 'replace' | 'reload'
>;
