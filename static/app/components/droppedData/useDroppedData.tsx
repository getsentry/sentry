import {useDroppedDataAnnotationsEnabled} from 'sentry/components/droppedData/useDroppedDataAnnotationsEnabled';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useFetchEventsTimeSeries} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import {useChartInterval} from 'sentry/utils/useChartInterval';

const REFERRER = 'api.explore.dropped-data-annotations';

// Trace metrics needs `count(value)`.
function getYAxis(dataset: DiscoverDatasets): string {
  return dataset === DiscoverDatasets.TRACEMETRICS ? 'count(value)' : 'count()';
}

interface UseDroppedDataOptions {
  dataset: DiscoverDatasets;
}

/**
 * Dropped and accepted annotations for the current page filters and chart
 * interval
 */
export function useDroppedData({dataset}: UseDroppedDataOptions) {
  const annotationsEnabled = useDroppedDataAnnotationsEnabled();
  const [interval] = useChartInterval();

  // TODO: change this hook to the dedicated endpoint when it's ready.
  const {data, isPending} = useFetchEventsTimeSeries(
    dataset,
    {
      yAxis: getYAxis(dataset),
      interval,
      includeAnnotations: true,
      enabled: annotationsEnabled,
    },
    REFERRER
  );

  return {
    droppedAnnotations: data?.meta?.droppedAnnotations,
    acceptedAnnotations: data?.meta?.acceptedAnnotations,
    isPending,
  };
}
