import {useMemo} from 'react';

import usePrevious from 'sentry/utils/usePrevious';
import type {useSortedTimeSeries} from 'sentry/views/insights/common/queries/useSortedTimeSeries';

interface UseCachedResultsOptions {
  canUsePreviousResults: boolean;
  timeseriesResult: ReturnType<typeof useSortedTimeSeries>;
  yAxis: string;
}

export function useCachedTimeseriesResults({
  canUsePreviousResults,
  timeseriesResult: currentTimeseriesResult,
  yAxis,
}: UseCachedResultsOptions) {
  const previousTimeseriesResult = usePrevious(currentTimeseriesResult);

  return useMemo(() => {
    if (
      currentTimeseriesResult.isPending &&
      canUsePreviousResults &&
      previousTimeseriesResult.data.hasOwnProperty(yAxis)
    ) {
      return previousTimeseriesResult;
    }
    return currentTimeseriesResult;
  }, [canUsePreviousResults, currentTimeseriesResult, previousTimeseriesResult, yAxis]);
}
