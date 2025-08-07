import {useCallback, useMemo} from 'react';

import {defined} from 'sentry/utils';
import {dedupeArray} from 'sentry/utils/dedupeArray';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {determineSeriesSampleCountAndIsSampled} from 'sentry/views/alerts/rules/metric/utils/determineSeriesSampleCount';
import {
  useExploreAggregateSortBys,
  useExploreDataset,
  useExploreGroupBys,
  useExploreVisualizes,
} from 'sentry/views/explore/contexts/pageParamsContext';
import {formatSort} from 'sentry/views/explore/contexts/pageParamsContext/sortBys';
import type {Visualize} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {DEFAULT_VISUALIZATION} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {useChartInterval} from 'sentry/views/explore/hooks/useChartInterval';
import {
  type SpansRPCQueryExtras,
  useProgressiveQuery,
} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {useTopEvents} from 'sentry/views/explore/hooks/useTopEvents';
import {computeVisualizeSampleTotals} from 'sentry/views/explore/utils';
import {useSortedTimeSeries} from 'sentry/views/insights/common/queries/useSortedTimeSeries';

interface UseExploreTimeseriesOptions {
  enabled: boolean;
  query: string;
  queryExtras?: SpansRPCQueryExtras;
}

interface UseExploreTimeseriesResults {
  result: ReturnType<typeof useSortedTimeSeries>;
}

export const useExploreTimeseries = ({
  query,
  enabled,
}: {
  enabled: boolean;
  query: string;
}) => {
  const visualizes = useExploreVisualizes();
  const topEvents = useTopEvents();
  const isTopN = topEvents ? topEvents > 0 : false;

  const canTriggerHighAccuracy = useCallback(
    (result: ReturnType<typeof useExploreTimeseriesImpl>['result']) => {
      return shouldTriggerHighAccuracy(result.data, visualizes, isTopN);
    },
    [visualizes, isTopN]
  );

  return useProgressiveQuery<typeof useExploreTimeseriesImpl>({
    queryHookImplementation: useExploreTimeseriesImpl,
    queryHookArgs: {query, enabled},
    queryOptions: {
      canTriggerHighAccuracy,
    },
  });
};

function useExploreTimeseriesImpl({
  enabled,
  query,
  queryExtras,
}: UseExploreTimeseriesOptions): UseExploreTimeseriesResults {
  const dataset = useExploreDataset();
  const groupBys = useExploreGroupBys();
  const sortBys = useExploreAggregateSortBys();
  const visualizes = useExploreVisualizes({validate: true});
  const [interval] = useChartInterval();
  const topEvents = useTopEvents();

  const validYAxes = useMemo(() => {
    return visualizes.map(visualize => visualize.yAxis);
  }, [visualizes]);

  const fields: string[] = useMemo(() => {
    return [...groupBys, ...validYAxes].filter(Boolean);
  }, [groupBys, validYAxes]);

  const orderby: string | string[] | undefined = useMemo(() => {
    if (!sortBys.length) {
      return undefined;
    }

    return sortBys.map(formatSort);
  }, [sortBys]);

  const yAxes = useMemo(() => {
    const allYAxes = [...validYAxes];

    // injects DEFAULT_VISUALIZATION here as it can be used to populate the
    // confidence footer as a fallback
    allYAxes.push(DEFAULT_VISUALIZATION);

    return dedupeArray(allYAxes).sort();
  }, [validYAxes]);

  const options = useMemo(() => {
    const search = new MutableSearch(query);

    return {
      search,
      yAxis: yAxes,
      interval,
      fields,
      orderby,
      topEvents,
      enabled,
      ...queryExtras,
    };
  }, [query, yAxes, interval, fields, orderby, topEvents, enabled, queryExtras]);

  const timeseriesResult = useSortedTimeSeries(options, 'api.explorer.stats', dataset);

  return {
    result: timeseriesResult,
  };
}

function shouldTriggerHighAccuracy(
  data: ReturnType<typeof useSortedTimeSeries>['data'],
  visualizes: Visualize[],
  isTopN: boolean
) {
  const hasData = computeVisualizeSampleTotals(visualizes, data, isTopN).some(
    total => total > 0
  );
  return !hasData && _checkCanQueryForMoreData(data, visualizes, isTopN);
}

function _checkCanQueryForMoreData(
  data: ReturnType<typeof useSortedTimeSeries>['data'],
  visualizes: Visualize[],
  isTopN: boolean
) {
  return visualizes.some(visualize => {
    const dedupedYAxes = [visualize.yAxis];
    const series = dedupedYAxes.flatMap(yAxis => data[yAxis]).filter(defined);
    const {dataScanned} = determineSeriesSampleCountAndIsSampled(series, isTopN);
    return dataScanned === 'partial';
  });
}
