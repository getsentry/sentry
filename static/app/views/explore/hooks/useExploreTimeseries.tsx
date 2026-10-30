import {useCallback, useMemo} from 'react';

import {MutableSearch} from 'sentry/components/searchSyntax/mutableSearch';
import {determineSeriesSampleCountAndIsSampled} from 'sentry/utils/timeSeries/determineSeriesSampleCount';
import {getTimeSeriesForQuery} from 'sentry/utils/timeSeries/getTimeSeriesForQuery';
import {useChartInterval} from 'sentry/utils/useChartInterval';
import {useOrganization} from 'sentry/utils/useOrganization';
import {defaultAggregateSortBys} from 'sentry/views/explore/contexts/pageParamsContext/aggregateSortBys';
import {formatSort} from 'sentry/views/explore/contexts/pageParamsContext/sortBys';
import {DEFAULT_VISUALIZATION} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {
  useProgressiveQuery,
  type RPCQueryExtras,
} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {useTopEvents} from 'sentry/views/explore/hooks/useTopEvents';
import {
  useQueryParamsAggregateSortBys,
  useQueryParamsExtrapolate,
  useQueryParamsGroupBys,
  useQueryParamsVisualizes,
} from 'sentry/views/explore/queryParams/context';
import {
  type Visualize,
  VisualizeFunction,
} from 'sentry/views/explore/queryParams/visualize';
import {useSpansDataset} from 'sentry/views/explore/spans/spansQueryParams';
import {areAllVisualizesInvalidConditionalFilters} from 'sentry/views/explore/utils/conditionalAggregate';
import {getVisualizeTimeseriesQueries} from 'sentry/views/explore/utils/getVisualizeTimeseriesQueries';
import {
  useSortedTimeSeries,
  type SortedTimeSeries,
} from 'sentry/views/insights/common/queries/useSortedTimeSeries';

interface UseExploreTimeseriesOptions {
  enabled: boolean;
  query: string;
  queryExtras?: RPCQueryExtras;
}

interface UseExploreTimeseriesResults {
  result: SortedTimeSeries;
}

export const useExploreTimeseries = ({
  query,
  enabled,
  queryExtras,
}: UseExploreTimeseriesOptions) => {
  const visualizes = useQueryParamsVisualizes();
  const extrapolate = useQueryParamsExtrapolate();
  const topEvents = useTopEvents();
  const isTopN = topEvents ? topEvents > 0 : false;

  const canTriggerHighAccuracy = useCallback(
    (result: ReturnType<typeof useExploreTimeseriesImpl>['result']) => {
      return shouldTriggerHighAccuracy(result.data, visualizes, isTopN);
    },
    [visualizes, isTopN]
  );

  return useProgressiveQuery<typeof useExploreTimeseriesImpl>({
    queryHookImplementation: useExploreTimeseriesImpl, // oxlint-disable-line react/hooks -- useProgressiveQuery takes the query hook as a value and calls it per accuracy tier.
    queryHookArgs: {query, enabled, queryExtras},
    queryOptions: {
      canTriggerHighAccuracy,
      disableExtrapolation: !extrapolate,
    },
  });
};

function useExploreTimeseriesImpl({
  enabled,
  query,
  queryExtras,
}: UseExploreTimeseriesOptions): UseExploreTimeseriesResults {
  const organization = useOrganization();
  const transformationsEnabled = organization.features.includes(
    'explore-interpolation-and-smoothing'
  );
  const dataset = useSpansDataset();
  const groupBys = useQueryParamsGroupBys();
  const sortBys = useQueryParamsAggregateSortBys();
  const visualizes = useQueryParamsVisualizes({validate: true});
  const unvalidatedVisualizes = useQueryParamsVisualizes();
  const [interval] = useChartInterval();
  const topEvents = useTopEvents();

  const validYAxes = useMemo(() => {
    return visualizes.map(visualize => visualize.yAxis);
  }, [visualizes]);

  const fields = useMemo(() => {
    return [...groupBys, ...validYAxes].filter(Boolean);
  }, [groupBys, validYAxes]);

  // Drop orderbys for series removed by validation so the remaining query still works.
  const orderby: string | string[] | undefined = useMemo(() => {
    if (!sortBys.length) {
      return;
    }

    const allowedFields = new Set(fields);
    const validSortBys = sortBys.filter(sort => allowedFields.has(sort.field));
    if (validSortBys.length) {
      return validSortBys.map(formatSort);
    }

    return defaultAggregateSortBys(validYAxes).map(formatSort);
  }, [fields, sortBys, validYAxes]);

  const timeseriesQueries = useMemo(() => {
    // injects DEFAULT_VISUALIZATION here as it can be used to populate the
    // confidence footer as a fallback
    return getVisualizeTimeseriesQueries(
      [...visualizes, new VisualizeFunction(DEFAULT_VISUALIZATION)],
      transformationsEnabled
    ).sort((a, b) => (a.yAxis < b.yAxis ? -1 : a.yAxis > b.yAxis ? 1 : 0));
  }, [visualizes, transformationsEnabled]);

  const skippedForInvalidConditionalFilter = useMemo(
    () => areAllVisualizesInvalidConditionalFilters(unvalidatedVisualizes),
    [unvalidatedVisualizes]
  );

  const options = useMemo(() => {
    const search = new MutableSearch(query);

    return {
      search,
      yAxis: timeseriesQueries.map(timeseriesQuery => timeseriesQuery.yAxis),
      transformations: transformationsEnabled
        ? timeseriesQueries.map(timeseriesQuery => timeseriesQuery.transformations)
        : undefined,
      interval,
      fields,
      orderby,
      topEvents,
      // Skip only when every series failed an `_if` filter. Invalid equations still
      // query with DEFAULT_VISUALIZATION as a fallback (prior behavior).
      enabled: enabled && !skippedForInvalidConditionalFilter,
      ...queryExtras,
    };
  }, [
    enabled,
    fields,
    interval,
    orderby,
    query,
    queryExtras,
    skippedForInvalidConditionalFilter,
    topEvents,
    timeseriesQueries,
    transformationsEnabled,
  ]);

  const timeseriesResult = useSortedTimeSeries(
    options,
    `api.explore.${dataset}-timeseries`,
    dataset
  );

  return {
    result: timeseriesResult,
  };
}

export function shouldTriggerHighAccuracy(
  data: SortedTimeSeries['data'],
  visualizes: readonly Visualize[],
  isTopN: boolean
) {
  const samplingInfo = visualizes.map(visualize =>
    determineSeriesSampleCountAndIsSampled(
      getTimeSeriesForQuery(data, visualize.yAxis, visualize.transformations),
      isTopN
    )
  );
  return (
    !samplingInfo.some(info => info.sampleCount > 0) &&
    samplingInfo.some(info => info.dataScanned === 'partial')
  );
}
