import type {Group} from 'sentry/types/group';
import {
  useApiQuery,
  type ApiQueryKey,
  type UseApiQueryOptions,
} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
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
    collapse: ['tags'],
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

  return useApiQuery<Group>(
    makeFetchGroupQueryKey({organizationSlug: organization.slug, groupId, environments}),
    {
      staleTime: 30000,
      gcTime: 30000,
      retry: false,
      ...options,
    }
  );
}
