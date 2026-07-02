import {formatNumber} from 'sentry/utils/number/formatNumber';

describe('formatNumber()', () => {
  it('returns the value with commas when the value has 12 digits', () => {
    expect(formatNumber(123_456_789_012)).toBe('123,456,789,012');
  });

  it('returns the value with commas when the value has 13 digits', () => {
    expect(formatNumber(1_234_567_890_123)).toBe('1,234,567,890,123');
  });

  it('returns the value when the value has 14 digits', () => {
    expect(formatNumber(12_345_678_901_234)).toBe(12345678901234);
  });

  it('returns the value when the value has 15 digits', () => {
    expect(formatNumber(123_456_789_012_345)).toBe(123456789012345);
  });

  it('returns the value when the value does not have digits', () => {
    expect(formatNumber(1)).toBe('1');
  });

  it('returns the value when the value has fewer digits than NUMBER_MAX_FRACTION_DIGITS', () => {
    expect(formatNumber(1.2345)).toBe('1.2345');
  });

  it('returns a truncated value when the value has more digits than NUMBER_MAX_FRACTION_DIGITS', () => {
    expect(formatNumber(1.23456)).toBe('1.2345');
  });
});
