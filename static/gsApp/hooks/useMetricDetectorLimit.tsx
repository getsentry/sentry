import useOrganization from 'sentry/utils/useOrganization';
import {useDetectorsQuery} from 'sentry/views/detectors/hooks/index';

import useSubscription from 'getsentry/hooks/useSubscription';

type MetricDetectorLimitResponse = {
  detectorCount: number;
  detectorLimit: number;
  hasReachedLimit: boolean;
  isError: boolean;
  isLoading: boolean;
};

const UNLIMITED_QUOTA = -1;

export function useMetricDetectorLimit(): MetricDetectorLimitResponse {
  const organization = useOrganization();
  const subscription = useSubscription();
  const {data: detectors, isLoading, isError} = useDetectorsQuery();

  const detectorLimit = subscription?.planDetails?.metricDetectorLimit ?? 0;

  if (
    !organization.features.includes('workflow-engine-metric-detector-limit') ||
    detectorLimit === UNLIMITED_QUOTA
  ) {
    return {
      hasReachedLimit: false,
      detectorLimit: UNLIMITED_QUOTA,
      detectorCount: -1,
      isLoading: false,
      isError: false,
    };
  }

  const detectorCount = detectors?.length || 0;

  return {
    detectorCount,
    detectorLimit,
    hasReachedLimit: detectorCount >= detectorLimit,
    isLoading,
    isError,
  };
}
