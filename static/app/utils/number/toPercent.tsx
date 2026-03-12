/**
 * Format a fraction (0...1) into a percent, fixed & rounded to 3 decimal places.
 *
 * toPercent(0.42) === '42.000%'
 */
export function toPercent(value: number, places = 3) {
  return `${(value * 100).toFixed(places)}%`;
}
