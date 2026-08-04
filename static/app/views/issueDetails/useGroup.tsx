import {useQuery} from '@tanstack/react-query';

import type {Group} from 'sentry/types/group';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useEnvironmentsFromUrl} from 'sentry/views/issueDetails/utils';

type GroupApiOptionsParameters = {
  environments: string[];
  groupId: string;
  organizationSlug: string;
  expandDerivedData?: boolean;
};

export function groupApiOptions({
  groupId,
  organizationSlug,
  environments,
  expandDerivedData = false,
}: GroupApiOptionsParameters) {
  return apiOptions.as<Group>()('/organizations/$organizationIdOrSlug/issues/$issueId/', {
    path: {organizationIdOrSlug: organizationSlug, issueId: groupId},
    query: {
      ...(environments.length > 0 ? {environment: environments} : {}),
      expand: ['inbox', 'owners', ...(expandDerivedData ? ['derivedData'] : [])],
      collapse: ['release', 'tags', 'stats'],
    },
    staleTime: 30_000,
  });
}

type GroupQueryKeyParameters = Pick<
  GroupApiOptionsParameters,
  'groupId' | 'organizationSlug'
>;

export function groupQueryKey(params: GroupQueryKeyParameters) {
  return [groupApiOptions({...params, environments: []}).queryKey[0]] as const;
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
      expandDerivedData: organization.features.includes('issue-stream-progress-ui'),
    }),
    gcTime: 30_000,
    retry: false,
    ...options,
  });
}
