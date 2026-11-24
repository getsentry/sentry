import {useQuery} from '@tanstack/react-query';

import type {Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

import {hasImpactAssessment} from './groupImpact';
import {useEnvironmentsFromUrl} from './utils';

type GroupApiOptionsParameters = {
  environments: string[];
  groupId: string;
  organizationSlug: string;
  expandDerivedData?: boolean;
};

/**
 * Whether group requests should expand derived data. Every query for a group must
 * agree on this, since it is part of the query key.
 */
export function shouldExpandDerivedData(organization: Organization) {
  return (
    organization.features.includes('issue-inbox') || hasImpactAssessment(organization)
  );
}

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
      expand: ['owners', ...(expandDerivedData ? ['derivedData'] : [])],
      collapse: ['release', 'tags', 'stats'],
    },
    staleTime: 30_000,
  });
}

type GroupQueryFilterParameters = Pick<
  GroupApiOptionsParameters,
  'groupId' | 'organizationSlug'
>;

export function groupQueryFilter(params: GroupQueryFilterParameters) {
  return apiOptions.queryFilter('/organizations/$organizationIdOrSlug/issues/$issueId/', {
    path: {organizationIdOrSlug: params.organizationSlug, issueId: params.groupId},
  });
}

interface UseGroupOptions {
  groupId: string;
  options?: {enabled?: boolean};
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
      expandDerivedData: shouldExpandDerivedData(organization),
    }),
    gcTime: 30_000,
    retry: false,
    ...options,
  });
}
