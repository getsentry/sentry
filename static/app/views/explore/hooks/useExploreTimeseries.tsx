import {useMemo} from 'react';
import isEqual from 'lodash/isEqual';

import {dedupeArray} from 'sentry/utils/dedupeArray';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import usePrevious from 'sentry/utils/usePrevious';
import {
  useExploreDataset,
  useExploreGroupBys,
  useExploreMode,
  useExploreSortBys,
  useExploreVisualizes,
} from 'sentry/views/explore/contexts/pageParamsContext';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {formatSort} from 'sentry/views/explore/contexts/pageParamsContext/sortBys';
import {useChartInterval} from 'sentry/views/explore/hooks/useChartInterval';
import {useTopEvents} from 'sentry/views/explore/hooks/useTopEvents';
import {useSortedTimeSeries} from 'sentry/views/insights/common/queries/useSortedTimeSeries';

interface UseExploreTimeseriesOptions {
  enabled: boolean;
  query: string;
}

interface UseExploreTimeseriesResults {
  canUsePreviousResults: boolean;
  timeseriesResult: ReturnType<typeof useSortedTimeSeries>;
}

export function useExploreTimeseries({
  enabled,
  query,
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

    return [...groupBys, ...visualizes.flatMap(visualize => visualize.yAxes)].filter(
      Boolean
    );
  }, [mode, groupBys, visualizes]);

  const orderby: string | string[] | undefined = useMemo(() => {
    if (!sortBys.length) {
      return undefined;
    }

    return sortBys.map(formatSort);
  }, [sortBys]);

  const yAxes = useMemo(() => {
    const deduped = dedupeArray(visualizes.flatMap(visualize => visualize.yAxes));
    deduped.sort();
    return deduped;
  }, [visualizes]);

  const options = useMemo(() => {
    const search = new MutableSearch(query);

    // Filtering out all spans with op like 'ui.interaction*' which aren't
    // embedded under transactions. The trace view does not support rendering
    // such spans yet.
    search.addFilterValues('!transaction.span_id', ['00']);

    return {
      search,
      yAxis: yAxes,
      interval,
      fields,
      orderby,
      topEvents,
      enabled,
    };
  }, [query, yAxes, interval, fields, orderby, topEvents, enabled]);

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

  return {timeseriesResult, canUsePreviousResults};
}
