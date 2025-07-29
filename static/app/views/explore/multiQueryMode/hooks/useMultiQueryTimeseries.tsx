import {useCallback, useMemo} from 'react';

import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {formatSort} from 'sentry/views/explore/contexts/pageParamsContext/sortBys';
import {useChartInterval} from 'sentry/views/explore/hooks/useChartInterval';
import {
  type SpansRPCQueryExtras,
  useProgressiveQuery,
} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {
  getQueryMode,
  useReadQueriesFromLocation,
} from 'sentry/views/explore/multiQueryMode/locationUtils';
import {useSortedTimeSeries} from 'sentry/views/insights/common/queries/useSortedTimeSeries';

interface UseMultiQueryTimeseriesOptions {
  enabled: boolean;
  index: number;
  queryExtras?: SpansRPCQueryExtras;
}

interface UseMultiQueryTimeseriesResults {
  result: ReturnType<typeof useSortedTimeSeries>;
}

export function useMultiQueryTimeseries({
  enabled,
  index,
}: UseMultiQueryTimeseriesOptions) {
  const canTriggerHighAccuracy = useCallback(
    (results: ReturnType<typeof useMultiQueryTimeseriesImpl>['result']) => {
      const hasData = Object.values(results.data).some(result => {
        return Object.values(result).some(series => {
          return series.sampleCount?.some(({value}) => {
            return value > 0;
          });
        });
      });
      const canGetMoreData = Object.values(results.data).some(result => {
        return Object.values(result).some(series => {
          return series.dataScanned === 'partial';
        });
      });

      return !hasData && canGetMoreData;
    },
    []
  );
  return useProgressiveQuery<typeof useMultiQueryTimeseriesImpl>({
    queryHookImplementation: useMultiQueryTimeseriesImpl,
    queryHookArgs: {enabled, index},
    queryOptions: {
      canTriggerHighAccuracy,
    },
  });
}

function useMultiQueryTimeseriesImpl({
  enabled,
  index,
  queryExtras,
}: UseMultiQueryTimeseriesOptions): UseMultiQueryTimeseriesResults {
  const queries = useReadQueriesFromLocation();
  const [interval] = useChartInterval();
  const queryParts = queries[index]!;
  const sortBys = queryParts.sortBys;
  const groupBys = queryParts.groupBys;
  const query = queryParts.query;
  const yAxes = queryParts.yAxes;

  const mode = getQueryMode(groupBys);

  const fields: string[] = useMemo(() => {
    if (mode === Mode.SAMPLES) {
      return [];
    }

    return [...groupBys, ...yAxes].filter(Boolean);
  }, [mode, groupBys, yAxes]);

  const orderby: string | string[] | undefined = useMemo(() => {
    if (!sortBys.length) {
      return undefined;
    }

    return sortBys.map(formatSort);
  }, [sortBys]);

  const options = useMemo(() => {
    const search = new MutableSearch(query);

    return {
      search,
      yAxis: yAxes,
      fields,
      orderby,
      interval,
      topEvents: mode === Mode.SAMPLES ? undefined : DEFAULT_TOP_EVENTS,
      enabled,
      ...queryExtras,
    };
  }, [query, yAxes, fields, orderby, interval, mode, enabled, queryExtras]);

  const timeseriesResult = useSortedTimeSeries(
    options,
    'api.explorer.stats',
    DiscoverDatasets.SPANS
  );

  return {result: timeseriesResult};
}
