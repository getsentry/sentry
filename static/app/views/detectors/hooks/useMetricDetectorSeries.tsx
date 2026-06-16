import {useMemo} from 'react';
import {useQuery, type UseQueryOptions} from '@tanstack/react-query';

import type {Series} from 'sentry/types/echarts';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import type {ApiQueryKey} from 'sentry/utils/api/apiQueryKey';
import {
  type AggregationOutputType,
  getAggregateAlias,
} from 'sentry/utils/discover/fields';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {
  Dataset,
  EventTypes,
  ExtrapolationMode,
} from 'sentry/views/alerts/rules/metric/types';
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
  end?: string | null;
  extrapolationMode?: ExtrapolationMode;
  options?: {enabled?: boolean};
  start?: string | null;
  statsPeriod?: string | null;
}

interface UseMetricDetectorSeriesResult {
  comparisonSeries: Series[];
  error: Error | null;
  isLoading: boolean;
  outputType: AggregationOutputType | undefined;
  series: Series[];
  unit: string | null;
}

function applySharedSeriesOptions(series: Series[]): Series[] {
  return series.map(s => ({
    ...s,
    // Disable mouse hover emphasis effect on series points
    emphasis: {disabled: true},
  }));
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
  extrapolationMode,
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
    extrapolationMode,
  });

  type SeriesData = Parameters<typeof datasetConfig.transformSeriesQueryData>[0];
  const {data, isLoading, error} = useQuery({
    ...(seriesQueryOptions as UseQueryOptions<
      ApiResponse<SeriesData>,
      Error,
      SeriesData,
      ApiQueryKey
    >),
    retry: (failureCount, err) => {
      // Disable retries for 400 status code
      if (err instanceof RequestError && err.status === 400) {
        return false;
      }

      return failureCount < 2;
    },
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
      series: applySharedSeriesOptions(transformedSeries),
      comparisonSeries: applySharedSeriesOptions(transformedComparisonSeries),
    };
  }, [datasetConfig, data, aggregate, comparisonDelta]);

  // Extract unit and type metadata from the API response meta field
  if (data && 'meta' in data) {
    const unit =
      data.meta?.units?.[aggregate] ??
      data.meta?.units?.[getAggregateAlias(aggregate)] ??
      null;
    const outputType =
      data.meta?.fields?.[aggregate] ?? data.meta?.fields?.[getAggregateAlias(aggregate)];
    return {series, comparisonSeries, isLoading, error, unit, outputType};
  }

  return {series, comparisonSeries, isLoading, error, unit: null, outputType: undefined};
}
