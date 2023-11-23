import type {Group, GroupIntegration, OrganizationSummary} from 'sentry/types';
import {ApiQueryKey, useApiQuery} from 'sentry/utils/queryClient';

function makeIntegrationsQueryKey(
  group: Group,
  organization: OrganizationSummary
): ApiQueryKey {
  return [`/organizations/${organization.slug}/issues/${group.id}/integrations/`];
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
