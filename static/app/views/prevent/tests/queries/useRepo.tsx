import {useApiQuery} from 'sentry/utils/queryClient';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';

export interface Repository {
  testAnalyticsEnabled: boolean;
  uploadToken?: string;
}

export function useRepo({
  organizationSlug,
  integratedOrgId,
  repository,
}: {
  integratedOrgId?: string;
  organizationSlug?: string;
  repository?: string;
}): UseApiQueryResult<Repository, RequestError> {
  return useApiQuery<Repository>(
    [
      `/organizations/${organizationSlug}/prevent/owner/${integratedOrgId}/repository/${repository}/`,
    ],
    {
      staleTime: 0,
      enabled: Boolean(organizationSlug && integratedOrgId && repository),
    }
  );
}
