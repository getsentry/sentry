import type {Integration} from 'sentry/types/integrations';
import type {OrganizationSummary} from 'sentry/types/organization';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {useApiQuery} from 'sentry/utils/queryClient';

function makeIntegrationsQueryKey(organization: OrganizationSummary): ApiQueryKey {
  return [
    getApiUrl(`/organizations/$organizationIdOrSlug/integrations/`, {
      path: {organizationIdOrSlug: organization.slug},
    }),
    {query: {includeConfig: 0, provider_key: 'github'}},
  ];
}

export function useGetActiveIntegratedOrgs({
  organization,
}: {
  organization: OrganizationSummary;
}) {
  const {data: integrations, ...rest} = useApiQuery<Integration[]>(
    makeIntegrationsQueryKey(organization),
    {
      staleTime: 0,
    }
  );

  return {
    data: integrations?.filter(integration => integration.status === 'active'),
    ...rest,
  };
}
