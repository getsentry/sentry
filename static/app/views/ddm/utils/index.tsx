import {BooleanOperator} from 'sentry/components/searchSyntax/parser';
import type {FocusedMetricsSeries} from 'sentry/utils/metrics/types';

function constructQueryString(queryObject: Record<string, string>) {
  return Object.entries(queryObject)
    .map(([key, value]) => `${key}:"${value}"`)
    .join(' ');
}

export function getQueryWithFocusedSeries(
  query: string,
  focusedSeries?: FocusedMetricsSeries[]
) {
  const focusedSeriesQuery = focusedSeries
    ?.map(series => {
      if (!series.groupBy || Object.keys(series.groupBy).length === 0) {
        return '';
      }
      return `(${constructQueryString(series.groupBy)})`;
    })
    .filter(Boolean)
    .join(` ${BooleanOperator.OR} `);

  return focusedSeriesQuery ? `${query} (${focusedSeriesQuery})`.trim() : query;
}
