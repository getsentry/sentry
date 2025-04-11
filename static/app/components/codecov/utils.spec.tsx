import {isValidCodecovRelativePeriod} from 'sentry/components/codecov/utils';

describe('isValidCodecovRelativePeriod', function () {
  it('returns false for null relative periods', function () {
    const period = null;
    expect(isValidCodecovRelativePeriod(period)).toBe(false);
  });
  it('returns false for periods not belonging to the Codecov default relative periods', function () {
    const period = '123d';
    expect(isValidCodecovRelativePeriod(period)).toBe(false);
  });
  it('returns true for a valid relative period', function () {
    const period = '7d';
    expect(isValidCodecovRelativePeriod(period)).toBe(true);
  });
});
