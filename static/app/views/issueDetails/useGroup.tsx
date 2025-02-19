import type {Group} from 'sentry/types/group';
import {
  type ApiQueryKey,
  useApiQuery,
  type UseApiQueryOptions,
} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';
import {useEnvironmentsFromUrl} from 'sentry/views/issueDetails/utils';

type FetchGroupQueryParameters = {
  environments: string[];
  groupId: string;
  organizationSlug: string;
};

export function makeFetchGroupQueryKey({
  groupId,
  organizationSlug,
  environments,
}: FetchGroupQueryParameters): ApiQueryKey {
  const query: Record<string, string | string[]> = {
    ...(environments.length > 0 ? {environment: environments} : {}),
    expand: ['inbox', 'owners'],
    collapse: ['release', 'tags'],
  };

  return [`/organizations/${organizationSlug}/issues/${groupId}/`, {query}];
}

interface UseGroupOptions {
  groupId: string;
  options?: Omit<UseApiQueryOptions<Group>, 'staleTime'>;
}

/**
 * Used to fetch group details for issue details.
 * Data is still synced with the GroupStore for legacy reasons.
 */
export function useGroup({groupId, options}: UseGroupOptions) {
  const organization = useOrganization();
  const environments = useEnvironmentsFromUrl();

  const [realtime, _] = useSyncedLocalStorageState('issue-details-realtime', false);

  return useApiQuery<Group>(
    makeFetchGroupQueryKey({organizationSlug: organization.slug, groupId, environments}),
    {
      staleTime: realtime ? 0 : 30000,
      refetchInterval: realtime ? 5000 : false,
      gcTime: 30000,
      retry: false,
      ...options,
    }
  );
}
