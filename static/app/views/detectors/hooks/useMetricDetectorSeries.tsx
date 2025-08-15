import {useMemo} from 'react';

import type {Series} from 'sentry/types/echarts';
import {useApiQuery, type UseApiQueryOptions} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useOrganization from 'sentry/utils/useOrganization';
import {getDatasetConfig} from 'sentry/views/detectors/datasetConfig/getDatasetConfig';
import {DetectorDataset} from 'sentry/views/detectors/datasetConfig/types';
import {DETECTOR_DATASET_TO_DISCOVER_DATASET_MAP} from 'sentry/views/detectors/datasetConfig/utils/discoverDatasetMap';

interface UseMetricDetectorSeriesProps {
  aggregate: string;
  dataset: DetectorDataset;
  environment: string | undefined;
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
  dataset,
  aggregate,
  interval,
  query,
  environment,
  projectId,
  statsPeriod,
  start,
  end,
  comparisonDelta,
  options,
}: UseMetricDetectorSeriesProps): UseMetricDetectorSeriesResult {
  const organization = useOrganization();
  const datasetConfig = useMemo(() => getDatasetConfig(dataset), [dataset]);
  const seriesQueryOptions = datasetConfig.getSeriesQueryOptions({
    organization,
    aggregate,
    interval,
    query,
    environment: environment || '',
    projectId,
    dataset: DETECTOR_DATASET_TO_DISCOVER_DATASET_MAP[dataset],
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
