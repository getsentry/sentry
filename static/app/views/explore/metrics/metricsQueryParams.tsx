import type {ReactNode} from 'react';
import {useCallback, useMemo} from 'react';

import {defined} from 'sentry/utils';
import {createDefinedContext} from 'sentry/utils/performance/contexts/utils';
import {defaultQuery, type TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {
  MetricsFrozenContextProvider,
  type MetricsFrozenForTracesProviderProps,
} from 'sentry/views/explore/metrics/metricsFrozenContext';
import {MetricsStateQueryParamsProvider} from 'sentry/views/explore/metrics/metricsStateQueryParamsProvider';
import type {AggregateField} from 'sentry/views/explore/queryParams/aggregateField';
import {
  QueryParamsContextProvider,
  useQueryParamsVisualizes,
  useSetQueryParamsVisualizes,
} from 'sentry/views/explore/queryParams/context';
import {isGroupBy} from 'sentry/views/explore/queryParams/groupBy';
import {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import {
  isVisualizeFunction,
  parseVisualize,
  VisualizeFunction,
} from 'sentry/views/explore/queryParams/visualize';
import type {WritableQueryParams} from 'sentry/views/explore/queryParams/writableQueryParams';

interface TraceMetricContextValue {
  metric: TraceMetric;
  removeMetric: () => void;
  setTraceMetric: (traceMetric: TraceMetric) => void;
}

const [_MetricMetadataContextProvider, useTraceMetricContext, TraceMetricContext] =
  createDefinedContext<TraceMetricContextValue>({
    name: 'TraceMetricContext',
  });

interface MetricsQueryParamsProviderProps {
  children: ReactNode;
  queryParams: ReadableQueryParams;
  removeMetric: () => void;
  setQueryParams: (queryParams: ReadableQueryParams) => void;
  setTraceMetric: (traceMetric: TraceMetric) => void;
  traceMetric: TraceMetric;
  freeze?: MetricsFrozenForTracesProviderProps;
  isStateBased?: boolean;
}

export function MetricsQueryParamsProvider({
  children,
  queryParams,
  setQueryParams,
  setTraceMetric,
  removeMetric,
  traceMetric,
  freeze,
  isStateBased,
}: MetricsQueryParamsProviderProps) {
  const setWritableQueryParams = useCallback(
    (writableQueryParams: WritableQueryParams) => {
      const newQueryParams = updateQueryParams(queryParams, {
        query: getUpdatedValue(writableQueryParams.query, defaultQuery),
        aggregateFields: writableQueryParams.aggregateFields,
        aggregateSortBys: writableQueryParams.aggregateSortBys,
        mode: writableQueryParams.mode,
      });

      setQueryParams(newQueryParams);
    },
    [queryParams, setQueryParams]
  );

  const traceMetricContextValue = useMemo(
    () => ({
      metric: traceMetric,
      setTraceMetric,
      removeMetric,
    }),
    [setTraceMetric, removeMetric, traceMetric]
  );

  const QueryContextProvider = isStateBased
    ? MetricsStateQueryParamsProvider
    : QueryParamsContextProvider;

  return (
    <TraceMetricContext value={traceMetricContextValue}>
      <MetricsFrozenContextProvider
        traceIds={freeze?.traceIds ?? []}
        tracePeriod={freeze?.tracePeriod}
      >
        <QueryContextProvider
          queryParams={queryParams}
          setQueryParams={setWritableQueryParams}
          isUsingDefaultFields
          shouldManageFields={false}
        >
          {children}
        </QueryContextProvider>
      </MetricsFrozenContextProvider>
    </TraceMetricContext>
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

export function useMetricVisualize(): VisualizeFunction {
  const visualizes = useQueryParamsVisualizes();
  if (visualizes.length === 1 && isVisualizeFunction(visualizes[0]!)) {
    return visualizes[0];
  }
  throw new Error('Only 1 visualize per metric allowed');
}

export function useMetricLabel(): string {
  const visualize = useMetricVisualize();
  const {metric} = useTraceMetricContext();

  if (!visualize.parsedFunction) {
    return metric.name;
  }

  return `${visualize.parsedFunction.name}(${metric.name})`;
}

export function useSetTraceMetric() {
  const {setTraceMetric} = useTraceMetricContext();
  return setTraceMetric;
}

export function useRemoveMetric() {
  const {removeMetric} = useTraceMetricContext();
  return removeMetric;
}

export function useSetMetricVisualize() {
  const setVisualizes = useSetQueryParamsVisualizes();
  const setVisualize = useCallback(
    (newVisualize: VisualizeFunction) => {
      setVisualizes([newVisualize.serialize()]);
    },
    [setVisualizes]
  );
  return setVisualize;
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
