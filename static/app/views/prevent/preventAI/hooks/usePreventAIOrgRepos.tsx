import {useCallback} from 'react';

import type {PreventAIOrg} from 'sentry/types/prevent';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

interface PreventAIOrgReposResponse {
  orgRepos: PreventAIOrg[];
}

interface PreventAIOrgsReposResult {
  data: PreventAIOrgReposResponse | undefined;
  isError: boolean;
  isLoading: boolean;
  refetch: () => void;
}

export function usePreventAIOrgRepos(): PreventAIOrgsReposResult {
  const organization = useOrganization();

  const {data, isLoading, isError, refetch} = useApiQuery<PreventAIOrgReposResponse>(
    [`/organizations/${organization.slug}/prevent/github/repos/`],
    {
      staleTime: 0,
      retry: false,
    }
  );

  return {
    data,
    isLoading,
    isError,
    refetch: useCallback(() => refetch(), [refetch]),
  };
}
