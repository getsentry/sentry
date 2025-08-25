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
const NO_COUNT = -1;

export function useMetricDetectorLimit(): MetricDetectorLimitResponse {
  const organization = useOrganization();
  const subscription = useSubscription();
  const detectorLimit = subscription?.planDetails?.metricDetectorLimit ?? UNLIMITED_QUOTA;
  const hasFlag = organization.features.includes('workflow-engine-metric-detector-limit');

  const {isLoading, isError, getResponseHeader} = useDetectorsQuery(
    {
      query: 'type:metric',
      limit: 1,
    },
    {
      enabled: hasFlag && detectorLimit !== UNLIMITED_QUOTA,
      staleTime: 5 * 60 * 1000, // Set stale time to 5 mins to avoid unnecessary re-fetching
    }
  );

  const hits = getResponseHeader?.('X-Hits');
  const detectorCount = hits ? parseInt(hits, 10) : NO_COUNT;

  if (!hasFlag || detectorLimit === UNLIMITED_QUOTA) {
    return {
      hasReachedLimit: false,
      detectorLimit: UNLIMITED_QUOTA,
      detectorCount,
      isLoading: false,
      isError: false,
    };
  }

  return {
    detectorCount,
    detectorLimit,
    hasReachedLimit: detectorCount >= detectorLimit,
    isLoading,
    isError,
  };
}
