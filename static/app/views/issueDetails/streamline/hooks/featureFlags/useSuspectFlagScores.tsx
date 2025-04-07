import type {Group} from 'sentry/types/group';
import {useApiQuery} from 'sentry/utils/queryClient';
import usePageFilters from 'sentry/utils/usePageFilters';
import type {SuspectFlagScore} from 'sentry/views/issueDetails/streamline/featureFlagUtils';

/**
 * Query all feature flags and their scores for a given issue. Defaults to page filters for datetime and environment params.
 */
export function useSuspectFlagScores({
  group,
  environment,
  statsPeriod,
  start,
  end,
  enabled = true,
}: {
  group: Group;
  enabled?: boolean;
  end?: string;
  environment?: string[] | string;
  start?: string;
  statsPeriod?: string;
}) {
  const {selection} = usePageFilters();
  const query = {
    environment: environment ?? selection.environments,
    statsPeriod: statsPeriod ?? selection.datetime.period,
    start: start ?? selection.datetime.start?.toString(),
    end: end ?? selection.datetime.end?.toString(),
  };

  return useApiQuery<SuspectFlagScoresResponse>(
    [
      `/organizations/${group.project.organization.slug}/issues/${group.id}/suspect/flags/`,
      {query},
    ],
    {
      staleTime: 30000,
      enabled,
    }
  );
}

type SuspectFlagScoresResponse = {
  data: SuspectFlagScore[];
};
