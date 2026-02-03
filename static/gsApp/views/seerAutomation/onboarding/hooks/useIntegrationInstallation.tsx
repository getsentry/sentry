import type {OrganizationIntegration} from 'sentry/types/integrations';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

/**
 * Fetches integration installations for an organization, given a provider key (e.g. "github")
 *
 * @param provider_key Integration provider key (e.g. "github")
 * @returns Integration installations for the organization
 */
export function useIntegrationInstallation(provider_key: string) {
  const organization = useOrganization();
  const {data, isPending} = useApiQuery<OrganizationIntegration[]>(
    [
      getApiUrl(`/organizations/$organizationIdOrSlug/integrations/`, {
        path: {organizationIdOrSlug: organization.slug},
      }),
      {
        query: {
          includeConfig: 0,
          provider_key,
        },
      },
    ],
    {
      staleTime: 0,
    }
  );

  return {
    data,
    isPending,
  };
}
