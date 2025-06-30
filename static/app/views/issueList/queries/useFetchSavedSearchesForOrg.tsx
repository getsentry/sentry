import type {SavedSearch} from 'sentry/types/group';
import type {UseApiQueryOptions} from 'sentry/utils/queryClient';
import {useApiQuery} from 'sentry/utils/queryClient';
import {usePrefersStackedNav} from 'sentry/views/nav/usePrefersStackedNav';

type FetchSavedSearchesForOrgParameters = {
  orgSlug: string;
};

type FetchSavedSearchesForOrgResponse = SavedSearch[];

export const makeFetchSavedSearchesForOrgQueryKey = ({
  orgSlug,
}: FetchSavedSearchesForOrgParameters) =>
  [`/organizations/${orgSlug}/searches/`] as const;

export const useFetchSavedSearchesForOrg = (
  {orgSlug}: FetchSavedSearchesForOrgParameters,
  options: Partial<UseApiQueryOptions<FetchSavedSearchesForOrgResponse>> = {}
) => {
  const prefersStackedNav = usePrefersStackedNav();

  return useApiQuery<FetchSavedSearchesForOrgResponse>(
    makeFetchSavedSearchesForOrgQueryKey({orgSlug}),
    {
      staleTime: 30000,
      enabled: !prefersStackedNav,
      ...options,
    }
  );
};
