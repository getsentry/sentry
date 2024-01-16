import useOrganization from 'sentry/utils/useOrganization';
import {DEFAULT_DURATION_AGGREGATE} from 'sentry/views/performance/database/settings';
import {Aggregate} from 'sentry/views/starfish/types';

type Result = Aggregate[];

export function useAvailableDurationAggregates(): Result {
  const organization = useOrganization();

  const availableAggregates: Aggregate[] = [];

  availableAggregates.push(DEFAULT_DURATION_AGGREGATE);

  if (organization.features?.includes('performance-database-view-percentiles')) {
    availableAggregates.push(
      ...['p50' as const, 'p75' as const, 'p95' as const, 'p99' as const]
    );
  }

  return availableAggregates;
}
