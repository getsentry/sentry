import {useQuery} from '@tanstack/react-query';

import {useOrganization} from 'sentry/utils/useOrganization';
import {metricDetectorQuotaApiOptions} from 'sentry/views/detectors/hooks';

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
  const hasFlag = organization.features.includes('workflow-engine-metric-detector-limit');

  const {data, isLoading, isError} = useQuery({
    ...metricDetectorQuotaApiOptions(organization),
    enabled: hasFlag,
  });

  return {
    detectorCount: data?.count ?? NO_COUNT,
    detectorLimit: data?.limit ?? UNLIMITED_QUOTA,
    hasReachedLimit: data?.hasReachedLimit ?? false,
    isLoading,
    isError,
  };
}
