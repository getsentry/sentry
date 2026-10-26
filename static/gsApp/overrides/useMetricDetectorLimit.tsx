import {useQuery} from '@tanstack/react-query';

import {useOrganization} from 'sentry/utils/useOrganization';
import {detectorListApiOptions} from 'sentry/views/detectors/hooks/index';

import {useSubscription} from 'getsentry/hooks/useSubscription';

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

  const {
    data: detectorXHits = NO_COUNT,
    isLoading: isDetectorsLoading,
    isError: isDetectorsError,
  } = useQuery({
    ...detectorListApiOptions(organization, {
      query: 'type:metric',
      limit: 1,
    }),
    enabled: hasFlag && detectorLimit !== UNLIMITED_QUOTA,
    staleTime: 5 * 1000, // Set stale time to 5 sec to avoid unnecessary re-fetching
    select: data => data.headers['X-Hits'],
  });

  const isLoading = isDetectorsLoading;
  const isError = isDetectorsError;
  const detectorCount = detectorXHits;

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
