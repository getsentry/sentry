import {parseFunction} from 'sentry/utils/discover/fields';

/**
 * Highlights the group that strays furthest from the others. It runs in the
 * browser on the series already fetched, so it's never sent to the backend.
 */
export const OUTLIERS_TRANSFORMATION = 'outliers(mad)';

function isOutliersTransformation(raw: string): boolean {
  return parseFunction(raw)?.name === 'outliers';
}

export function hasOutliersTransformation(transformations: readonly string[]): boolean {
  return transformations.some(isOutliersTransformation);
}

/**
 * The transformations the backend applies, without the ones applied in the
 * browser. Returns the same array when there's nothing to remove, so memoized
 * queries keep their keys.
 */
export function getServerTransformations(
  transformations: readonly string[]
): readonly string[] {
  return hasOutliersTransformation(transformations)
    ? transformations.filter(raw => !isOutliersTransformation(raw))
    : transformations;
}

/**
 * Aggregates that grow with traffic. Outliers compares them by shape, since
 * the busiest group would otherwise always stand out.
 */
const COUNT_LIKE_AGGREGATES = new Set([
  'count',
  'count_if',
  'count_unique',
  'epm',
  'eps',
  'sum',
  'sum_if',
  'tpm',
]);

export function isCountLikeAggregate(yAxis: string): boolean {
  const name = parseFunction(yAxis)?.name;
  return name !== undefined && COUNT_LIKE_AGGREGATES.has(name);
}
