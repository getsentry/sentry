import {useMemo} from 'react';

import {useCaseInsensitivity} from 'sentry/components/searchQueryBuilder/hooks';
import {AggregationKey} from 'sentry/utils/fields';
import {useChartInterval} from 'sentry/utils/useChartInterval';
import {useLogsAutoRefreshEnabled} from 'sentry/views/explore/contexts/logs/logsAutoRefreshContext';
import {formatSort} from 'sentry/views/explore/contexts/pageParamsContext/sortBys';
import type {RPCQueryExtras} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {OurLogKnownFieldKey} from 'sentry/views/explore/logs/types';
import {getIngestDelayFilterValue} from 'sentry/views/explore/logs/useLogsQuery';
import {
  useQueryParamsAggregateSortBys,
  useQueryParamsGroupBys,
  useQueryParamsSearch,
  useQueryParamsTopEventsLimit,
  useQueryParamsVisualizes,
} from 'sentry/views/explore/queryParams/context';

export const DEFAULT_LOGS_TIMESERIES_Y_AXIS = `${AggregationKey.COUNT}(${OurLogKnownFieldKey.MESSAGE})`;

interface UseLogsTimeseriesRequestOptions {
  enabled: boolean;
  timeseriesIngestDelay: bigint;
  queryExtras?: RPCQueryExtras;
  yAxesOverride?: string[];
}

export type LogsTimeseriesRequest = ReturnType<typeof useLogsTimeseriesRequest>;

export function useLogsTimeseriesRequest({
  enabled,
  queryExtras,
  timeseriesIngestDelay,
  yAxesOverride,
}: UseLogsTimeseriesRequestOptions) {
  const logsSearch = useQueryParamsSearch();
  const groupBys = useQueryParamsGroupBys();
  const visualizes = useQueryParamsVisualizes();
  const aggregateSortBys = useQueryParamsAggregateSortBys();
  const topEventsLimit = useQueryParamsTopEventsLimit();
  const [caseInsensitive] = useCaseInsensitivity();
  const autorefreshEnabled = useLogsAutoRefreshEnabled();
  const [interval] = useChartInterval();

  return useMemo(() => {
    const search = logsSearch.copy();
    if (autorefreshEnabled) {
      search.addFilterValue(
        OurLogKnownFieldKey.TIMESTAMP_PRECISE,
        getIngestDelayFilterValue(timeseriesIngestDelay)
      );
    }

    const orderby = aggregateSortBys.length
      ? aggregateSortBys.map(formatSort)
      : undefined;

    const yAxes = yAxesOverride ?? [
      ...new Set(visualizes.map(visualize => visualize.yAxis)),
    ];

    return {
      enabled,
      search,
      yAxis: yAxes,
      interval,
      fields: [...groupBys.filter(Boolean), ...yAxes],
      topEvents: topEventsLimit,
      orderby,
      caseInsensitive,
      ...queryExtras,
    };
  }, [
    aggregateSortBys,
    autorefreshEnabled,
    caseInsensitive,
    enabled,
    groupBys,
    interval,
    logsSearch,
    queryExtras,
    timeseriesIngestDelay,
    topEventsLimit,
    visualizes,
    yAxesOverride,
  ]);
}
