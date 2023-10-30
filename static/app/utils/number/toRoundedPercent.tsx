/**
 * Format a fraction (0...1) into a percent, rounded to the nearest decimal place.
 *
 * toRoundedPercent(0.42555) === '42%'
 */
export default function toRoundedPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}
