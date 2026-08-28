import type {IntegrationProvider} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';

export function organizationConfigIntegrationsQueryOptions({
  organization,
}: {
  organization: Organization;
}) {
  return apiOptions.as<{providers: IntegrationProvider[]}>()(
    '/organizations/$organizationIdOrSlug/config/integrations/',
    {
      path: {organizationIdOrSlug: organization.slug},
      staleTime: 60_000,
    }
  );
}
