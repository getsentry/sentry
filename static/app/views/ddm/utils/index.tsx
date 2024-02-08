import {BooleanOperator} from 'sentry/components/searchSyntax/parser';
import type {MetricWidgetQueryParams} from 'sentry/utils/metrics/types';

function constructQueryString(queryObject: Record<string, string>) {
  return Object.entries(queryObject)
    .map(([key, value]) => `${key}:"${value}"`)
    .join(' ');
}

export function getQueryWithFocusedSeries(widget: MetricWidgetQueryParams) {
  const focusedSeriesQuery = widget.focusedSeries
    ?.map(series => {
      if (!series.groupBy) {
        return '';
      }
      return `(${constructQueryString(series.groupBy)})`;
    })
    .filter(Boolean)
    .join(` ${BooleanOperator.OR} `);

  return focusedSeriesQuery
    ? `${widget.query} (${focusedSeriesQuery})`.trim()
    : widget.query;
}
