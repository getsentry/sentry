import {useMemo, type ReactNode} from 'react';
import type {Location} from 'history';

import {defined} from 'sentry/utils';
import {createDefinedContext} from 'sentry/utils/performance/contexts/utils';
import {decodeList} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {
  decodeMetricsQueryParams,
  defaultMetricQuery,
  encodeMetricQueryParams,
  type BaseMetricQuery,
  type MetricQuery,
  type TraceMetric,
} from 'sentry/views/explore/metrics/metricQuery';
import {ReadableQueryParams} from 'sentry/views/explore/queryParams/readableQueryParams';

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
            return {...metricQuery, metric: newTraceMetric};
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
