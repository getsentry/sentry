import {formatInvestigationDuration} from 'sentry/utils/duration/formatInvestigationDuration';

describe('formatInvestigationDuration', () => {
  it.each([
    [0, '0.0 s'],
    [0.099, '0.0 s'],
    [34.59, '34.5 s'],
    [59.949, '59.9 s'],
    [59.999, '59.9 s'],
    [60, '1m 0s'],
    [60.999, '1m 0s'],
    [72, '1m 12s'],
    [119.999, '1m 59s'],
    [120, '2m 0s'],
    [725, '12m 5s'],
  ])('formats %s seconds as %s', (seconds, expected) => {
    expect(formatInvestigationDuration(seconds)).toBe(expected);
  });
});
