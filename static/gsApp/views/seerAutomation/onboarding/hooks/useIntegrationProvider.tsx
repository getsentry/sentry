import {useMemo} from 'react';

import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import type {IntegrationInformation} from 'sentry/views/settings/organizationIntegrations/integrationDetailedView';

export function useIntegrationProvider(provider_key: string) {
  const organization = useOrganization();
  const {data, isPending} = useApiQuery<IntegrationInformation>(
    [
      `/organizations/${organization.slug}/config/integrations/`,
      {
        query: {
          provider_key,
        },
      },
    ],
    {
      staleTime: 0,
    }
  );

  return useMemo(() => {
    return {
      provider: data?.providers?.at(0),
      isPending,
    };
  }, [data, isPending]);
}
