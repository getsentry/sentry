import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {
  useApiQuery,
  type ApiQueryKey,
  type UseApiQueryOptions,
} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';

interface OrganizationSeerSetupResponse {
  billing: {
    hasAutofixQuota: boolean;
    hasScannerQuota: boolean;
  };
}

export function makeOrganizationSeerSetupQueryKey(orgSlug: string): ApiQueryKey {
  return [
    getApiUrl('/organizations/$organizationIdOrSlug/seer/setup-check/', {
      path: {organizationIdOrSlug: orgSlug},
    }),
  ];
}

export function useOrganizationSeerSetup(
  options: Omit<UseApiQueryOptions<OrganizationSeerSetupResponse>, 'staleTime'> = {}
) {
  const organization = useOrganization();
  const orgSlug = organization.slug;
  const areAiFeaturesAllowed =
    !organization.hideAiFeatures && organization.features.includes('gen-ai-features');

  const queryData = useApiQuery<OrganizationSeerSetupResponse>(
    makeOrganizationSeerSetupQueryKey(orgSlug),
    {
      staleTime: 0,
      retry: false,
      ...options,
    }
  );

  return {
    ...queryData,
    billing: {
      hasAutofixQuota: Boolean(queryData.data?.billing?.hasAutofixQuota),
      hasScannerQuota: Boolean(queryData.data?.billing?.hasScannerQuota),
    },
    areAiFeaturesAllowed,
  };
}
