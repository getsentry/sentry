import {millisecondsToClosestInterval} from 'sentry/utils/duration/millisecondsToInterval';

describe('millisecondsToClosestInterval()', () => {
  it('returns exact interval strings for valid granularities', () => {
    expect(millisecondsToClosestInterval(15_000)).toBe('15s');
    expect(millisecondsToClosestInterval(30_000)).toBe('30s');
    expect(millisecondsToClosestInterval(60_000)).toBe('1m');
    expect(millisecondsToClosestInterval(2 * 60_000)).toBe('2m');
    expect(millisecondsToClosestInterval(5 * 60_000)).toBe('5m');
    expect(millisecondsToClosestInterval(10 * 60_000)).toBe('10m');
    expect(millisecondsToClosestInterval(15 * 60_000)).toBe('15m');
    expect(millisecondsToClosestInterval(30 * 60_000)).toBe('30m');
    expect(millisecondsToClosestInterval(3600_000)).toBe('1h');
    expect(millisecondsToClosestInterval(6 * 3600_000)).toBe('6h');
    expect(millisecondsToClosestInterval(24 * 3600_000)).toBe('1d');
  });

  it('rounds to the nearest interval when between two valid granularities', () => {
    // 20s is closer to 15s than to 30s
    expect(millisecondsToClosestInterval(20_000)).toBe('15s');
    // 45s is between 30s and 1m — equidistant, ties go to larger
    expect(millisecondsToClosestInterval(45_000)).toBe('1m');
    // 50s is closer to 1m (60s) than to 30s
    expect(millisecondsToClosestInterval(50_000)).toBe('1m');
    // 4m is closer to 5m than to 2m
    expect(millisecondsToClosestInterval(4 * 60_000)).toBe('5m');
    // 7.5m is between 5m and 10m — equidistant, ties go to larger
    expect(millisecondsToClosestInterval(7.5 * 60_000)).toBe('10m');
    // 90m is between 1h and 2h — equidistant, ties go to larger
    expect(millisecondsToClosestInterval(90 * 60_000)).toBe('2h');
    // 100m is closer to 2h than to 1h
    expect(millisecondsToClosestInterval(100 * 60_000)).toBe('2h');
  });

  it('clamps to the smallest valid interval for values below the minimum', () => {
    expect(millisecondsToClosestInterval(1_000)).toBe('15s');
    expect(millisecondsToClosestInterval(5_000)).toBe('15s');
  });

  it('clamps to the largest valid interval for values above the maximum', () => {
    expect(millisecondsToClosestInterval(48 * 3600_000)).toBe('1d');
    expect(millisecondsToClosestInterval(7 * 86400_000)).toBe('1d');
  });

  it('returns undefined for invalid inputs', () => {
    expect(millisecondsToClosestInterval(0)).toBeUndefined();
    expect(millisecondsToClosestInterval(-60_000)).toBeUndefined();
    expect(millisecondsToClosestInterval(Infinity)).toBeUndefined();
  });

  describe('availableIntervals option', () => {
    const availableIntervals = [
      {label: '1 minute', value: '1m'},
      {label: '5 minutes', value: '5m'},
      {label: '1 hour', value: '1h'},
    ];

    it('restricts selection to the provided available intervals', () => {
      // 90s is closer to 1m (diff=30s) than to 15s (diff=75s) among available intervals
      expect(millisecondsToClosestInterval(90_000, {availableIntervals})).toBe('1m');
      // 3m is equidistant between 1m and 5m — ties go to larger
      expect(millisecondsToClosestInterval(3 * 60_000, {availableIntervals})).toBe('5m');
      // exact match still works
      expect(millisecondsToClosestInterval(5 * 60_000, {availableIntervals})).toBe('5m');
    });

    it('clamps to the first available interval for values below the minimum', () => {
      expect(millisecondsToClosestInterval(1_000, {availableIntervals})).toBe('1m');
    });

    it('clamps to the last available interval for values above the maximum', () => {
      expect(millisecondsToClosestInterval(48 * 3600_000, {availableIntervals})).toBe(
        '1h'
      );
    });
  });

  describe('useNextInterval option', () => {
    it('returns the next interval >= ms instead of the closest', () => {
      // 20s is between 15s and 30s — useNextInterval returns 30s
      expect(millisecondsToClosestInterval(20_000, {useNextInterval: true})).toBe('30s');
      // 4m is between 2m and 5m — useNextInterval returns 5m
      expect(millisecondsToClosestInterval(4 * 60_000, {useNextInterval: true})).toBe(
        '5m'
      );
      // exact match returns itself
      expect(millisecondsToClosestInterval(5 * 60_000, {useNextInterval: true})).toBe(
        '5m'
      );
    });
  });
});
