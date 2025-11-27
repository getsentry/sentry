import type {OrganizationIntegration} from 'sentry/types/integrations';
import {useApiQuery, type UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useOrganization from 'sentry/utils/useOrganization';

export function usePreventAIOrgs(): UseApiQueryResult<
  OrganizationIntegration[],
  RequestError
> {
  const organization = useOrganization();

  return useApiQuery<OrganizationIntegration[]>(
    [
      `/organizations/${organization.slug}/integrations/`,
      {query: {includeConfig: 0, provider_key: 'github'}},
    ],
    {
      staleTime: 0,
      retry: false,
    }
  );
}
