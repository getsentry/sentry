import {useMemo, type ReactNode} from 'react';
import type {Location} from 'history';

import {defined} from 'sentry/utils';
import {createDefinedContext} from 'sentry/utils/performance/contexts/utils';
import {decodeList} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {
  DEFAULT_YAXIS_BY_TYPE,
  OPTIONS_BY_TYPE,
} from 'sentry/views/explore/metrics/constants';
import {
  decodeMetricsQueryParams,
  defaultMetricQuery,
  encodeMetricQueryParams,
  type BaseMetricQuery,
  type MetricQuery,
  type TraceMetric,
} from 'sentry/views/explore/metrics/metricQuery';
import {updateVisualizeYAxis} from 'sentry/views/explore/metrics/utils';
import {isGroupBy} from 'sentry/views/explore/queryParams/groupBy';
import type {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import {isVisualizeFunction} from 'sentry/views/explore/queryParams/visualize';

interface MultiMetricsQueryParamsContextValue {
  metricQueries: MetricQuery[];
}

const [
  _MultiMetricsQueryParamsContextProvider,
  useMultiMetricsQueryParamsContext,
  MultiMetricsQueryParamsContext,
] = createDefinedContext<MultiMetricsQueryParamsContextValue>({
  name: 'QueryParamsContext',
});

interface MultiMetricsQueryParamsProviderProps {
  children: ReactNode;
  allowUpTo?: number;
}

export function MultiMetricsQueryParamsProvider({
  children,
  allowUpTo,
}: MultiMetricsQueryParamsProviderProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const value: MultiMetricsQueryParamsContextValue = useMemo(() => {
    const metricQueries = getMultiMetricsQueryParamsFromLocation(location, allowUpTo);

    function setQueryParamsForIndex(i: number) {
      return function (newQueryParams: ReadableQueryParams) {
        const target = {...location, query: {...location.query}};

        const newMetricQueries: string[] = metricQueries
          .map((metricQuery: BaseMetricQuery, j: number) => {
            if (i !== j) {
              return metricQuery;
            }
            return {
              metric: metricQuery.metric,
              queryParams: newQueryParams,
            };
          })
          .map((metricQuery: BaseMetricQuery) => encodeMetricQueryParams(metricQuery))
          .filter(defined)
          .filter(Boolean);
        target.query.metric = newMetricQueries;

        navigate(target);
      };
    }

    function setTraceMetricForIndex(i: number) {
      return function (newTraceMetric: TraceMetric) {
        const target = {...location, query: {...location.query}};
        target.query.metric = metricQueries
          .map((metricQuery: BaseMetricQuery, j: number) => {
            if (i !== j) {
              return metricQuery;
            }

            // when changing trace metrics, we need to look at the currently selected
            // aggregation and make necessary adjustments
            const visualize = metricQuery.queryParams.visualizes[0];
            let aggregateFields = undefined;
            if (visualize && isVisualizeFunction(visualize)) {
              const selectedAggregation = visualize.parsedFunction?.name;
              const allowedAggregations = OPTIONS_BY_TYPE[newTraceMetric.type];

              if (
                selectedAggregation &&
                allowedAggregations?.find(option => option.value === selectedAggregation)
              ) {
                // the currently selected aggregation changed types
                aggregateFields = [
                  updateVisualizeYAxis(visualize, selectedAggregation, newTraceMetric),
                  ...metricQuery.queryParams.aggregateFields.filter(isGroupBy),
                ];
              } else {
                // the currently selected aggregation isn't supported on the new metric
                const defaultAggregation =
                  DEFAULT_YAXIS_BY_TYPE[newTraceMetric.type] || 'per_second';
                aggregateFields = [
                  updateVisualizeYAxis(visualize, defaultAggregation, newTraceMetric),
                  ...metricQuery.queryParams.aggregateFields.filter(isGroupBy),
                ];
              }
            }

            return {
              queryParams: metricQuery.queryParams.replace({aggregateFields}),
              metric: newTraceMetric,
            };
          })
          .map((metric: BaseMetricQuery) => encodeMetricQueryParams(metric))
          .filter(defined)
          .filter(Boolean);

        navigate(target);
      };
    }

    function removeMetricQueryForIndex(i: number) {
      return function () {
        // Don't allow removing the last metric query
        if (metricQueries.length <= 1) {
          return;
        }

        const target = {...location, query: {...location.query}};

        const newMetricQueries: string[] = metricQueries
          .filter((_, j) => i !== j)
          .map((metricQuery: BaseMetricQuery) => encodeMetricQueryParams(metricQuery))
          .filter(defined)
          .filter(Boolean);
        target.query.metric = newMetricQueries;

        navigate(target);
      };
    }

    return {
      metricQueries: metricQueries.map((metric: BaseMetricQuery, index: number) => {
        return {
          ...metric,
          setQueryParams: setQueryParamsForIndex(index),
          setTraceMetric: setTraceMetricForIndex(index),
          removeMetric: removeMetricQueryForIndex(index),
        };
      }),
    };
  }, [location, navigate, allowUpTo]);

  return (
    <MultiMetricsQueryParamsContext value={value}>
      {children}
    </MultiMetricsQueryParamsContext>
  );
}

function getMultiMetricsQueryParamsFromLocation(
  location: Location,
  limit?: number
): BaseMetricQuery[] {
  const rawQueryParams = decodeList(location.query.metric);

  const metricQueries = rawQueryParams.map(decodeMetricsQueryParams).filter(defined);

  const queries = metricQueries.length ? metricQueries : [defaultMetricQuery()];

  return limit ? queries.slice(0, limit) : queries;
}

export function useMultiMetricsQueryParams() {
  const {metricQueries} = useMultiMetricsQueryParamsContext();
  return metricQueries;
}

export function useAddMetricQuery() {
  const location = useLocation();
  const navigate = useNavigate();
  const {metricQueries} = useMultiMetricsQueryParamsContext();

  return function () {
    const target = {...location, query: {...location.query}};

    const newMetricQueries: string[] = [
      ...metricQueries,
      metricQueries[metricQueries.length - 1] ?? defaultMetricQuery(),
    ]
      .map((metricQuery: BaseMetricQuery) => encodeMetricQueryParams(metricQuery))
      .filter(defined)
      .filter(Boolean);
    target.query.metric = newMetricQueries;

    navigate(target);
  };
}
