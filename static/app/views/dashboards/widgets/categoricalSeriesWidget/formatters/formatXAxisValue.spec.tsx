import {formatXAxisValue} from './formatXAxisValue';

describe('formatXAxisValue', () => {
  it('returns "(empty)" for null values', () => {
    expect(formatXAxisValue(null)).toBe('(empty)');
  });

  it('returns string values unchanged', () => {
    expect(formatXAxisValue('Chrome')).toBe('Chrome');
    expect(formatXAxisValue('/api/users')).toBe('/api/users');
    expect(formatXAxisValue('')).toBe('');
  });

  it('formats number values with locale string', () => {
    expect(formatXAxisValue(42)).toBe('42');
    expect(formatXAxisValue(1000)).toBe('1,000');
    // toLocaleString() uses default precision (typically 3 decimal places)
    expect(formatXAxisValue(3.14159)).toBe('3.142');
  });

  it('formats boolean values as strings', () => {
    expect(formatXAxisValue(true)).toBe('true');
    expect(formatXAxisValue(false)).toBe('false');
  });

  it('formats string arrays by joining with comma', () => {
    expect(formatXAxisValue(['Chrome', 'Firefox'])).toBe('Chrome, Firefox');
    expect(formatXAxisValue(['single'])).toBe('single');
    expect(formatXAxisValue([])).toBe('');
  });

  it('handles null values within string arrays', () => {
    // Test defensive handling of unexpected null values in arrays
    // (TypeScript types don't allow this, but runtime data might have it)
    expect(formatXAxisValue(['Chrome', null, 'Safari'] as string[])).toBe(
      'Chrome, (empty), Safari'
    );
    expect(formatXAxisValue([null, null] as unknown as string[])).toBe(
      '(empty), (empty)'
    );
  });
});
