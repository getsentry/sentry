import {useMemo} from 'react';

import type {Series} from 'sentry/types/echarts';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {TimePeriod} from 'sentry/views/alerts/rules/metric/types';
import type {DetectorDataset} from 'sentry/views/detectors/components/forms/metric/metricFormData';
import {getDatasetConfig} from 'sentry/views/detectors/datasetConfig/getDatasetConfig';
import {DETECTOR_DATASET_TO_DISCOVER_DATASET_MAP} from 'sentry/views/detectors/datasetConfig/utils/discoverDatasetMap';

interface UseMetricDetectorSeriesProps {
  aggregate: string;
  dataset: DetectorDataset;
  environment: string | undefined;
  interval: number;
  projectId: string;
  query: string;
  statsPeriod: TimePeriod;
  comparisonDelta?: number;
}

interface UseMetricDetectorSeriesResult {
  comparisonSeries: Series[];
  isError: boolean;
  isPending: boolean;
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
  comparisonDelta,
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
    comparisonDelta,
  });

  const {data, isPending, isError} = useApiQuery<
    Parameters<typeof datasetConfig.transformSeriesQueryData>[0]
  >(seriesQueryOptions, {
    // 5 minutes
    staleTime: 5 * 60 * 1000,
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
        ? datasetConfig.transformComparisonSeriesData(
            data as any,
            aggregate,
            comparisonDelta
          )
        : [];

    return {
      series: transformedSeries,
      comparisonSeries: transformedComparisonSeries,
    };
  }, [datasetConfig, data, aggregate, comparisonDelta]);

  return {series, comparisonSeries, isPending, isError};
}
