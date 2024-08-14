import type {Group} from 'sentry/types/group';
import type {GroupIntegration} from 'sentry/types/integrations';
import type {OrganizationSummary} from 'sentry/types/organization';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {useApiQuery} from 'sentry/utils/queryClient';

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
