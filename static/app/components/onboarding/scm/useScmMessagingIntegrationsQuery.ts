import {useQuery} from '@tanstack/react-query';

import type {OrganizationIntegration} from 'sentry/types/integrations';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

export function useScmMessagingIntegrationsQuery() {
  const organization = useOrganization();
  return useQuery({
    ...apiOptions.as<OrganizationIntegration[]>()(
      '/organizations/$organizationIdOrSlug/integrations/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {integrationType: 'messaging'},
        staleTime: 0,
      }
    ),
    refetchOnWindowFocus: true,
  });
}
