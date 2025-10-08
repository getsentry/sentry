import type {ReactNode} from 'react';
import {useMemo} from 'react';
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

    function setMetricNameForIndex(i: number) {
      return function (newMetricName: string) {
        const target = {...location, query: {...location.query}};
        target.query.metric = metricQueries
          .map((metric: BaseMetricQuery, j: number) => {
            if (i !== j) {
              return metric;
            }
            return {
              ...metric,
              metric: {name: newMetricName},
            };
          })
          .map((metric: BaseMetricQuery) => encodeMetricQueryParams(metric))
          .filter(defined)
          .filter(Boolean);

        navigate(target);
      };
    }

    return {
      metricQueries: metricQueries.map((metric: BaseMetricQuery, index: number) => {
        return {
          ...metric,
          setQueryParams: setQueryParamsForIndex(index),
          setMetricName: setMetricNameForIndex(index),
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
