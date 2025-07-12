import toPercent from 'sentry/utils/number/toPercent';

describe('toPercent', () => {
  it('should format a decimal into to percent, 3 decimal places by default', () => {
    expect(toPercent(0.5)).toBe('50.000%');
  });

  it('should format a decimal into to percent, using the provided number of decimal places', () => {
    expect(toPercent(0.5, 2)).toBe('50.00%');
  });
});
