import {Project} from 'sentry/types';
import {DURATION_UNITS} from 'sentry/utils/discover/fieldRenderers';
import {useFunctions} from 'sentry/utils/profiling/hooks/useFunctions';
import {
  useProfileEvents,
  UseProfileEventsOptions,
} from 'sentry/utils/profiling/hooks/useProfileEvents';
import usePageFilters from 'sentry/utils/usePageFilters';
import {getProfilesTableFields} from 'sentry/views/profiling/profileSummary/content';

interface UseProfilingTransactionQuickSummaryOptions {
  project: Project;
  referrer: string;
  transaction: string;
  skipFunctions?: boolean;
  skipLatestProfile?: boolean;
  skipSlowestProfile?: boolean;
}

export function useProfilingTransactionQuickSummary(
  options: UseProfilingTransactionQuickSummaryOptions
) {
  const {
    transaction,
    project,
    referrer,
    skipFunctions = false,
    skipLatestProfile = false,
    skipSlowestProfile = false,
  } = options;
  const {selection} = usePageFilters();

  const baseQueryOptions: Omit<UseProfileEventsOptions, 'sort'> = {
    query: `transaction:"${transaction}"`,
    fields: getProfilesTableFields(project.platform),
    enabled: Boolean(transaction),
    limit: 1,
    referrer,
    refetchOnMount: false,
    projects: [project.id],
  };

  const slowestProfileQuery = useProfileEvents({
    ...baseQueryOptions,
    sort: {
      key: 'transaction.duration',
      order: 'desc',
    },
    enabled: !skipSlowestProfile,
  });

  const latestProfileQuery = useProfileEvents({
    ...baseQueryOptions,
    sort: {
      key: 'timestamp',
      order: 'desc',
    },
    enabled: !skipLatestProfile,
  });

  const functionsQuery = useFunctions({
    project,
    query: '',
    selection,
    transaction,
    sort: '-sum',
    functionType: 'application',
    enabled: !skipFunctions,
  });

  const slowestProfile = slowestProfileQuery?.data?.[0].data[0] ?? null;
  const durationUnits = slowestProfileQuery.data?.[0].meta.units['transaction.duration'];
  const slowestProfileDurationMultiplier = durationUnits
    ? DURATION_UNITS[durationUnits] ?? 1
    : 1;

  const latestProfile = latestProfileQuery?.data?.[0].data[0] ?? null;
  const functions = functionsQuery?.data?.[0]?.functions;

  return {
    // slowest
    slowestProfileQuery,
    slowestProfile,
    slowestProfileDurationMultiplier,
    // latest
    latestProfileQuery,
    latestProfile,
    // function
    functionsQuery,
    functions,
    // general
    isLoading:
      slowestProfileQuery.isLoading ||
      latestProfileQuery.isLoading ||
      functionsQuery.isLoading,
  };
}
