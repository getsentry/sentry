type MetricDetectorLimitResponse = {
  isLimitExceeded: boolean;
  limit: number;
  numMetricMonitors: number;
} | null;

// TODO: Replace with actual hook
export function useMetricDetectorLimit(): MetricDetectorLimitResponse {
  return {
    isLimitExceeded: true,
    numMetricMonitors: 20,
    limit: 20,
  };
}
