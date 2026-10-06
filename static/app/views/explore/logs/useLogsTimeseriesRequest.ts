import {useMemo} from 'react';

import {useCaseInsensitivity} from 'sentry/components/searchQueryBuilder/hooks';
import {AggregationKey} from 'sentry/utils/fields';
import {useChartInterval} from 'sentry/utils/useChartInterval';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useLogsAutoRefreshEnabled} from 'sentry/views/explore/contexts/logs/logsAutoRefreshContext';
import {defaultAggregateSortBys} from 'sentry/views/explore/contexts/pageParamsContext/aggregateSortBys';
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
import {areAllVisualizesInvalidConditionalFilters} from 'sentry/views/explore/utils/conditionalAggregate';

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
  const visualizes = useQueryParamsVisualizes({validate: true});
  const unvalidatedVisualizes = useQueryParamsVisualizes();
  const aggregateSortBys = useQueryParamsAggregateSortBys();
  const topEventsLimit = useQueryParamsTopEventsLimit();
  const [caseInsensitive] = useCaseInsensitivity();
  const autorefreshEnabled = useLogsAutoRefreshEnabled();
  const [interval] = useChartInterval();
  const organization = useOrganization();
  const hasMeasuredIngestionDelayUi = organization.features.includes(
    'measured-ingestion-delay-ui'
  );

  return useMemo(() => {
    const search = logsSearch.copy();
    if (autorefreshEnabled) {
      search.addFilterValue(
        OurLogKnownFieldKey.TIMESTAMP_PRECISE,
        getIngestDelayFilterValue(timeseriesIngestDelay)
      );
    }

    const yAxes = yAxesOverride ?? [
      ...new Set(visualizes.map(visualize => visualize.yAxis)),
    ];
    const fields = [...groupBys.filter(Boolean), ...yAxes];

    // Drop orderbys that point at series removed by `_if` validation.
    const allowedFields = new Set(fields);
    const validSortBys = aggregateSortBys.filter(sort => allowedFields.has(sort.field));
    const orderby = aggregateSortBys.length
      ? (validSortBys.length ? validSortBys : defaultAggregateSortBys(yAxes)).map(
          formatSort
        )
      : undefined;

    // Skip only when every series failed an `_if` filter.
    const skippedForInvalidConditionalFilter =
      !yAxesOverride && areAllVisualizesInvalidConditionalFilters(unvalidatedVisualizes);

    return {
      enabled: enabled && !skippedForInvalidConditionalFilter,
      search,
      yAxis: yAxes,
      interval,
      fields,
      topEvents: topEventsLimit,
      orderby,
      caseInsensitive,
      includeMeasuredIngestionDelayMetadata: hasMeasuredIngestionDelayUi,
      ...queryExtras,
    };
  }, [
    aggregateSortBys,
    autorefreshEnabled,
    caseInsensitive,
    enabled,
    groupBys,
    hasMeasuredIngestionDelayUi,
    interval,
    logsSearch,
    queryExtras,
    timeseriesIngestDelay,
    topEventsLimit,
    unvalidatedVisualizes,
    visualizes,
    yAxesOverride,
  ]);
}
