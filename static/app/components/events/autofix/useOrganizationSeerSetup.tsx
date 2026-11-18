import {useQuery} from '@tanstack/react-query';

import {apiOptions} from 'sentry/utils/api/apiOptions';
import {areAiFeaturesAllowed as computeAreAiFeaturesAllowed} from 'sentry/utils/seer/areAiFeaturesAllowed';
import {useOrganization} from 'sentry/utils/useOrganization';

interface OrganizationSeerSetupResponse {
  billing: {
    hasAutofixQuota: boolean;
    hasScannerQuota: boolean;
  };
  hasFreeAutofixAccess: boolean;
}

function organizationSeerSetupApiOptions(orgSlug: string) {
  return apiOptions.as<OrganizationSeerSetupResponse>()(
    '/organizations/$organizationIdOrSlug/seer/setup-check/',
    {path: {organizationIdOrSlug: orgSlug}, staleTime: 0}
  );
}

export function makeOrganizationSeerSetupQueryKey(orgSlug: string) {
  return organizationSeerSetupApiOptions(orgSlug).queryKey;
}

export function useOrganizationSeerSetup(options: {enabled?: boolean} = {}) {
  const organization = useOrganization();
  const orgSlug = organization.slug;
  const areAiFeaturesAllowed = computeAreAiFeaturesAllowed(organization);

  const queryData = useQuery({
    ...organizationSeerSetupApiOptions(orgSlug),
    staleTime: 0,
    retry: false,
    ...options,
  });

  return {
    data: queryData.data,
    isLoading: queryData.isLoading,
    isError: queryData.isError,
    isPending: queryData.isPending,
    refetch: queryData.refetch,
    billing: {
      hasAutofixQuota: Boolean(queryData.data?.billing?.hasAutofixQuota),
      hasScannerQuota: Boolean(queryData.data?.billing?.hasScannerQuota),
    },
    hasFreeAutofixAccess: Boolean(queryData.data?.hasFreeAutofixAccess),
    areAiFeaturesAllowed,
  };
}
