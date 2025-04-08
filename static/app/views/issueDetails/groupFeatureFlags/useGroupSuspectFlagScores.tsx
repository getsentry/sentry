import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import type {SuspectFlagScore} from 'sentry/views/issueDetails/streamline/featureFlagUtils';

/**
 * Query all feature flags and their scores for a given issue. Defaults to page filters for datetime and environment params.
 */
export function useGroupSuspectFlagScores({
  groupId,
  environment,
  statsPeriod,
  start,
  end,
  enabled = true,
}: {
  groupId: string;
  enabled?: boolean;
  end?: string;
  environment?: string[] | string;
  start?: string;
  statsPeriod?: string;
}) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const query = {
    environment: environment ?? selection.environments,
    statsPeriod: statsPeriod ?? selection.datetime.period,
    start: start ?? selection.datetime.start?.toString(),
    end: end ?? selection.datetime.end?.toString(),
  };

  return useApiQuery<SuspectFlagScoresResponse>(
    [`/organizations/${organization.slug}/issues/${groupId}/suspect/flags/`, {query}],
    {
      staleTime: 30000,
      enabled,
    }
  );
}

type SuspectFlagScoresResponse = {
  data: SuspectFlagScore[];
};
