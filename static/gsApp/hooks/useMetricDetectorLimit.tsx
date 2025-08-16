import useOrganization from 'sentry/utils/useOrganization';

type MetricDetectorLimitResponse = {
  isLimitExceeded: boolean;
  limit: number;
  numMetricMonitors: number;
} | null; // null means there is no limit

// TODO: Replace with actual hook
export function useMetricDetectorLimit(): MetricDetectorLimitResponse {
  const organization = useOrganization();

  if (!organization.features.includes('workflow-engine-metric-detector-limit')) {
    return null;
  }

  return {
    isLimitExceeded: true,
    numMetricMonitors: 20,
    limit: 20,
  };
}
