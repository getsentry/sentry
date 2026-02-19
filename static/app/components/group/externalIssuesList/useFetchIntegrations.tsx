import type {Group} from 'sentry/types/group';
import type {GroupIntegration} from 'sentry/types/integrations';
import type {OrganizationSummary} from 'sentry/types/organization';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {useApiQuery} from 'sentry/utils/queryClient';

function makeIntegrationsQueryKey(
  group: Group,
  organization: OrganizationSummary
): ApiQueryKey {
  return [
    getApiUrl('/organizations/$organizationIdOrSlug/issues/$issueId/integrations/', {
      path: {
        organizationIdOrSlug: organization.slug,
        issueId: group.id,
      },
    }),
  ];
}

export default function useFetchIntegrations({
  group,
  organization,
}: {
  group: Group;
  organization: OrganizationSummary;
}) {
  return useApiQuery<GroupIntegration[]>(makeIntegrationsQueryKey(group, organization), {
    staleTime: Infinity,
  });
}
