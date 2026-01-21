import {parseAsInteger, parseAsString} from 'nuqs';

import Storage from 'sentry/utils/localStorage';

import {withLocalStorage} from './withLocalStorage';

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
