import {useCallback, useMemo} from 'react';
import isEqual from 'lodash/isEqual';

import {defined} from 'sentry/utils';
import {dedupeArray} from 'sentry/utils/dedupeArray';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import usePrevious from 'sentry/utils/usePrevious';
import {determineSeriesSampleCountAndIsSampled} from 'sentry/views/alerts/rules/metric/utils/determineSeriesSampleCount';
import {
  useExploreDataset,
  useExploreGroupBys,
  useExploreMode,
  useExploreSortBys,
  useExploreVisualizes,
} from 'sentry/views/explore/contexts/pageParamsContext';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
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
  canUsePreviousResults: boolean;
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
  const mode = useExploreMode();
  const sortBys = useExploreSortBys();
  const visualizes = useExploreVisualizes();
  const [interval] = useChartInterval();
  const topEvents = useTopEvents();

  const fields: string[] = useMemo(() => {
    if (mode === Mode.SAMPLES) {
      return [];
    }

    return [...groupBys, ...visualizes.map(visualize => visualize.yAxis)].filter(Boolean);
  }, [mode, groupBys, visualizes]);

  const orderby: string | string[] | undefined = useMemo(() => {
    if (!sortBys.length) {
      return undefined;
    }

    return sortBys.map(formatSort);
  }, [sortBys]);

  const yAxes = useMemo(() => {
    const allYAxes = visualizes.map(visualize => visualize.yAxis);

    // injects DEFAULT_VISUALIZATION here as it can be used to populate the
    // confidence footer as a fallback
    allYAxes.push(DEFAULT_VISUALIZATION);

    return dedupeArray(allYAxes).sort();
  }, [visualizes]);

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

  const previousQuery = usePrevious(query);
  const previousOptions = usePrevious(options);
  const canUsePreviousResults = useMemo(() => {
    if (!isEqual(query, previousQuery)) {
      return false;
    }

    if (!isEqual(options.interval, previousOptions.interval)) {
      return false;
    }

    if (!isEqual(options.fields, previousOptions.fields)) {
      return false;
    }

    if (!isEqual(options.orderby, previousOptions.orderby)) {
      return false;
    }

    if (!isEqual(options.topEvents, previousOptions.topEvents)) {
      return false;
    }

    // The query we're using has remained the same except for the y axis.
    // This means we can  re-use the previous results to prevent a loading state.
    return true;
  }, [query, previousQuery, options, previousOptions]);

  const timeseriesResult = useSortedTimeSeries(options, 'api.explorer.stats', dataset);

  return {
    result: timeseriesResult,
    canUsePreviousResults,
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
