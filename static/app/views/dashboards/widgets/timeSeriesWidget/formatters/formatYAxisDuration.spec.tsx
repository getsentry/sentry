import {formatYAxisDuration} from './formatYAxisDuration';

describe('formatYAxisDuration', () => {
  it.each([
    [-3600, '-3.6s'],
    [1, '1ms'],
    [1.1, '1.1ms'],
    [1001, '1.001s'],
    [0.21, '210μs'],
    [1000 * 60 * 60 * 24 * 5, '5d'],
    [1000 * 60 * 60 * 24 * 365 * 1000, '1,000yr'],
  ])('Formats %sms as %s', (milliseconds, result) => {
    expect(formatYAxisDuration(milliseconds)).toEqual(result);
  });
});
