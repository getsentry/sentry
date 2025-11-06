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
import {isGroupBy} from 'sentry/views/explore/queryParams/groupBy';
import type {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';
import {
  isVisualizeFunction,
  VisualizeFunction,
} from 'sentry/views/explore/queryParams/visualize';

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
}

export function MultiMetricsQueryParamsProvider({
  children,
}: MultiMetricsQueryParamsProviderProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const value: MultiMetricsQueryParamsContextValue = useMemo(() => {
    const metricQueries = getMultiMetricsQueryParamsFromLocation(location);

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
                !allowedAggregations?.find(option => option.value === selectedAggregation)
              ) {
                // the currently selected aggregation isn't supported on the new metric
                const defaultAggregation =
                  DEFAULT_YAXIS_BY_TYPE[newTraceMetric.type] || 'per_second';
                aggregateFields = [
                  new VisualizeFunction(`${defaultAggregation}(value)`),
                  ...metricQuery.queryParams.aggregateFields.filter(isGroupBy),
                ];
              } else if (
                selectedAggregation === 'per_second' ||
                selectedAggregation === 'per_minute'
              ) {
                // TODO: this else if branch can go away once the metric type is lifted
                // to the top level

                // the currently selected aggregation changed types
                aggregateFields = [
                  new VisualizeFunction(`${selectedAggregation}(value)`),
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
  }, [location, navigate]);

  return (
    <MultiMetricsQueryParamsContext value={value}>
      {children}
    </MultiMetricsQueryParamsContext>
  );
}

function getMultiMetricsQueryParamsFromLocation(location: Location): BaseMetricQuery[] {
  const rawQueryParams = decodeList(location.query.metric);

  const metricQueries = rawQueryParams.map(decodeMetricsQueryParams).filter(defined);
  if (metricQueries.length) {
    return metricQueries;
  }
  return [defaultMetricQuery()];
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

    const newMetricQueries: string[] = [...metricQueries, defaultMetricQuery()]
      .map((metricQuery: BaseMetricQuery) => encodeMetricQueryParams(metricQuery))
      .filter(defined)
      .filter(Boolean);
    target.query.metric = newMetricQueries;

    navigate(target);
  };
}
