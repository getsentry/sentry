import type {ReactNode} from 'react';
import {useCallback} from 'react';

import {defined} from 'sentry/utils';
import {defaultQuery} from 'sentry/views/explore/metrics/metricQuery';
import type {AggregateField} from 'sentry/views/explore/queryParams/aggregateField';
import {
  QueryParamsContextProvider,
  useQueryParamsVisualizes,
} from 'sentry/views/explore/queryParams/context';
import {isGroupBy} from 'sentry/views/explore/queryParams/groupBy';
import {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import {parseVisualize} from 'sentry/views/explore/queryParams/visualize';
import type {WritableQueryParams} from 'sentry/views/explore/queryParams/writableQueryParams';

interface MetricsQueryParamsProviderProps {
  children: ReactNode;
  queryParams: ReadableQueryParams;
  setQueryParams: (queryParams: ReadableQueryParams) => void;
}

export function MetricsQueryParamsProvider({
  children,
  queryParams,
  setQueryParams,
}: MetricsQueryParamsProviderProps) {
  const setWritableQueryParams = useCallback(
    (writableQueryParams: WritableQueryParams) => {
      const newQueryParams = updateQueryParams(queryParams, {
        query: getUpdatedValue(writableQueryParams.query, defaultQuery),
      });

      setQueryParams(newQueryParams);
    },
    [queryParams, setQueryParams]
  );

  return (
    <QueryParamsContextProvider
      queryParams={queryParams}
      setQueryParams={setWritableQueryParams}
      isUsingDefaultFields
      shouldManageFields={false}
    >
      {children}
    </QueryParamsContextProvider>
  );
}

function getUpdatedValue<T>(
  newValue: T | null | undefined,
  defaultValue: () => T
): T | undefined {
  if (defined(newValue)) {
    return newValue;
  }

  if (newValue === null) {
    return defaultValue();
  }

  return undefined;
}

export function useMetricVisualize() {
  const visualizes = useQueryParamsVisualizes();
  if (visualizes.length === 1) {
    return visualizes[0]!;
  }
  throw new Error('Only 1 visualize per metric allowed');
}

function updateQueryParams(
  readableQueryParams: ReadableQueryParams,
  writableQueryParams: WritableQueryParams
): ReadableQueryParams {
  const aggregateFields: readonly AggregateField[] =
    writableQueryParams.aggregateFields?.flatMap<AggregateField>(aggregateField => {
      if (isGroupBy(aggregateField)) {
        return [aggregateField];
      }
      return parseVisualize(aggregateField);
    }) ?? [];
  return new ReadableQueryParams({
    extrapolate: writableQueryParams.extrapolate ?? readableQueryParams.extrapolate,
    mode: writableQueryParams.mode ?? readableQueryParams.mode,
    query: writableQueryParams.query ?? readableQueryParams.query,

    cursor: writableQueryParams.cursor ?? readableQueryParams.cursor,
    fields: writableQueryParams.fields ?? readableQueryParams.fields,
    sortBys: writableQueryParams.sortBys ?? readableQueryParams.sortBys,

    aggregateCursor:
      writableQueryParams.aggregateCursor ?? readableQueryParams.aggregateCursor,
    aggregateFields: aggregateFields.length
      ? aggregateFields
      : readableQueryParams.aggregateFields,
    aggregateSortBys:
      writableQueryParams.aggregateSortBys ?? readableQueryParams.aggregateSortBys,

    id: readableQueryParams.id,
    title: readableQueryParams.title,
  });
}
