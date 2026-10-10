import {formatElapsedDuration} from 'sentry/utils/duration/formatElapsedDuration';

describe('formatElapsedDuration', () => {
  it.each([
    [0, '0.0s'],
    [99, '0.0s'],
    [34_590, '34.5s'],
    [59_949, '59.9s'],
    [59_999, '59.9s'],
    [60_000, '1m 0s'],
    [60_999, '1m 0s'],
    [72_000, '1m 12s'],
    [119_999, '1m 59s'],
    [120_000, '2m 0s'],
    [725_000, '12m 5s'],
    [3_599_999, '59m 59s'],
    [3_600_000, '1h 0m 0s'],
    [3_723_000, '1h 2m 3s'],
  ])('formats %s ms as %s', (ms, expected) => {
    expect(formatElapsedDuration(ms)).toBe(expected);
  });
});
