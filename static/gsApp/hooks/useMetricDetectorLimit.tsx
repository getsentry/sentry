import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
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

  const isWorkflowEngine = organization.features.includes('workflow-engine-ui');
  const hasFlag = organization.features.includes('workflow-engine-metric-detector-limit');

  const {
    isLoading: isDetectorsLoading,
    isError: isDetectorsError,
    getResponseHeader: getDetectorsResponseHeader,
  } = useDetectorsQuery(
    {
      query: 'type:metric',
      limit: 1,
    },
    {
      enabled: hasFlag && isWorkflowEngine && detectorLimit !== UNLIMITED_QUOTA,
      staleTime: 5 * 1000, // Set stale time to 5 sec to avoid unnecessary re-fetching
    }
  );

  const {
    isLoading: isMetricRulesLoading,
    isError: isMetricRulesError,
    getResponseHeader: getMetricRulesResponseHeader,
  } = useApiQuery<any[]>(
    [
      getApiUrl(`/organizations/$organizationIdOrSlug/alert-rules/`, {
        path: {organizationIdOrSlug: organization.slug},
      }),
      {query: {limit: 1}},
    ],
    {
      enabled: hasFlag && !isWorkflowEngine && detectorLimit !== UNLIMITED_QUOTA,
      staleTime: 5 * 1000, // Set stale time to 5 sec to avoid unnecessary re-fetching
    }
  );

  const isLoading = isWorkflowEngine ? isDetectorsLoading : isMetricRulesLoading;
  const isError = isWorkflowEngine ? isDetectorsError : isMetricRulesError;
  const detectorHits = isWorkflowEngine
    ? getDetectorsResponseHeader?.('X-Hits')
    : getMetricRulesResponseHeader?.('X-Hits');
  const detectorCount = detectorHits ? parseInt(detectorHits, 10) : NO_COUNT;

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
