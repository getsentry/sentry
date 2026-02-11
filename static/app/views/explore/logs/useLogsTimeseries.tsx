import {useCallback, useMemo} from 'react';

import {useCaseInsensitivity} from 'sentry/components/searchQueryBuilder/hooks';
import {defined} from 'sentry/utils';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {determineSeriesSampleCountAndIsSampled} from 'sentry/views/alerts/rules/metric/utils/determineSeriesSampleCount';
import {useLogsAutoRefreshEnabled} from 'sentry/views/explore/contexts/logs/logsAutoRefreshContext';
import type {useLogsPageDataQueryResult} from 'sentry/views/explore/contexts/logs/logsPageData';
import {formatSort} from 'sentry/views/explore/contexts/pageParamsContext/sortBys';
import {useChartInterval} from 'sentry/views/explore/hooks/useChartInterval';
import {
  useProgressiveQuery,
  type RPCQueryExtras,
} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import {getIngestDelayFilterValue} from 'sentry/views/explore/logs/useLogsQuery';
import {useStreamingTimeseriesResult} from 'sentry/views/explore/logs/useStreamingTimeseriesResult';
import {
  useQueryParamsAggregateSortBys,
  useQueryParamsGroupBys,
  useQueryParamsSearch,
  useQueryParamsTopEventsLimit,
  useQueryParamsVisualizes,
} from 'sentry/views/explore/queryParams/context';
import {computeVisualizeSampleTotals} from 'sentry/views/explore/utils';
import {useSortedTimeSeries} from 'sentry/views/insights/common/queries/useSortedTimeSeries';

interface UseLogsTimeseriesImplOptions {
  enabled: boolean;
  timeseriesIngestDelay: bigint;
  queryExtras?: RPCQueryExtras;
}

interface UseLogsTimeseriesOptions extends UseLogsTimeseriesImplOptions {
  tableData: ReturnType<typeof useLogsPageDataQueryResult>;
}

export function useLogsTimeseries({
  enabled,
  timeseriesIngestDelay,
  tableData,
}: UseLogsTimeseriesOptions) {
  const visualizes = useQueryParamsVisualizes();
  const topEventsLimit = useQueryParamsTopEventsLimit();

  const isTopN = !!topEventsLimit;

  const canTriggerHighAccuracy = useCallback(
    (result: ReturnType<typeof useLogsTimeseriesImpl>['result']) => {
      const hasData = computeVisualizeSampleTotals(
        visualizes.map(visualize => visualize.yAxis),
        result.data,
        isTopN
      ).some(total => total > 0);

      if (hasData) {
        return false;
      }

      return visualizes.some(visualize => {
        const dedupedYAxes = [visualize.yAxis];
        const series = dedupedYAxes.flatMap(yAxis => result.data[yAxis]).filter(defined);
        const {dataScanned} = determineSeriesSampleCountAndIsSampled(series, isTopN);
        return dataScanned === 'partial';
      });
    },
    [visualizes, isTopN]
  );

  const timeseriesResult = useProgressiveQuery<typeof useLogsTimeseriesImpl>({
    queryHookImplementation: useLogsTimeseriesImpl,
    queryHookArgs: {enabled, timeseriesIngestDelay},
    queryOptions: {
      canTriggerHighAccuracy,
    },
  });

  return useStreamingTimeseriesResult(
    tableData,
    timeseriesResult.result,
    timeseriesIngestDelay
  );
}

function useLogsTimeseriesImpl({
  enabled,
  queryExtras,
  timeseriesIngestDelay,
}: UseLogsTimeseriesImplOptions) {
  const logsSearch = useQueryParamsSearch();
  const groupBys = useQueryParamsGroupBys();
  const visualizes = useQueryParamsVisualizes();
  const aggregateSortBys = useQueryParamsAggregateSortBys();
  const topEventsLimit = useQueryParamsTopEventsLimit();
  const [caseInsensitive] = useCaseInsensitivity();
  const autorefreshEnabled = useLogsAutoRefreshEnabled();

  const [interval] = useChartInterval();

  const orderby: string | string[] | undefined = useMemo(() => {
    if (!aggregateSortBys.length) {
      return undefined;
    }

    return aggregateSortBys.map(formatSort);
  }, [aggregateSortBys]);

  const search = useMemo(() => {
    const newSearch = logsSearch.copy();
    if (autorefreshEnabled) {
      // We need to add the delay filter to ensure the table data and the graph data are as close as possible when merging buckets.
      newSearch.addFilterValue(
        OurLogKnownFieldKey.TIMESTAMP_PRECISE,
        getIngestDelayFilterValue(timeseriesIngestDelay)
      );
    }
    return newSearch;
  }, [logsSearch, timeseriesIngestDelay, autorefreshEnabled]);

  const yAxes = useMemo(() => {
    const uniqueYAxes = new Set(visualizes.map(visualize => visualize.yAxis));
    return [...uniqueYAxes];
  }, [visualizes]);

  const timeseriesResult = useSortedTimeSeries(
    {
      enabled,
      search,
      yAxis: yAxes,
      interval,
      fields: [...groupBys.filter(Boolean), ...yAxes],
      topEvents: topEventsLimit,
      orderby,
      caseInsensitive,
      ...queryExtras,
    },
    'api.explore.ourlogs-timeseries',
    DiscoverDatasets.OURLOGS
  );

  return {
    result: timeseriesResult,
  };
}
