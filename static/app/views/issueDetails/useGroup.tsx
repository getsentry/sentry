import {useQuery} from '@tanstack/react-query';

import type {Group} from 'sentry/types/group';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useEnvironmentsFromUrl} from 'sentry/views/issueDetails/utils';

type GroupApiOptionsParameters = {
  environments: string[];
  groupId: string;
  organizationSlug: string;
};

export function groupApiOptions({
  groupId,
  organizationSlug,
  environments,
}: GroupApiOptionsParameters) {
  return apiOptions.as<Group>()('/organizations/$organizationIdOrSlug/issues/$issueId/', {
    path: {organizationIdOrSlug: organizationSlug, issueId: groupId},
    query: {
      ...(environments.length > 0 ? {environment: environments} : {}),
      expand: ['inbox', 'owners'],
      collapse: ['release', 'tags', 'stats'],
    },
    staleTime: 30_000,
  });
}

interface UseGroupOptions {
  groupId: string;
  options?: {
    enabled?: boolean;
  };
}

/**
 * Used to fetch group details for issue details.
 * Data is still synced with the GroupStore for legacy reasons.
 */
export function useGroup({groupId, options}: UseGroupOptions) {
  const organization = useOrganization();
  const environments = useEnvironmentsFromUrl();

  return useQuery({
    ...groupApiOptions({
      organizationSlug: organization.slug,
      groupId,
      environments,
    }),
    gcTime: 30_000,
    retry: false,
    ...options,
  });
}
