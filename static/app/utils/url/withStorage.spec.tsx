import {parseAsInteger, parseAsString} from 'nuqs';

import Storage from 'sentry/utils/localStorage';

import {withLocalStorage, withSessionStorage, withStorage} from './withStorage';

describe('withLocalStorage', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    jest.clearAllMocks();
  });

  describe('parse', () => {
    it('should use URL value when present and sync to localStorage', () => {
      const parser = withLocalStorage('test:key', parseAsString);
      const result = parser.parse('url-value');

      expect(result).toBe('url-value');
      expect(Storage.getItem('test:key')).toBe(JSON.stringify('url-value'));
    });

    it('should fall back to localStorage when URL is empty', () => {
      Storage.setItem('test:key', JSON.stringify('stored-value'));

      const parser = withLocalStorage('test:key', parseAsString);
      const result = parser.parse(null as any);

      expect(result).toBe('stored-value');
    });

    it('should return null when both URL and localStorage are empty', () => {
      const parser = withLocalStorage('test:key', parseAsString);
      const result = parser.parse(null as any);

      expect(result).toBeNull();
    });

    it('should handle complex types', () => {
      const parser = withLocalStorage('test:key', parseAsInteger);

      // URL value
      const result1 = parser.parse('42');
      expect(result1).toBe(42);
      expect(Storage.getItem('test:key')).toBe(JSON.stringify(42));

      // localStorage fallback
      Storage.setItem('test:key', JSON.stringify(99));
      const result2 = parser.parse(null as any);
      expect(result2).toBe(99);
    });

    it('should handle JSON parse errors gracefully', () => {
      Storage.setItem('test:key', 'invalid-json{');

      const parser = withLocalStorage('test:key', parseAsString);
      const result = parser.parse(null as any);

      expect(result).toBeNull();
      // Should remove invalid data
      expect(Storage.getItem('test:key')).toBeNull();
    });

    it('should handle localStorage getItem errors gracefully', () => {
      // Mock localStorage directly
      const originalGetItem = localStorage.getItem;
      localStorage.getItem = jest.fn(() => {
        throw new Error('Storage unavailable');
      });

      const parser = withLocalStorage('test:key', parseAsString);
      const result = parser.parse(null as any);

      // Should not throw, just return null
      expect(result).toBeNull();

      // Restore
      localStorage.getItem = originalGetItem;
    });

    it('should handle localStorage setItem errors gracefully', () => {
      // Mock localStorage directly
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = jest.fn(() => {
        throw new Error('Quota exceeded');
      });

      const parser = withLocalStorage('test:key', parseAsString);
      const result = parser.parse('url-value');

      // Should still return the parsed value even if localStorage fails
      expect(result).toBe('url-value');

      // Restore
      localStorage.setItem = originalSetItem;
    });

    it('should not sync to localStorage when parser returns null', () => {
      // Use parseAsInteger which will return null for non-numeric strings
      const parser = withLocalStorage('test:key', parseAsInteger);
      parser.parse('not-a-number');

      // Since parseAsInteger returns null, shouldn't write to localStorage
      expect(Storage.getItem('test:key')).toBeNull();
    });
  });

  describe('serialize', () => {
    it('should write to localStorage when serializing', () => {
      const parser = withLocalStorage('test:key', parseAsString);
      const result = parser.serialize('new-value');

      expect(result).toBe('new-value');
      expect(Storage.getItem('test:key')).toBe(JSON.stringify('new-value'));
    });

    it('should update localStorage with new values', () => {
      Storage.setItem('test:key', JSON.stringify('old-value'));

      const parser = withLocalStorage('test:key', parseAsString);
      const result = parser.serialize('new-value');

      expect(result).toBe('new-value');
      expect(Storage.getItem('test:key')).toBe(JSON.stringify('new-value'));
    });

    it('should handle complex types', () => {
      const parser = withLocalStorage('test:key', parseAsInteger);
      const result = parser.serialize(123);

      expect(result).toBe('123');
      expect(Storage.getItem('test:key')).toBe(JSON.stringify(123));
    });

    it('should handle localStorage errors gracefully during serialize', () => {
      // Mock localStorage directly
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = jest.fn(() => {
        throw new Error('Quota exceeded');
      });

      const parser = withLocalStorage('test:key', parseAsString);
      const result = parser.serialize('value');

      // Should still return serialized value even if localStorage fails
      expect(result).toBe('value');

      // Restore
      localStorage.setItem = originalSetItem;
    });
  });

  describe('builder methods', () => {
    it('should be chainable with .withDefault()', () => {
      const parser = withLocalStorage('test:key', parseAsString).withDefault('default');

      // The parser itself still returns null when empty
      // The default value is applied by the hook, not the parser
      const result = parser.parse(null as any);
      expect(result).toBeNull();

      // But the parser should have the defaultValue property for the hook to use
      expect(parser).toHaveProperty('defaultValue', 'default');
    });

    it('should be chainable with .withOptions()', () => {
      const parser = withLocalStorage('test:key', parseAsString).withOptions({
        shallow: false,
      });

      // Should still parse correctly
      const result = parser.parse('value');
      expect(result).toBe('value');
      expect(Storage.getItem('test:key')).toBe(JSON.stringify('value'));
    });

    it('should work with chained builder methods', () => {
      const parser = withLocalStorage('test:key', parseAsString)
        .withDefault('default')
        .withOptions({shallow: false});

      // Should still parse correctly
      const result = parser.parse('url-value');
      expect(result).toBe('url-value');

      // And should have the default value property
      expect(parser).toHaveProperty('defaultValue', 'default');
    });
  });

  describe('two-way sync behavior', () => {
    it('should sync from localStorage to URL on mount', () => {
      // Simulate a value already in localStorage
      Storage.setItem('test:key', JSON.stringify('stored-value'));

      const parser = withLocalStorage('test:key', parseAsString);

      // When URL is empty, parse returns the localStorage value
      const result = parser.parse(null as any);

      // This value would then be synced to URL by Nuqs automatically
      expect(result).toBe('stored-value');
    });

    it('should sync from URL to localStorage on read', () => {
      const parser = withLocalStorage('test:key', parseAsString);

      // Reading from URL syncs to localStorage
      parser.parse('url-value');

      expect(Storage.getItem('test:key')).toBe(JSON.stringify('url-value'));
    });

    it('should update both on write', () => {
      const parser = withLocalStorage('test:key', parseAsString);

      // Writing updates localStorage
      parser.serialize('new-value');

      expect(Storage.getItem('test:key')).toBe(JSON.stringify('new-value'));
    });

    it('should persist in localStorage for future reads', () => {
      const parser = withLocalStorage('test:key', parseAsString);

      // Write a value
      parser.serialize('persistent-value');

      // localStorage persists
      expect(Storage.getItem('test:key')).toBe(JSON.stringify('persistent-value'));

      // On next load with empty URL, localStorage value is used
      const result = parser.parse(null as any);
      expect(result).toBe('persistent-value');
    });
  });

  describe('edge cases', () => {
    it('should handle different storage keys independently', () => {
      const parser1 = withLocalStorage('key1', parseAsString);
      const parser2 = withLocalStorage('key2', parseAsString);

      parser1.serialize('value1');
      parser2.serialize('value2');

      expect(Storage.getItem('key1')).toBe(JSON.stringify('value1'));
      expect(Storage.getItem('key2')).toBe(JSON.stringify('value2'));
    });

    it('should handle rapid updates', () => {
      const parser = withLocalStorage('test:key', parseAsString);

      parser.serialize('value1');
      parser.serialize('value2');
      parser.serialize('value3');

      expect(Storage.getItem('test:key')).toBe(JSON.stringify('value3'));
    });

    it('should handle empty strings as valid values', () => {
      const parser = withLocalStorage('test:key', parseAsString);

      // Empty string is a valid value and should be stored
      parser.serialize('');
      expect(Storage.getItem('test:key')).toBe(JSON.stringify(''));

      // Can read it back
      const result = parser.parse(null as any);
      expect(result).toBe('');
    });
  });
});

