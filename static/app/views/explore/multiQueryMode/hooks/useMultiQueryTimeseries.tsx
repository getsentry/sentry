import {useMemo} from 'react';
import isEqual from 'lodash/isEqual';

import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import usePrevious from 'sentry/utils/usePrevious';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {formatSort} from 'sentry/views/explore/contexts/pageParamsContext/sortBys';
import {
  getQueryMode,
  useReadQueriesFromLocation,
} from 'sentry/views/explore/multiQueryMode/locationUtils';
import {useSortedTimeSeries} from 'sentry/views/insights/common/queries/useSortedTimeSeries';

interface UseMultiQueryTimeseriesOptions {
  enabled: boolean;
  index: number;
}

interface UseMultiQueryTimeseriesResults {
  canUsePreviousResults: boolean;
  timeseriesResult: ReturnType<typeof useSortedTimeSeries>;
}

export function useMultiQueryTimeseries({
  enabled,
  index,
}: UseMultiQueryTimeseriesOptions): UseMultiQueryTimeseriesResults {
  const queries = useReadQueriesFromLocation();
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

    // Filtering out all spans with op like 'ui.interaction*' which aren't
    // embedded under transactions. The trace view does not support rendering
    // such spans yet.
    search.addFilterValues('!transaction.span_id', ['00']);

    return {
      search,
      yAxis: yAxes,
      fields,
      orderby,
      topEvents: mode === Mode.SAMPLES ? undefined : 5,
      enabled,
    };
  }, [query, yAxes, fields, orderby, mode, enabled]);

  const previousQuery = usePrevious(query);
  const previousOptions = usePrevious(options);
  const canUsePreviousResults = useMemo(() => {
    if (!isEqual(query, previousQuery)) {
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

  const timeseriesResult = useSortedTimeSeries(
    options,
    'api.explorer.stats',
    DiscoverDatasets.SPANS_EAP_RPC
  );

  return {timeseriesResult, canUsePreviousResults};
}
