import toRoundedPercent from 'sentry/utils/number/toRoundedPercent';

describe('toRoundedPercent', () => {
  it('should format a decimal into to percent', () => {
    expect(toRoundedPercent(0.666)).toBe('67%');
  });
});
