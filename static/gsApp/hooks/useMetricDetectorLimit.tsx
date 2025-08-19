import useOrganization from 'sentry/utils/useOrganization';

type MetricDetectorLimitResponse = {
  detectorCount: number;
  detectorLimit: number;
  hasReachedLimit: boolean;
  isError: boolean;
  isLoading: boolean;
};

// TODO: Replace with actual hook
export function useMetricDetectorLimit(): MetricDetectorLimitResponse {
  const organization = useOrganization();

  if (!organization.features.includes('workflow-engine-metric-detector-limit')) {
    return {
      hasReachedLimit: false,
      detectorLimit: -1,
      detectorCount: -1,
      isLoading: false,
      isError: false,
    };
  }

  return {
    hasReachedLimit: true,
    detectorCount: 20,
    detectorLimit: 20,
    isError: false,
    isLoading: false,
  };
}
