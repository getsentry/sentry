import {useMemo} from 'react';

import type {Series} from 'sentry/types/echarts';
import {useApiQuery, type UseApiQueryOptions} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useOrganization from 'sentry/utils/useOrganization';
import type {Dataset, EventTypes} from 'sentry/views/alerts/rules/metric/types';
import {getDatasetConfig} from 'sentry/views/detectors/datasetConfig/getDatasetConfig';
import {DetectorDataset} from 'sentry/views/detectors/datasetConfig/types';

interface UseMetricDetectorSeriesProps {
  aggregate: string;
  dataset: Dataset;
  detectorDataset: DetectorDataset;
  environment: string | undefined;
  eventTypes: EventTypes[];
  interval: number;
  projectId: string;
  query: string;
  comparisonDelta?: number;
  end?: string;
  options?: Partial<UseApiQueryOptions<any>>;
  start?: string;
  statsPeriod?: string;
}

interface UseMetricDetectorSeriesResult {
  comparisonSeries: Series[];
  error: RequestError | null;
  isLoading: boolean;
  series: Series[];
}

/**
 * Make the request to the backend provided series query and transform into a series
 */
export function useMetricDetectorSeries({
  detectorDataset,
  dataset,
  aggregate,
  interval,
  query,
  eventTypes,
  environment,
  projectId,
  statsPeriod,
  start,
  end,
  comparisonDelta,
  options,
}: UseMetricDetectorSeriesProps): UseMetricDetectorSeriesResult {
  const organization = useOrganization();
  const datasetConfig = useMemo(
    () => getDatasetConfig(detectorDataset),
    [detectorDataset]
  );
  const seriesQueryOptions = datasetConfig.getSeriesQueryOptions({
    organization,
    aggregate,
    interval,
    query,
    environment: environment || '',
    projectId,
    dataset,
    eventTypes,
    statsPeriod,
    start,
    end,
    comparisonDelta,
  });

  const {data, isLoading, error} = useApiQuery<
    Parameters<typeof datasetConfig.transformSeriesQueryData>[0]
  >(seriesQueryOptions, {
    // 5 minutes
    staleTime: 5 * 60 * 1000,
    ...options,
  });

  const {series, comparisonSeries} = useMemo(() => {
    // TypeScript can't infer that each dataset config expects its own specific response type
    const transformedSeries = datasetConfig.transformSeriesQueryData(
      data as any,
      aggregate
    );

    // Extract comparison series if comparisonDelta is provided and data contains comparisonCount
    const transformedComparisonSeries =
      comparisonDelta && datasetConfig.transformComparisonSeriesData
        ? datasetConfig.transformComparisonSeriesData(data as any)
        : [];

    return {
      series: transformedSeries,
      comparisonSeries: transformedComparisonSeries,
    };
  }, [datasetConfig, data, aggregate, comparisonDelta]);

  return {series, comparisonSeries, isLoading, error};
}
