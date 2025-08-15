import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

type SuspectFlagScore = {
  baseline_percent: number;
  distribution: {
    baseline: Record<string, number>;
    outliers: Record<string, number>;
  };
  flag: string;
  score: number;
};

type SuspectFlagScoresResponse = {
  data: SuspectFlagScore[];
};

/**
 * Query all feature flags and their scores for a given issue. Defaults to page filters if environment is not provided.
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
  const query = Object.fromEntries(
    Object.entries({
      environment: environment ?? selection.environments,
      statsPeriod,
      start,
      end,
    }).filter(([_, value]) => !!value)
  );

  return useApiQuery<SuspectFlagScoresResponse>(
    [`/organizations/${organization.slug}/issues/${groupId}/suspect/flags/`, {query}],
    {
      staleTime: 30000,
      enabled,
    }
  );
}
