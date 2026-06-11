import {millisecondsToClosestInterval} from 'sentry/utils/duration/millisecondsToInterval';

const TEST_INTERVALS = [
  '1m',
  '2m',
  '5m',
  '10m',
  '15m',
  '30m',
  '1h',
  '2h',
  '3h',
  '4h',
  '6h',
  '12h',
  '1d',
];

describe('millisecondsToClosestInterval()', () => {
  it.each([
    [60_000, '1m'],
    [2 * 60_000, '2m'],
    [5 * 60_000, '5m'],
    [10 * 60_000, '10m'],
    [15 * 60_000, '15m'],
    [30 * 60_000, '30m'],
    [3600_000, '1h'],
    [6 * 3600_000, '6h'],
    [24 * 3600_000, '1d'],
  ])('returns an exact string for valid granularity (%s)', (ms, expected) => {
    expect(millisecondsToClosestInterval(ms, TEST_INTERVALS)).toBe(expected);
  });

  it.each([
    // 45s is between 30s and 1m — equidistant, ties go to larger
    [45_000, '1m'],
    // 50s is closer to 1m (60s) than to 30s
    [50_000, '1m'],
    // 4m is closer to 5m than to 2m
    [4 * 60_000, '5m'],
    // 7.5m is between 5m and 10m — equidistant, ties go to larger
    [7.5 * 60_000, '10m'],
    // 90m is between 1h and 2h — equidistant, ties go to larger
    [90 * 60_000, '2h'],
    // 100m is closer to 2h than to 1h
    [100 * 60_000, '2h'],
  ])(
    'rounds to the nearest interval when between two valid granularities (%s)',
    (ms, expected) => {
      expect(millisecondsToClosestInterval(ms, TEST_INTERVALS)).toBe(expected);
    }
  );

  it.each([
    [1_000, '1m'],
    [5_000, '1m'],
  ])(
    'clamps to the smallest valid interval for values below the minimum (%s)',
    (ms, expected) => {
      expect(millisecondsToClosestInterval(ms, TEST_INTERVALS)).toBe(expected);
    }
  );

  it.each([
    [48 * 3600_000, '1d'],
    [7 * 86400_000, '1d'],
  ])(
    'clamps to the largest valid interval for values above the maximum (%s)',
    (ms, expected) => {
      expect(millisecondsToClosestInterval(ms, TEST_INTERVALS)).toBe(expected);
    }
  );

  it.each([
    [0, undefined],
    [-60_000, undefined],
    [Infinity, undefined],
  ])('returns undefined for invalid inputs (%s)', (ms, expected) => {
    expect(millisecondsToClosestInterval(ms, TEST_INTERVALS)).toBe(expected);
  });

  describe('less availableIntervals option', () => {
    const availableIntervals = ['1m', '5m', '1h'];

    it.each([
      // 90s is closer to 1m (diff=30s) than to 15s (diff=75s) among available intervals
      [90_000, '1m'],
      // 3m is equidistant between 1m and 5m — ties go to larger
      [3 * 60_000, '5m'],
      // exact match still works
      [5 * 60_000, '5m'],
    ])('restricts selection to the provided available intervals (%s)', (ms, expected) => {
      expect(millisecondsToClosestInterval(ms, availableIntervals)).toBe(expected);
    });

    it.each([[1_000, '1m']])(
      'clamps to the first available interval for values below the minimum (%s)',
      (ms, expected) => {
        expect(millisecondsToClosestInterval(ms, availableIntervals)).toBe(expected);
      }
    );

    it.each([
      [48 * 3600_000, '1h'],
      [7 * 86400_000, '1h'],
    ])(
      'clamps to the last available interval for values above the maximum (%s)',
      (ms, expected) => {
        expect(millisecondsToClosestInterval(ms, availableIntervals)).toBe(expected);
      }
    );
  });
});
