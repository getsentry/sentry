import {parseFunction} from 'sentry/utils/discover/fields';

/**
 * Functions whose empty buckets really are zero. For the rest (averages,
 * percentiles, ...) an empty bucket means "no data", not a value of 0.
 */
const ZERO_WHEN_EMPTY_FUNCTIONS = new Set([
  'count',
  'count_if',
  'count_unique',
  'epm',
  'eps',
  'failure_count',
  'sum',
  'sum_if',
]);

export function isZeroWhenEmpty(yAxis: string): boolean {
  const name = parseFunction(yAxis)?.name;
  return name !== undefined && ZERO_WHEN_EMPTY_FUNCTIONS.has(name);
}

/**
 * Smoothing hides and delays the spikes and dips Seer looks for, so it can't be
 * on together with anomalies.
 */
export function hasSmoothing(transformations: readonly string[]): boolean {
  return transformations.some(raw => parseFunction(raw)?.name === 'smooth');
}

/**
 * The transformations applied to the series sent to Seer: only the chart's
 * fill, so what's scored matches the gaps the user sees.
 */
export function getAnomalyTransformations(
  transformations: readonly string[]
): readonly string[] {
  return transformations.filter(raw => parseFunction(raw)?.name === 'fill');
}
