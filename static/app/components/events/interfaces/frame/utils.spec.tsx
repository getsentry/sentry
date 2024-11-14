import {hasFileExtension} from 'sentry/components/events/interfaces/frame/utils';

describe('hasFileExtension', () => {
  test('returns true for valid file names with extensions', () => {
    expect(hasFileExtension('example.tsx')).toBe(true);
    expect(hasFileExtension('document.py')).toBe(true);
    expect(hasFileExtension('photo.jpeg')).toBe(true);
    expect(hasFileExtension('archive.tar.gz')).toBe(true); // Testing for multi-part extensions
  });

  test('returns false for file names without extensions', () => {
    expect(hasFileExtension('example')).toBe(false);
    expect(hasFileExtension('<anonymous>')).toBe(false);
    expect(hasFileExtension('example.')).toBe(false);
    expect(hasFileExtension('https://sentry.sentry.io/issues/')).toBe(false);
  });

  test('handles edge cases and special characters correctly', () => {
    expect(hasFileExtension('.htaccess')).toBe(true); // Starting with a dot
    expect(hasFileExtension('example.TXT')).toBe(true); // Uppercase extension
    expect(hasFileExtension('example.tar.gz')).toBe(true); // Multi-part extension
    expect(hasFileExtension('')).toBe(false); // Empty string
    expect(hasFileExtension('example@.py')).toBe(true); // Special characters
  });
});