describe('withStorage', () => {
  // Create a custom in-memory storage implementation for testing
  let memoryStorage: Storage;

  beforeEach(() => {
    const store = new Map<string, string>();
    memoryStorage = {
      length: 0,
      key: (_index: number) => null,
      clear: () => store.clear(),
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
    };
  });

  it('should work with custom storage implementation', () => {
    const parser = withStorage(memoryStorage, 'test:key', parseAsString);

    // Write to URL should sync to custom storage
    parser.serialize('custom-value');
    expect(memoryStorage.getItem('test:key')).toBe(JSON.stringify('custom-value'));

    // Read from storage when URL is empty
    const result = parser.parse(null as any);
    expect(result).toBe('custom-value');
  });

  it('should work with sessionStorage', () => {
    sessionStorage.clear();

    const parser = withStorage(sessionStorage, 'test:key', parseAsString);

    // Write to URL should sync to sessionStorage
    parser.serialize('session-value');
    expect(sessionStorage.getItem('test:key')).toBe(JSON.stringify('session-value'));

    // Read from sessionStorage when URL is empty
    const result = parser.parse(null as any);
    expect(result).toBe('session-value');

    sessionStorage.clear();
  });

  it('should isolate different storage instances', () => {
    const store1 = new Map<string, string>();
    const storage1: Storage = {
      length: 0,
      key: () => null,
      clear: () => store1.clear(),
      getItem: (key: string) => store1.get(key) ?? null,
      setItem: (key: string, value: string) => store1.set(key, value),
      removeItem: (key: string) => store1.delete(key),
    };

    const store2 = new Map<string, string>();
    const storage2: Storage = {
      length: 0,
      key: () => null,
      clear: () => store2.clear(),
      getItem: (key: string) => store2.get(key) ?? null,
      setItem: (key: string, value: string) => store2.set(key, value),
      removeItem: (key: string) => store2.delete(key),
    };

    const parser1 = withStorage(storage1, 'key', parseAsString);
    const parser2 = withStorage(storage2, 'key', parseAsString);

    parser1.serialize('value1');
    parser2.serialize('value2');

    expect(storage1.getItem('key')).toBe(JSON.stringify('value1'));
    expect(storage2.getItem('key')).toBe(JSON.stringify('value2'));
  });

  it('should handle storage that throws errors', () => {
    const errorStorage: Storage = {
      length: 0,
      key: () => null,
      clear: () => {},
      getItem: () => {
        throw new Error('Storage unavailable');
      },
      setItem: () => {
        throw new Error('Storage unavailable');
      },
      removeItem: () => {
        throw new Error('Storage unavailable');
      },
    };

    const parser = withStorage(errorStorage, 'test:key', parseAsString);

    // Should not throw when storage errors occur
    expect(() => parser.serialize('value')).not.toThrow();
    expect(() => parser.parse(null as any)).not.toThrow();

    // Should return null when storage is unavailable
    const result = parser.parse(null as any);
    expect(result).toBeNull();
  });
});

