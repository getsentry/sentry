import {type Group, IssueCategory} from 'sentry/types/group';
import {
  type ApiQueryKey,
  useApiQuery,
  type UseApiQueryOptions,
} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {useEventQuery} from 'sentry/views/issueDetails/streamline/eventSearch';
import {useIssueDetailsEventView} from 'sentry/views/issueDetails/streamline/useIssueDetailsDiscoverQuery';

interface ReplayIdsParameters {
  orgSlug: string;
  query: {
    data_source: 'discover' | 'search_issues';
    query: string;
    statsPeriod: string;
    environment?: string[];
    returnIds?: boolean;
  };
}

export type ReplayCount = Record<string, number>;
export type ReplayIds = Record<string, string[]>;

function makeReplayCountQueryKey({orgSlug, query}: ReplayIdsParameters): ApiQueryKey {
  return [`/organizations/${orgSlug}/replay-count/`, {query}];
}

function useReplayCount<T>(
  params: ReplayIdsParameters,
  options: Partial<UseApiQueryOptions<T>> = {}
) {
  return useApiQuery<T>(makeReplayCountQueryKey(params), {
    staleTime: Infinity,
    retry: false,
    ...options,
  });
}

export function useIssueDetailsReplayCount<T extends ReplayCount | ReplayIds>({
  group,
}: {
  group: Group;
}) {
  const organization = useOrganization();
  const searchQuery = useEventQuery({group});
  const eventView = useIssueDetailsEventView({group});
  return useReplayCount<T>({
    orgSlug: organization.slug,
    query: {
      data_source:
        group.issueCategory === IssueCategory.ERROR ? 'discover' : 'search_issues',
      statsPeriod: eventView.statsPeriod ?? '90d',
      environment: [...eventView.environment],
      query: `issue.id:[${group.id}] ${searchQuery}`,
    },
  });
}
