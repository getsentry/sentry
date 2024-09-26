import {formatApdex} from 'sentry/utils/number/formatApdex';

describe('formatApdex', function () {
  it.each([
    [0, '0'],
    [0.2, '0.200'],
    [0.61, '0.610'],
    [0.781, '0.781'],
    [0.771231, '0.771'],
    [0.99999, '0.999'],
    [1.0, '1'],
  ])('%s', (value, expected) => {
    expect(formatApdex(value)).toEqual(expected);
  });
});
