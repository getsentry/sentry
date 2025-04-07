import type {Organization} from 'sentry/types/organization';
import {useApiQuery} from 'sentry/utils/queryClient';
import type {SuspectFlagScore} from 'sentry/views/issueDetails/streamline/featureFlagUtils';

export function useSuspectFlagScores({
  organization,
  issue_id,
  environment,
  statsPeriod,
  start,
  end,
}: {
  issue_id: number;
  organization: Organization;
  end?: string;
  environment?: string;
  start?: string;
  statsPeriod?: string;
}) {
  const query = {
    environment,
    statsPeriod,
    start,
    end,
  };

  return useApiQuery<SuspectFlagScoresResponse>(
    [`/organizations/${organization.slug}/issues/${issue_id}/suspect/flags/`, {query}],
    {
      staleTime: 0,
    }
  );
}

type SuspectFlagScoresResponse = {
  data: SuspectFlagScore[];
};
