import {useCallback} from 'react';

import {defined} from 'sentry/utils';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {determineSeriesSampleCountAndIsSampled} from 'sentry/views/alerts/rules/metric/utils/determineSeriesSampleCount';
import type {useLogsPageDataQueryResult} from 'sentry/views/explore/contexts/logs/logsPageData';
import {
  useProgressiveQuery,
  type RPCQueryExtras,
} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {useLogsTimeseriesRequest} from 'sentry/views/explore/logs/useLogsTimeseriesRequest';
import {useStreamingTimeseriesResult} from 'sentry/views/explore/logs/useStreamingTimeseriesResult';
import {
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
  const request = useLogsTimeseriesRequest({
    enabled,
    queryExtras,
    timeseriesIngestDelay,
  });

  const timeseriesResult = useSortedTimeSeries(
    request,
    'api.explore.ourlogs-timeseries',
    DiscoverDatasets.OURLOGS
  );

  return {
    result: timeseriesResult,
  };
}
