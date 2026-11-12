import {useQuery} from '@tanstack/react-query';

import type {OrganizationIntegration} from 'sentry/types/integrations';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

/**
 * Fetches integration installations for an organization, given a provider key (e.g. "github")
 *
 * @param provider_key Integration provider key (e.g. "github")
 * @returns Integration installations for the organization
 */
export function useIntegrationInstallation(provider_key: string) {
  const organization = useOrganization();
  const {data, isPending} = useQuery(
    apiOptions.as<OrganizationIntegration[]>()(
      '/organizations/$organizationIdOrSlug/integrations/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {
          includeConfig: 0,
          provider_key,
        },
        staleTime: 0,
      }
    )
  );

  return {
    data,
    isPending,
  };
}
