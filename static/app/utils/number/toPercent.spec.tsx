import toPercent from 'sentry/utils/number/toPercent';

describe('toPercent', () => {
  it('should format a decimal into to percent', () => {
    expect(toPercent(0.5)).toBe('50.000%');
  });
});
