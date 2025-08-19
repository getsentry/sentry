import useOrganization from 'sentry/utils/useOrganization';

type MetricDetectorLimitResponse = {
  detectorCount: number;
  detectorLimit: number;
  hasReachedLimit: boolean;
  isError: boolean;
  isLoading: boolean;
} | null;

// TODO: Replace with actual hook
export function useMetricDetectorLimit(): MetricDetectorLimitResponse {
  const organization = useOrganization();

  if (!organization.features.includes('workflow-engine-metric-detector-limit')) {
    return null;
  }

  return {
    hasReachedLimit: true,
    detectorCount: 20,
    detectorLimit: 20,
    isError: false,
    isLoading: false,
  };
}
