import type {SavedSearch} from 'sentry/types/group';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import type {UseApiQueryOptions} from 'sentry/utils/queryClient';
import {useApiQuery} from 'sentry/utils/queryClient';

type FetchSavedSearchesForOrgParameters = {
  orgSlug: string;
};

type FetchSavedSearchesForOrgResponse = SavedSearch[];

const makeFetchSavedSearchesForOrgQueryKey = ({
  orgSlug,
}: FetchSavedSearchesForOrgParameters) =>
  [
    getApiUrl('/organizations/$organizationIdOrSlug/searches/', {
      path: {organizationIdOrSlug: orgSlug},
    }),
  ] as const;

export const useFetchSavedSearchesForOrg = (
  {orgSlug}: FetchSavedSearchesForOrgParameters,
  options: Partial<UseApiQueryOptions<FetchSavedSearchesForOrgResponse>> = {}
) => {
  return useApiQuery<FetchSavedSearchesForOrgResponse>(
    makeFetchSavedSearchesForOrgQueryKey({orgSlug}),
    {
      staleTime: 30000,
      ...options,
    }
  );
};
