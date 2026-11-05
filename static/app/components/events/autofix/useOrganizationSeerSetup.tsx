import {useQuery, type UseQueryOptions} from '@tanstack/react-query';

import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import type {ApiQueryKey} from 'sentry/utils/api/apiQueryKey';
import {areAiFeaturesAllowed as computeAreAiFeaturesAllowed} from 'sentry/utils/seer/areAiFeaturesAllowed';
import {useOrganization} from 'sentry/utils/useOrganization';

interface OrganizationSeerSetupResponse {
  billing: {
    hasAutofixQuota: boolean;
    hasScannerQuota: boolean;
  };
  hasFreeAutofixAccess: boolean;
}

export function organizationSeerSetupApiOptions(orgSlug: string) {
  return apiOptions.as<OrganizationSeerSetupResponse>()(
    '/organizations/$organizationIdOrSlug/seer/setup-check/',
    {path: {organizationIdOrSlug: orgSlug}, staleTime: 0}
  );
}

export function makeOrganizationSeerSetupQueryKey(orgSlug: string) {
  return organizationSeerSetupApiOptions(orgSlug).queryKey;
}

export function useOrganizationSeerSetup(
  options: Omit<
    UseQueryOptions<
      ApiResponse<OrganizationSeerSetupResponse>,
      Error,
      OrganizationSeerSetupResponse,
      ApiQueryKey
    >,
    'staleTime' | 'queryKey' | 'queryFn' | 'select'
  > = {}
) {
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
    // eslint-disable-next-line @tanstack/query/no-rest-destructuring -- Preserve the shared hook result interface.
    ...queryData,
    billing: {
      hasAutofixQuota: Boolean(queryData.data?.billing?.hasAutofixQuota),
      hasScannerQuota: Boolean(queryData.data?.billing?.hasScannerQuota),
    },
    hasFreeAutofixAccess: Boolean(queryData.data?.hasFreeAutofixAccess),
    areAiFeaturesAllowed,
  };
}
