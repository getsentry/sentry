import {formatNumberWithDynamicDecimalPoints} from 'sentry/utils/number/formatNumberWithDynamicDecimalPoints';

describe('formatNumberWithDynamicDecimals', () => {
  it('rounds to two decimal points without forcing them', () => {
    expect(formatNumberWithDynamicDecimalPoints(1)).toBe('1');
    expect(formatNumberWithDynamicDecimalPoints(1.0)).toBe('1');
    expect(formatNumberWithDynamicDecimalPoints(1.5)).toBe('1.5');
    expect(formatNumberWithDynamicDecimalPoints(1.05)).toBe('1.05');
    expect(formatNumberWithDynamicDecimalPoints(1.004)).toBe('1');
    expect(formatNumberWithDynamicDecimalPoints(1.005)).toBe('1.01');
    expect(formatNumberWithDynamicDecimalPoints(1.1009)).toBe('1.1');
    expect(formatNumberWithDynamicDecimalPoints(2.236)).toBe('2.24');
  });

  it('rounds up to the maximum fraction digits passed', () => {
    expect(formatNumberWithDynamicDecimalPoints(1, 2)).toBe('1');
    expect(formatNumberWithDynamicDecimalPoints(1.0, 2)).toBe('1');
    expect(formatNumberWithDynamicDecimalPoints(1.2345, 1)).toBe('1.2');
    expect(formatNumberWithDynamicDecimalPoints(1.2345, 2)).toBe('1.23');
    expect(formatNumberWithDynamicDecimalPoints(1.2345, 3)).toBe('1.235');
    expect(formatNumberWithDynamicDecimalPoints(1.2345, 4)).toBe('1.2345');
    expect(formatNumberWithDynamicDecimalPoints(1.2345, 5)).toBe('1.2345');
  });

  it('preserves significant decimal places', () => {
    expect(formatNumberWithDynamicDecimalPoints(0.001234)).toBe('0.0012');
    expect(formatNumberWithDynamicDecimalPoints(0.000125)).toBe('0.00013');
    expect(formatNumberWithDynamicDecimalPoints(0.0000123)).toBe('0.000012');
  });

  it('handles zero, NaN and Infinity', () => {
    expect(formatNumberWithDynamicDecimalPoints(0)).toBe('0');
    expect(formatNumberWithDynamicDecimalPoints(NaN)).toBe('NaN');
    expect(formatNumberWithDynamicDecimalPoints(Infinity)).toBe('∞');
    expect(formatNumberWithDynamicDecimalPoints(-Infinity)).toBe('-∞');
  });

  it('handles negative numbers', () => {
    expect(formatNumberWithDynamicDecimalPoints(-1)).toBe('-1');
    expect(formatNumberWithDynamicDecimalPoints(-1.0)).toBe('-1');
    expect(formatNumberWithDynamicDecimalPoints(-1.5)).toBe('-1.5');
    expect(formatNumberWithDynamicDecimalPoints(-1.05)).toBe('-1.05');
    expect(formatNumberWithDynamicDecimalPoints(-1.004)).toBe('-1');
    expect(formatNumberWithDynamicDecimalPoints(-1.005)).toBe('-1.01');
    expect(formatNumberWithDynamicDecimalPoints(-1.1009)).toBe('-1.1');
    expect(formatNumberWithDynamicDecimalPoints(-2.236)).toBe('-2.24');
  });
});
