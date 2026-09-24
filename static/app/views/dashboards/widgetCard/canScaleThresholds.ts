import {getEquation, isEquation, parseFunction} from 'sentry/utils/discover/fields';
import {AggregationKey} from 'sentry/utils/fields';
import type {Widget} from 'sentry/views/dashboards/types';
import {usesTimeSeriesData} from 'sentry/views/dashboards/utils';

const SCALABLE_AGGREGATES = new Set<string>([
  AggregationKey.COUNT,
  AggregationKey.COUNT_IF,
  AggregationKey.SUM,
  AggregationKey.FAILURE_COUNT,
]);

function isScalableAggregate(aggregate: string): boolean {
  if (isEquation(aggregate)) {
    return getEquation(aggregate).trim() !== '';
  }

  const functionName = parseFunction(aggregate)?.name;
  return functionName !== undefined && SCALABLE_AGGREGATES.has(functionName);
}

export function canScaleThresholds(
  widget: Pick<Widget, 'displayType' | 'queries'>
): boolean {
  return (
    usesTimeSeriesData(widget.displayType) &&
    widget.queries.length > 0 &&
    widget.queries.every(query => {
      const [aggregate] = query.aggregates;
      return (
        aggregate !== undefined &&
        query.aggregates.length === 1 &&
        isScalableAggregate(aggregate)
      );
    })
  );
}
