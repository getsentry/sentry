import type {PreventAIOrg} from 'sentry/types/prevent';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

export interface PreventAIOrgReposResponse {
  orgRepos: PreventAIOrg[];
}

interface PreventAIOrgsReposResult {
  data: PreventAIOrgReposResponse | undefined;
  isError: boolean;
  isPending: boolean;
  refetch: () => void;
}

export function usePreventAIOrgRepos(): PreventAIOrgsReposResult {
  const organization = useOrganization();

  const {data, isPending, isError, refetch} = useApiQuery<PreventAIOrgReposResponse>(
    [`/organizations/${organization.slug}/prevent/github/repos/`],
    {
      staleTime: 0,
      retry: false,
    }
  );

  return {
    data,
    isPending,
    isError,
    refetch,
  };
}
