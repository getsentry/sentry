import {useMemo} from 'react';

import {Project} from 'sentry/types';
import {DURATION_UNITS} from 'sentry/utils/discover/fieldRenderers';
import {
  useProfileEvents,
  UseProfileEventsOptions,
} from 'sentry/utils/profiling/hooks/useProfileEvents';
import {useProfileFunctions} from 'sentry/utils/profiling/hooks/useProfileFunctions';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
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

  const baseQueryOptions: Omit<UseProfileEventsOptions, 'sort' | 'referrer'> = {
    query: `transaction:"${transaction}"`,
    fields: getProfilesTableFields(project.platform),
    enabled: Boolean(transaction),
    limit: 1,
    refetchOnMount: false,
    projects: [project.id],
  };

  const slowestProfileQuery = useProfileEvents({
    ...baseQueryOptions,
    referrer: `${referrer}.slowest`,
    sort: {
      key: 'transaction.duration',
      order: 'desc',
    },
    enabled: !skipSlowestProfile,
  });

  const latestProfileQuery = useProfileEvents({
    ...baseQueryOptions,
    referrer: `${referrer}.latest`,
    sort: {
      key: 'timestamp',
      order: 'desc',
    },
    enabled: !skipLatestProfile,
  });

  const query = useMemo(() => {
    const conditions = new MutableSearch('');
    conditions.setFilterValues('transaction', [transaction]);
    conditions.setFilterValues('is_application', ['1']);
    return conditions.formatString();
  }, [transaction]);

  const functionsQuery = useProfileFunctions<FunctionsField>({
    fields: functionsFields,
    referrer: `${referrer}.functions`,
    sort: {
      key: 'sum()',
      order: 'desc',
    },
    query,
    limit: 5,
    enabled: !skipFunctions,
  });

  const slowestProfile = slowestProfileQuery?.data?.data[0] ?? null;
  const durationUnits = slowestProfileQuery.data?.meta.units['transaction.duration'];
  const slowestProfileDurationMultiplier = durationUnits
    ? DURATION_UNITS[durationUnits] ?? 1
    : 1;

  const latestProfile = latestProfileQuery?.data?.data[0] ?? null;
  const functions = functionsQuery?.data?.data;

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

const functionsFields = [
  'package',
  'function',
  'count()',
  'sum()',
  'examples()',
] as const;

type FunctionsField = (typeof functionsFields)[number];
