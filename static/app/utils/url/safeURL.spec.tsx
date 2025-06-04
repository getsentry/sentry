import {safeURL} from './safeURL';

describe('safeURL', () => {
  const nativeConstructor = globalThis.URL;
  afterEach(() => {
    jest.resetAllMocks();
    globalThis.URL = nativeConstructor;
  });

  describe(`invalid argument types`, () => {
    it('does not throw on unknown input', () => {
      expect(() => safeURL('/')).not.toThrow();
      expect(() => safeURL('/', 'bad_base')).not.toThrow();
      // @ts-expect-error force invalid input
      expect(() => safeURL('/', null)).not.toThrow();
      // @ts-expect-error force invalid input
      expect(() => safeURL(undefined)).not.toThrow();
      // @ts-expect-error force invalid input
      expect(() => safeURL(undefined, undefined)).not.toThrow();
      // @ts-expect-error force invalid input
      expect(() => safeURL(null)).not.toThrow();
      // @ts-expect-error force invalid input
      expect(() => safeURL([])).not.toThrow();
    });
  });

  describe(`valid argument values`, () => {
    it('returns a new URL object', () => {
      expect(safeURL('https://example.com')).toBeInstanceOf(URL);
      expect(safeURL('/path', 'http://example.com')).toBeInstanceOf(URL);
    });

    it('returns correct URL', () => {
      expect(safeURL('https://example.com')?.href).toBe('https://example.com/');
    });

    it('respects base argv', () => {
      expect(safeURL('/path', 'https://example.com')?.href).toBe(
        'https://example.com/path'
      );
    });
  });
});
