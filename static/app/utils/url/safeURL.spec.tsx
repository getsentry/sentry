import {safeURL} from './safeURL';

function makeURLMockWithCanParse(spy: jest.Mock): [typeof URL, jest.Mock] {
  class URLMockWithCanParse extends URL {
    constructor(...instanceArgs: any[]) {
      // @ts-expect-error ???
      super(...instanceArgs);
      spy(...instanceArgs);
    }

    static canParse(): boolean {
      throw new Error("Specify canParse's return value");
    }
  }

  return [URLMockWithCanParse, spy];
}

function makeURLMockWithoutCanParse(spy: jest.Mock): [typeof URL, jest.Mock] {
  class URLMockWithCanParse extends URL {
    constructor(...instanceArgs: any[]) {
      // @ts-expect-error ???
      super(...instanceArgs);
      spy(...instanceArgs);
    }
  }

  // @ts-expect-error in case it ever gets defined by globalThis
  delete URLMockWithCanParse.canParse;

  return [URLMockWithCanParse, spy];
}

describe('safeURL', () => {
  const nativeConstructor = globalThis.URL;
  afterEach(() => {
    jest.resetAllMocks();
    globalThis.URL = nativeConstructor;
  });

  describe('canParse is available', () => {
    afterEach(() => {
      const [constructorMock, _constructorSpy] = makeURLMockWithoutCanParse(jest.fn());
      globalThis.URL = constructorMock;
    });

    it('canParse returns false, new URL is not called', () => {
      const [mock, URLConstructorSpy] = makeURLMockWithCanParse(jest.fn());
      globalThis.URL = mock;

      const canParseSpy = jest.spyOn(globalThis.URL, 'canParse').mockReturnValue(false);
      const url = safeURL('/bad_path', '/bad_base');

      expect(canParseSpy).toHaveBeenCalledWith('/bad_path', '/bad_base');
      expect(URLConstructorSpy).not.toHaveBeenCalled();
      expect(url).toBeUndefined();
    });

    it('canParse returns true, new URL is called', () => {
      const [mock] = makeURLMockWithCanParse(jest.fn());
      globalThis.URL = mock;

      const canParseSpy = jest.spyOn(globalThis.URL, 'canParse').mockReturnValue(true);
      const url = safeURL('/path', 'https://example.com');

      expect(canParseSpy).toHaveBeenCalledWith('/path', 'https://example.com');
      expect(url).toBeInstanceOf(URL);
      expect(url?.href).toBe('https://example.com/path');
    });
  });

  for (const suite of ['with canParse', 'without canParse']) {
    describe(`${suite} invalid params`, () => {
      if (suite === 'with canParse') {
        beforeEach(() => {
          const [constructorMock, _constructorSpy] = makeURLMockWithCanParse(jest.fn());
          globalThis.URL = constructorMock;
          jest.spyOn(globalThis.URL, 'canParse').mockImplementation(() => false);
        });
      } else {
        beforeEach(() => {
          const [constructorMock, _constructorSpy] = makeURLMockWithoutCanParse(
            jest.fn()
          );
          globalThis.URL = constructorMock;
        });
      }

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

    describe(`${suite} valid params`, () => {
      if (suite === 'with canParse') {
        beforeEach(() => {
          const [constructorMock, _constructorSpy] = makeURLMockWithCanParse(jest.fn());
          globalThis.URL = constructorMock;
          jest.spyOn(globalThis.URL, 'canParse').mockImplementation(() => true);
        });
      } else {
        beforeEach(() => {
          const [constructorMock, _constructorSpy] = makeURLMockWithoutCanParse(
            jest.fn()
          );
          globalThis.URL = constructorMock;
        });
      }
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
  }
});
