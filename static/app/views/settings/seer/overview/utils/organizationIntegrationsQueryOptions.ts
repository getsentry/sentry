import type {OrganizationIntegration} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';

export function organizationIntegrationsQueryOptions({
  organization,
  staleTime = 60_000,
  includeConfig = 0,
}: {
  organization: Organization;
  includeConfig?: number;
  staleTime?: number;
}) {
  return apiOptions.as<OrganizationIntegration[]>()(
    '/organizations/$organizationIdOrSlug/integrations/',
    {
      path: {organizationIdOrSlug: organization.slug},
      query: {includeConfig},
      staleTime,
    }
  );
}
