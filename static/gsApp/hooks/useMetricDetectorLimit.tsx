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
    getResponseHeader,
  } = useDetectorsQuery(
    {
      query: 'type:metric',
      limit: 1,
    },
    {
      enabled: hasFlag && isWorkflowEngine && detectorLimit !== UNLIMITED_QUOTA,
    }
  );

  const {
    isLoading: isCombinedRulesLoading,
    isError: isCombinedRulesError,
    getResponseHeader: getCombinedRulesResponseHeader,
  } = useApiQuery<any[]>(
    [`/organizations/${organization.slug}/alert-rules/`, {query: {limit: 1}}],
    {
      enabled: hasFlag && !isWorkflowEngine && detectorLimit !== UNLIMITED_QUOTA,
      staleTime: 0,
    }
  );

  const isLoading = isWorkflowEngine ? isDetectorsLoading : isCombinedRulesLoading;
  const isError = isWorkflowEngine ? isDetectorsError : isCombinedRulesError;
  const detectorHits = isWorkflowEngine
    ? getResponseHeader?.('X-Hits')
    : getCombinedRulesResponseHeader?.('X-Hits');
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
