import {parseFunction} from 'sentry/utils/discover/fields';

export type RollingStrategy = 'sum' | 'average';

const SUM_FUNCTIONS = new Set([
  'count',
  'count_unique',
  'count_if',
  'count_web_vitals',
  'count_miserable',
  'sum',
  'failure_count',
]);

/**
 * Classifies an aggregate function string as either 'sum' (additive) or 'average'
 * (non-additive) for use in rolling window computation.
 *
 * Sum aggregates can be added together when combining sub-intervals into a rolling
 * window. Non-additive aggregates (percentiles, averages, rates) use a simple
 * average as an approximation.
 *
 * Unknown functions default to 'average' as a safe fallback.
 */
export function getAggregateRollingStrategy(aggregate: string): RollingStrategy {
  const parsed = parseFunction(aggregate);
  if (!parsed) {
    return 'average';
  }
  return SUM_FUNCTIONS.has(parsed.name) ? 'sum' : 'average';
}
