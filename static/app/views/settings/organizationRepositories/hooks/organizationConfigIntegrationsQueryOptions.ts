import type {IntegrationProvider} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';

export function organizationConfigIntegrationsQueryOptions({
  organization,
  providerKey,
  staleTime = 60_000,
}: {
  organization: Organization;
  providerKey?: string;
  staleTime?: number;
}) {
  return apiOptions.as<{providers: IntegrationProvider[]}>()(
    '/organizations/$organizationIdOrSlug/config/integrations/',
    {
      path: {organizationIdOrSlug: organization.slug},
      query: {providerKey},
      staleTime,
    }
  );
}
