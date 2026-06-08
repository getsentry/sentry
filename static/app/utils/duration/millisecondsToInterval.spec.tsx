import {
  millisecondsToClosestInterval,
  millisecondsToInterval,
} from 'sentry/utils/duration/millisecondsToInterval';

describe('millisecondsToInterval()', () => {
  it('converts to the largest even unit', () => {
    expect(millisecondsToInterval(604800000)).toBe('1w');
    expect(millisecondsToInterval(86400000)).toBe('1d');
    expect(millisecondsToInterval(3600000)).toBe('1h');
    expect(millisecondsToInterval(60000)).toBe('1m');
    expect(millisecondsToInterval(1000)).toBe('1s');
  });

  it('handles multiples of a unit', () => {
    expect(millisecondsToInterval(1209600000)).toBe('2w');
    expect(millisecondsToInterval(172800000)).toBe('2d');
    expect(millisecondsToInterval(14400000)).toBe('4h');
    expect(millisecondsToInterval(1800000)).toBe('30m');
    expect(millisecondsToInterval(5000)).toBe('5s');
    expect(millisecondsToInterval(30000)).toBe('30s');
  });

  it('prefers larger units when value divides evenly into multiple', () => {
    // 24h is evenly divisible by both hours and minutes, should return days
    expect(millisecondsToInterval(86400000)).toBe('1d');
    // 2h is evenly divisible by both hours and minutes, should return hours
    expect(millisecondsToInterval(7200000)).toBe('2h');
  });

  it('is the inverse of intervalToMilliseconds for supported formats', () => {
    // Round-trips from the intervalToMilliseconds spec
    expect(millisecondsToInterval(86400000)).toBe('1d');
    expect(millisecondsToInterval(604800000)).toBe('1w');
    expect(millisecondsToInterval(1800000)).toBe('30m');
    expect(millisecondsToInterval(900000)).toBe('15m');
    expect(millisecondsToInterval(300000)).toBe('5m');
    expect(millisecondsToInterval(60000)).toBe('1m');
  });

  it('returns undefined for values that do not divide evenly', () => {
    expect(millisecondsToInterval(1500)).toBeUndefined(); // 1.5s
    expect(millisecondsToInterval(999)).toBeUndefined(); // sub-second
    expect(millisecondsToInterval(2500)).toBeUndefined(); // 2.5s
  });

  it('returns undefined for invalid inputs', () => {
    expect(millisecondsToInterval(0)).toBeUndefined();
    expect(millisecondsToInterval(-3600000)).toBeUndefined();
    expect(millisecondsToInterval(Infinity)).toBeUndefined();
  });
});

describe('millisecondsToClosestInterval()', () => {
  it('returns exact interval strings for valid granularities', () => {
    expect(millisecondsToClosestInterval(15_000)).toBe('15s');
    expect(millisecondsToClosestInterval(30_000)).toBe('30s');
    expect(millisecondsToClosestInterval(60_000)).toBe('1m');
    expect(millisecondsToClosestInterval(5 * 60_000)).toBe('5m');
    expect(millisecondsToClosestInterval(30 * 60_000)).toBe('30m');
    expect(millisecondsToClosestInterval(3600_000)).toBe('1h');
    expect(millisecondsToClosestInterval(6 * 3600_000)).toBe('6h');
    expect(millisecondsToClosestInterval(24 * 3600_000)).toBe('24h');
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
    expect(millisecondsToClosestInterval(48 * 3600_000)).toBe('24h');
    expect(millisecondsToClosestInterval(7 * 86400_000)).toBe('24h');
  });

  it('returns undefined for invalid inputs', () => {
    expect(millisecondsToClosestInterval(0)).toBeUndefined();
    expect(millisecondsToClosestInterval(-60_000)).toBeUndefined();
    expect(millisecondsToClosestInterval(Infinity)).toBeUndefined();
  });
});
