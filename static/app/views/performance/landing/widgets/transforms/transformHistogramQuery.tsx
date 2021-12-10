import {HistogramQueryChildrenProps} from 'sentry/utils/performance/histogram/histogramQuery';

export function transformHistogramQuery(_: any, results: HistogramQueryChildrenProps) {
  const {histograms} = results;
  return {
    ...results,
    data: histograms,
    isLoading: results.isLoading,
    isErrored: results.error !== null,
    hasData: !!Object.values(histograms || {}).length,
  };
}
