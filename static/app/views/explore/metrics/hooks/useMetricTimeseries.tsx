import {useCallback} from 'react';

import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {formatSort} from 'sentry/views/explore/contexts/pageParamsContext/sortBys';
import {useChartInterval} from 'sentry/views/explore/hooks/useChartInterval';
import {shouldTriggerHighAccuracy} from 'sentry/views/explore/hooks/useExploreTimeseries';
import {
  useProgressiveQuery,
  type RPCQueryExtras,
} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {useTopEvents} from 'sentry/views/explore/hooks/useTopEvents';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {useMetricVisualize} from 'sentry/views/explore/metrics/metricsQueryParams';
import {
  useQueryParamsAggregateSortBys,
  useQueryParamsGroupBys,
  useQueryParamsSearch,
} from 'sentry/views/explore/queryParams/context';
import {useSortedTimeSeries} from 'sentry/views/insights/common/queries/useSortedTimeSeries';

interface UseMetricTimeseriesOptions {
  enabled: boolean;
  traceMetric: TraceMetric;
}

export function useMetricTimeseries({traceMetric, enabled}: UseMetricTimeseriesOptions) {
  const visualize = useMetricVisualize();
  const topEvents = useTopEvents();
  const canTriggerHighAccuracy = useCallback(
    (result: ReturnType<typeof useMetricTimeseriesImpl>['result']) => {
      return shouldTriggerHighAccuracy(result.data, [visualize], !!topEvents);
    },
    [visualize, topEvents]
  );
  return useProgressiveQuery<typeof useMetricTimeseriesImpl>({
    queryHookImplementation: useMetricTimeseriesImpl,
    queryHookArgs: {traceMetric, queryExtras: undefined, enabled},
    queryOptions: {
      canTriggerHighAccuracy,
    },
  });
}

interface UseMetricTimeseriesImplOptions extends UseMetricTimeseriesOptions {
  queryExtras?: RPCQueryExtras;
}

function useMetricTimeseriesImpl({
  traceMetric,
  queryExtras,
  enabled,
}: UseMetricTimeseriesImplOptions) {
  const visualize = useMetricVisualize();
  const groupBys = useQueryParamsGroupBys();
  const [interval] = useChartInterval();
  const topEvents = useTopEvents();
  const search = useQueryParamsSearch();
  const sortBys = useQueryParamsAggregateSortBys();

  const timeseriesResult = useSortedTimeSeries(
    {
      search,
      yAxis: [visualize.yAxis],
      interval,
      fields: [...groupBys, visualize.yAxis],
      enabled: enabled && Boolean(traceMetric.name),
      topEvents,
      orderby: sortBys.map(formatSort),
      ...queryExtras,
    },
    'api.explore.tracemetrics-timeseries',
    DiscoverDatasets.TRACEMETRICS
  );

  return {
    result: timeseriesResult,
  };
}
