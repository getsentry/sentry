import type {OrganizationIntegration} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';

export function organizationIntegrationsQueryOptions({
  organization,
}: {
  organization: Organization;
}) {
  return apiOptions.as<OrganizationIntegration[]>()(
    '/organizations/$organizationIdOrSlug/integrations/',
    {
      path: {organizationIdOrSlug: organization.slug},
      query: {
        includeConfig: 0,
      },
      staleTime: 60_000,
    }
  );
}
