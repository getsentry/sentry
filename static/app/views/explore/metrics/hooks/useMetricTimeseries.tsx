import {useCallback, useMemo} from 'react';

import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
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
  queryExtras?: RPCQueryExtras;
}

export function useMetricTimeseries({
  traceMetric,
  queryExtras,
  enabled,
}: UseMetricTimeseriesOptions) {
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
    queryHookArgs: {traceMetric, queryExtras, enabled},
    queryOptions: {
      canTriggerHighAccuracy,
    },
  });
}

function useMetricTimeseriesImpl({
  traceMetric,
  queryExtras,
  enabled,
}: UseMetricTimeseriesOptions) {
  const visualize = useMetricVisualize();
  const groupBys = useQueryParamsGroupBys();
  const [interval] = useChartInterval();
  const topEvents = useTopEvents();
  const searchQuery = useQueryParamsSearch();
  const sortBys = useQueryParamsAggregateSortBys();

  const search = useMemo(() => {
    const currentSearch = new MutableSearch(`metric.name:${traceMetric.name}`);
    if (!searchQuery.isEmpty()) {
      currentSearch.addStringFilter(searchQuery.formatString());
    }
    return currentSearch;
  }, [traceMetric.name, searchQuery]);

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
    'api.explore.metrics-stats',
    DiscoverDatasets.TRACEMETRICS
  );

  return {
    result: timeseriesResult,
  };
}
