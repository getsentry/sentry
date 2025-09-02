import {parsePeriodToHours} from 'sentry/utils/duration/parsePeriodToHours';

describe('parsePeriodToHours()', () => {
  it('can convert standard formats', () => {
    expect(parsePeriodToHours('30s').toFixed(4)).toBe('0.0083');
    expect(parsePeriodToHours('1m').toFixed(4)).toBe('0.0167');
    expect(parsePeriodToHours('1h')).toBe(1);
    expect(parsePeriodToHours('24h')).toBe(24);
    expect(parsePeriodToHours('1d')).toBe(24);
    expect(parsePeriodToHours('2w')).toBe(336);
  });

  it('handle invalid statsPeriod', () => {
    expect(parsePeriodToHours('24')).toBe(24 / 3600);
    expect(parsePeriodToHours('')).toBe(-1);
    expect(parsePeriodToHours('24x')).toBe(-1);
  });
});
