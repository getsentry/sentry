import {usePreventContext} from 'sentry/components/prevent/context/preventContext';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useOrganization from 'sentry/utils/useOrganization';

interface Repository {
  testAnalyticsEnabled: boolean;
  uploadToken?: string;
}

export function useRepo(): UseApiQueryResult<Repository, RequestError> {
  const organization = useOrganization();
  const {integratedOrgId, repository} = usePreventContext();
  const organizationSlug = organization.slug;

  return useApiQuery<Repository>(
    [
      getApiUrl(
        '/organizations/$organizationIdOrSlug/prevent/owner/$owner/repository/$repository/',
        {
          path: {
            organizationIdOrSlug: organizationSlug,
            owner: integratedOrgId!,
            repository: repository!,
          },
        }
      ),
    ],
    {
      staleTime: 30_000,
      enabled: Boolean(organizationSlug && integratedOrgId && repository),
    }
  );
}
