import {getEquation, isEquation} from 'sentry/utils/discover/fields';
import type {Widget} from 'sentry/views/dashboards/types';
import {usesTimeSeriesData} from 'sentry/views/dashboards/utils';

const SCALABLE_COUNTS = new Set(['count()', 'count(span.duration)']);

function isScalableAggregate(aggregate: string): boolean {
  return (
    SCALABLE_COUNTS.has(aggregate) ||
    /^sum\(.*\)$/.test(aggregate) ||
    (isEquation(aggregate) && getEquation(aggregate).trim() !== '')
  );
}

export function canScaleThresholds(
  widget: Pick<Widget, 'displayType' | 'queries'>
): boolean {
  return (
    usesTimeSeriesData(widget.displayType) &&
    widget.queries.length > 0 &&
    widget.queries.every(
      query => query.aggregates.length === 1 && isScalableAggregate(query.aggregates[0]!)
    )
  );
}
