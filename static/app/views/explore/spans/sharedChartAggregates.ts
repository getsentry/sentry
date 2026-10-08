import {t} from 'sentry/locale';
import {AggregationKey} from 'sentry/utils/fields';
import {parseConditionalAggregate} from 'sentry/views/explore/utils/conditionalAggregate';

/**
 * Aggregates that can be selected together and plotted on one chart, grouped
 * the same way as the Metrics aggregate picker. They all take the same numeric
 * argument, so together they share a unit and a Y axis.
 */
export const SHARED_CHART_AGGREGATE_REGIONS: ReadonlyArray<{
  aggregates: readonly string[];
  key: string;
  label: string;
}> = [
  {
    key: 'percentiles',
    label: t('Percentiles'),
    aggregates: [
      AggregationKey.P50,
      AggregationKey.P75,
      AggregationKey.P90,
      AggregationKey.P95,
      AggregationKey.P99,
      AggregationKey.P100,
    ],
  },
  {
    key: 'stats',
    label: t('Stats'),
    aggregates: [AggregationKey.AVG, AggregationKey.MIN, AggregationKey.MAX],
  },
];

export const SHARED_CHART_AGGREGATES: readonly string[] =
  SHARED_CHART_AGGREGATE_REGIONS.flatMap(region => region.aggregates);

/**
 * Whether the y axes can be plotted on one chart. This only holds for what the
 * aggregate picker can select together: aggregates from
 * `SHARED_CHART_AGGREGATES` over the same arguments and filter. Anything else,
 * such as older queries that overlaid `count()` with a duration, keeps a
 * chart per y axis so units are never mixed on one Y axis.
 */
export function canShareChart(yAxes: readonly string[]): boolean {
  if (yAxes.length < 2) {
    return false;
  }

  const parsed = yAxes.map(parseConditionalAggregate);
  const [first] = parsed;
  if (!first) {
    return false;
  }
  const argumentsKey = JSON.stringify(first.arguments);

  return parsed.every(
    aggregate =>
      aggregate !== null &&
      SHARED_CHART_AGGREGATES.includes(aggregate.name) &&
      JSON.stringify(aggregate.arguments) === argumentsKey &&
      aggregate.filter === first.filter
  );
}
