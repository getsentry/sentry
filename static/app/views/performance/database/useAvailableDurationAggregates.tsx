import useOrganization from 'sentry/utils/useOrganization';
import {DEFAULT_DURATION_AGGREGATE} from 'sentry/views/performance/database/settings';

// TODO: Type more strictly, these should be limited to only valid aggregate
// functions
type Result = string[];

export function useAvailableDurationAggregates(): Result {
  const organization = useOrganization();

  let availableAggregates: string[] = [];

  availableAggregates.push(DEFAULT_DURATION_AGGREGATE);

  if (organization.features?.includes('performance-database-view-percentiles')) {
    availableAggregates = [...availableAggregates, ...['p50', 'p75', 'p95', 'p99']];
  }

  // TODO: Enable this on the backend
  const areLimitsEnabled = false;
  if (areLimitsEnabled) {
    availableAggregates.push('max');
  }

  return availableAggregates;
}
