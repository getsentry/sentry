import type {OrganizationIntegration} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';

export function organizationIntegrationsQueryOptions({
  cursor,
  features = [],
  includeConfig = false,
  organization,
  providerKey,
  staleTime = 60_000,
}: {
  organization: Organization;
  cursor?: string;
  features?: string[];
  includeConfig?: boolean;
  providerKey?: string;
  staleTime?: number;
}) {
  return apiOptions.as<OrganizationIntegration[]>()(
    '/organizations/$organizationIdOrSlug/integrations/',
    {
      path: {organizationIdOrSlug: organization.slug},
      query: {
        cursor,
        features,
        includeConfig: includeConfig ? 1 : 0,
        providerKey,
      },
      staleTime,
    }
  );
}
