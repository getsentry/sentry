import {useQuery} from '@tanstack/react-query';

import type {Group} from 'sentry/types/group';
import type {GroupIntegration} from 'sentry/types/integrations';
import type {OrganizationSummary} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';

function integrationsOptions(group: Group, organization: OrganizationSummary) {
  return apiOptions.as<GroupIntegration[]>()(
    '/organizations/$organizationIdOrSlug/issues/$issueId/integrations/',
    {
      path: {
        organizationIdOrSlug: organization.slug,
        issueId: group.id,
      },
      staleTime: Infinity,
    }
  );
}

export function useFetchIntegrations({
  group,
  organization,
}: {
  group: Group;
  organization: OrganizationSummary;
}) {
  return useQuery(integrationsOptions(group, organization));
}
