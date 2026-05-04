import {defined} from 'sentry/utils';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {determineSeriesSampleCountAndIsSampled} from 'sentry/views/alerts/rules/metric/utils/determineSeriesSampleCount';
import {
  useProgressiveQuery,
  type RPCQueryExtras,
} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {getMaxIngestDelayTimestamp} from 'sentry/views/explore/logs/useLogsQuery';
import {
  DEFAULT_LOGS_TIMESERIES_Y_AXIS,
  useLogsTimeseriesRequest,
  type LogsTimeseriesRequest,
} from 'sentry/views/explore/logs/useLogsTimeseriesRequest';
import {computeVisualizeSampleTotals} from 'sentry/views/explore/utils';
import {useSortedTimeSeries} from 'sentry/views/insights/common/queries/useSortedTimeSeries';

interface UseLogsExportEstimateTimeseriesOptions {
  baseRequest: LogsTimeseriesRequest;
  enabled: boolean;
  queryExtras?: RPCQueryExtras;
}

function useLogsExportEstimateTimeseries({
  baseRequest,
  enabled,
  queryExtras,
}: UseLogsExportEstimateTimeseriesOptions) {
  const timeseriesResult = useSortedTimeSeries(
    {
      ...baseRequest,
      enabled,
      ...queryExtras,
    },
    'api.explore.ourlogs-timeseries',
    DiscoverDatasets.OURLOGS
  );

  return {
    result: timeseriesResult,
  };
}

/**
 * Intentionally coincidentally the same semantics as the default count(logs) chart.
 * This way, the default view requests are deduplicated.
 */
export function useLogsExportEstimatedRowCount(tableDataLength: number) {
  const baseRequest = useLogsTimeseriesRequest({
    enabled: true,
    timeseriesIngestDelay: getMaxIngestDelayTimestamp(),
    yAxesOverride: [DEFAULT_LOGS_TIMESERIES_Y_AXIS],
  });
  const isTopN = !!baseRequest.topEvents;

  const timeseriesResult = useProgressiveQuery<typeof useLogsExportEstimateTimeseries>({
    queryHookImplementation: useLogsExportEstimateTimeseries,
    queryHookArgs: {
      baseRequest,
      enabled: true,
    },
    queryOptions: {
      canTriggerHighAccuracy: result => {
        const hasData = computeVisualizeSampleTotals(
          [DEFAULT_LOGS_TIMESERIES_Y_AXIS],
          result.data,
          isTopN
        ).some(total => total > 0);

        if (hasData) {
          return false;
        }

        const series = result.data[DEFAULT_LOGS_TIMESERIES_Y_AXIS]?.filter(defined) ?? [];
        const {dataScanned} = determineSeriesSampleCountAndIsSampled(series, isTopN);
        return dataScanned === 'partial';
      },
    },
  });

  const series =
    timeseriesResult.result.data[DEFAULT_LOGS_TIMESERIES_Y_AXIS]?.filter(defined);
  const sampleCount = determineSeriesSampleCountAndIsSampled(
    series ?? [],
    isTopN
  ).sampleCount;

  return Math.max(tableDataLength, sampleCount);
}
