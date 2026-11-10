import {useMemo} from 'react';
import {useTheme} from '@emotion/react';
import type {LineSeriesOption} from 'echarts';

import type {Series} from 'sentry/types/echarts';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  createAnomalyThresholdSeries,
  type AnomalyThresholdDataPoint,
} from 'sentry/views/detectors/utils/anomalyThresholdSeries';

interface AnomalyThresholdDataResponse {
  data: AnomalyThresholdDataPoint[];
}

interface UseMetricDetectorAnomalyThresholdsProps {
  detectorId: string;
  detectionType?: string;
  endTimestamp?: number;
  series?: Series[];
  startTimestamp?: number;
}

interface UseMetricDetectorAnomalyThresholdsResult {
  anomalyThresholdSeries: LineSeriesOption[];
  error: RequestError | null;
  isLoading: boolean;
}

/**
 * Fetches anomaly detection threshold data and transforms it into chart series
 */
export function useMetricDetectorAnomalyThresholds({
  detectorId,
  detectionType,
  startTimestamp,
  endTimestamp,
  series = [],
}: UseMetricDetectorAnomalyThresholdsProps): UseMetricDetectorAnomalyThresholdsResult {
  const organization = useOrganization();
  const theme = useTheme();

  const isAnomalyDetection = detectionType === 'dynamic';

  const {
    data: anomalyData,
    isLoading,
    error,
  } = useApiQuery<AnomalyThresholdDataResponse>(
    [
      getApiUrl(
        '/organizations/$organizationIdOrSlug/detectors/$detectorId/anomaly-data/',
        {
          path: {organizationIdOrSlug: organization.slug, detectorId},
        }
      ),
      {
        query: {
          start: startTimestamp,
          end: endTimestamp,
        },
      },
    ],
    {
      staleTime: 0,
      enabled:
        isAnomalyDetection && Boolean(detectorId && startTimestamp && endTimestamp),
    }
  );

  const anomalyThresholdSeries = useMemo(
    () =>
      createAnomalyThresholdSeries({
        anomalyThresholds: anomalyData?.data ?? [],
        series,
        theme,
      }),
    [anomalyData, series, theme]
  );

  return {anomalyThresholdSeries, isLoading, error};
}
