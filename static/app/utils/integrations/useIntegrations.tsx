import {useMemo} from 'react';
import {useQueries} from '@tanstack/react-query';

import type {OrganizationIntegration} from 'sentry/types/integrations';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

interface UseIntegrationsOptions {
  integrationIds: Array<number | undefined>;
}

export function useIntegrations({integrationIds}: UseIntegrationsOptions) {
  const organization = useOrganization();

  const uniqueIds = useMemo(() => {
    return [...new Set(integrationIds.filter((id): id is number => id !== undefined))];
  }, [integrationIds]);

  return useQueries({
    queries: uniqueIds.map(id =>
      apiOptions.as<OrganizationIntegration>()(
        '/organizations/$organizationIdOrSlug/integrations/$integrationId/',
        {
          path: {
            organizationIdOrSlug: organization.slug,
            integrationId: String(id),
          },
          staleTime: Infinity,
        }
      )
    ),
    combine: results => ({
      integrations: results
        .map(r => r.data)
        .filter((i): i is OrganizationIntegration => i !== undefined),
      isPending: results.some(r => r.isPending),
      isError: results.some(r => r.isError),
    }),
  });
}
