import {useMemo} from 'react';
import {useQuery} from '@tanstack/react-query';

import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {IntegrationInformation} from 'sentry/views/settings/organizationIntegrations/integrationDetailedView';

export function useIntegrationProvider(provider_key: string) {
  const organization = useOrganization();
  const {data, isPending} = useQuery(
    apiOptions.as<IntegrationInformation>()(
      '/organizations/$organizationIdOrSlug/config/integrations/',
      {
        path: {organizationIdOrSlug: organization.slug},
        query: {
          provider_key,
        },
        staleTime: 0,
      }
    )
  );

  return useMemo(() => {
    return {
      provider: data?.providers?.at(0),
      isPending,
    };
  }, [data, isPending]);
}