describe('withLocalStorage as specialized withStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should be equivalent to withStorage(localStorage, ...)', () => {
    const parser1 = withLocalStorage('test:key', parseAsString);
    const parser2 = withStorage(localStorage, 'test:key', parseAsString);

    // Both should sync to localStorage
    parser1.serialize('value1');
    expect(localStorage.getItem('test:key')).toBe(JSON.stringify('value1'));

    parser2.serialize('value2');
    expect(localStorage.getItem('test:key')).toBe(JSON.stringify('value2'));

    // Both should read from localStorage
    const result1 = parser1.parse(null as any);
    const result2 = parser2.parse(null as any);
    expect(result1).toBe(result2);
    expect(result1).toBe('value2');
  });
});

describe('withSessionStorage', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('should use sessionStorage for storage', () => {
    const parser = withSessionStorage('test:key', parseAsString);

    // Write to URL should sync to sessionStorage
    parser.serialize('session-value');
    expect(sessionStorage.getItem('test:key')).toBe(JSON.stringify('session-value'));

    // Should NOT write to localStorage
    expect(localStorage.getItem('test:key')).toBeNull();
  });

  it('should fall back to sessionStorage when URL is empty', () => {
    sessionStorage.setItem('test:key', JSON.stringify('stored-session-value'));

    const parser = withSessionStorage('test:key', parseAsString);
    const result = parser.parse(null as any);

    expect(result).toBe('stored-session-value');
  });

  it('should return null when both URL and sessionStorage are empty', () => {
    const parser = withSessionStorage('test:key', parseAsString);
    const result = parser.parse(null as any);

    expect(result).toBeNull();
  });

  it('should sync URL value to sessionStorage', () => {
    const parser = withSessionStorage('test:key', parseAsString);
    const result = parser.parse('url-value');

    expect(result).toBe('url-value');
    expect(sessionStorage.getItem('test:key')).toBe(JSON.stringify('url-value'));
  });

  it('should work with .withDefault()', () => {
    const parser = withSessionStorage('test:key', parseAsInteger).withDefault(1);

    // When both URL and sessionStorage are empty, should have default
    expect(parser).toHaveProperty('defaultValue', 1);
  });

  it('should be equivalent to withStorage(sessionStorage, ...)', () => {
    const parser1 = withSessionStorage('test:key', parseAsString);
    const parser2 = withStorage(sessionStorage, 'test:key', parseAsString);

    // Both should sync to sessionStorage
    parser1.serialize('value1');
    expect(sessionStorage.getItem('test:key')).toBe(JSON.stringify('value1'));

    parser2.serialize('value2');
    expect(sessionStorage.getItem('test:key')).toBe(JSON.stringify('value2'));

    // Both should read from sessionStorage
    const result1 = parser1.parse(null as any);
    const result2 = parser2.parse(null as any);
    expect(result1).toBe(result2);
    expect(result1).toBe('value2');
  });

  it('should isolate sessionStorage from localStorage', () => {
    localStorage.clear();

    const localParser = withLocalStorage('test:key', parseAsString);
    const sessionParser = withSessionStorage('test:key', parseAsString);

    localParser.serialize('local-value');
    sessionParser.serialize('session-value');

    expect(localStorage.getItem('test:key')).toBe(JSON.stringify('local-value'));
    expect(sessionStorage.getItem('test:key')).toBe(JSON.stringify('session-value'));

    // Each parser reads from its own storage
    const localResult = localParser.parse(null as any);
    const sessionResult = sessionParser.parse(null as any);

    expect(localResult).toBe('local-value');
    expect(sessionResult).toBe('session-value');
  });

  it('should handle complex types with sessionStorage', () => {
    const parser = withSessionStorage('test:key', parseAsInteger);

    parser.serialize(42);
    expect(sessionStorage.getItem('test:key')).toBe(JSON.stringify(42));

    const result = parser.parse(null as any);
    expect(result).toBe(42);
  });
});
