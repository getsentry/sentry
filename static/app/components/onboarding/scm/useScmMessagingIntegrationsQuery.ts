import {useQuery} from '@tanstack/react-query';

import type {OrganizationIntegration} from 'sentry/types/integrations';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

/**
 * Fetches (and caches) the list of messaging integrations for the current org.
 * Call this from multiple components freely — React Query dedupes identical keys
 * into a single in-flight request and shares the cached result.
 */
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
