import {areNumbersAlmostEqual} from './areNumbersAlmostEqual';

describe('areNumbersAlmostEqual', () => {
  it.each([
    // Exact equality cases
    [100, 100, true], // positive integers
    [0, 0, true], // zero
    [-50, -50, true], // negative integers
    [0.123456789, 0.123456789, true], // decimal numbers
    [Infinity, Infinity, true], // positive infinity
    [-Infinity, -Infinity, true], // negative infinity
    [-0, 0, true], // negative zero and positive zero

    // NaN cases - never equal to anything, including itself
    [NaN, NaN, false], // NaN vs NaN
    [NaN, 100, false], // NaN vs number
    [100, NaN, false], // number vs NaN

    // Zero vs non-zero - 100% difference relative to non-zero number
    [0, 0.001, false], // zero vs small positive
    [0.001, 0, false], // small positive vs zero
    [0, -0.001, false], // zero vs small negative
    [-0.001, 0, false], // small negative vs zero

    // Within default threshold (0.5%)
    [100, 100.4, true], // positive within threshold - 0.4%
    [100, 100.5, true], // positive exactly at threshold - 0.5%
    [-100, -100.4, true], // negative within threshold - 0.4%
    [0.001, 0.001004, true], // small numbers within threshold - 0.4%
    [1e10, 1e10 + 4e7, true], // large numbers within threshold - 0.4%

    // Outside default threshold (0.5%)
    [100, 100.6, false], // positive outside threshold - 0.6%
    [-100, -100.6, false], // negative outside threshold - 0.6%
    [0.001, 0.001006, false], // small numbers outside threshold - 0.6%
    [1e10, 1e10 + 6e7, false], // large numbers outside threshold - 0.6%

    // Mixed signs - always large percentage differences
    [100, -100, false], // positive vs negative same magnitude - 200%
    [-50, 50, false], // negative vs positive same magnitude - 200%
    [1, -1, false], // crossing zero - 200%

    // Different magnitudes
    [1, 2, false], // small vs larger magnitude - 50% relative to 2
    [10, 11, false], // medium difference - ~9.1% relative to 11

    // Infinity cases
    [Infinity, -Infinity, false], // positive vs negative infinity
    [Infinity, 1e10, false], // infinity vs large number

    // Very small numbers close together
    [1e-15, 1.004e-15, true], // very small within threshold - 0.4%
    [1e-15, 1.006e-15, false], // very small outside threshold - 0.6%
    [1e-15, 0, false], // very small vs zero - 100%
  ])('handles case with default threshold correctly', (a, b, expected) => {
    expect(areNumbersAlmostEqual(a, b)).toBe(expected);
  });

  it.each([
    // Custom thresholds
    [100, 100.9, 1, true], // 1% threshold within - 0.9%
    [100, 101.1, 1, false], // 1% threshold outside - 1.1%
    [100, 101, 1, true], // 1% threshold exactly at - 1.0%
    [100, 104, 5, true], // 5% threshold within - 4%
    [100, 106, 5, false], // 5% threshold outside - 6%
    [100, 100, 0, true], // 0% threshold exact match
    [100, 100.001, 0, false], // 0% threshold tiny difference
    [100, 100.01, 0.01, true], // tiny threshold within - 0.01%
    [100, 100.011, 0.01, false], // tiny threshold outside - 0.011%
  ])('handles case with custom threshold correctly', (a, b, threshold, expected) => {
    expect(areNumbersAlmostEqual(a, b, threshold)).toBe(expected);
  });

  // Symmetry
  it.each([
    [100, 101],
    [50, 50.2],
    [1000, 1004],
    [-100, -100.4],
    [0.001, 0.001004],
    [1e10, 1e10 + 4e7],
  ])('is symmetric for values %d and %d', (a, b) => {
    expect(areNumbersAlmostEqual(a, b)).toBe(areNumbersAlmostEqual(b, a));
  });

  it.each([
    [100, 102, 1],
    [50, 52.5, 5],
  ])(
    'is symmetric with custom thresholds for %d, %d, threshold %d',
    (a, b, threshold) => {
      expect(areNumbersAlmostEqual(a, b, threshold)).toBe(
        areNumbersAlmostEqual(b, a, threshold)
      );
    }
  );
});
