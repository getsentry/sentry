import {useMemo} from 'react';

import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
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
}: UseMetricDetectorSeriesProps) {
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
  });

  const {data, isPending, isError} = useApiQuery<
    Parameters<typeof datasetConfig.transformSeriesQueryData>[0]
  >(seriesQueryOptions, {
    // 5 minutes
    staleTime: 5 * 60 * 1000,
  });

  const series = useMemo(() => {
    // TypeScript can't infer that each dataset config expects its own specific response type
    return datasetConfig.transformSeriesQueryData(data as any, aggregate);
  }, [datasetConfig, data, aggregate]);

  return {series, isPending, isError};
}
