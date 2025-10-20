import {useMemo} from 'react';

import type {PreventAIOrg} from 'sentry/types/prevent';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

export interface PreventAIOrgReposApiResponse {
  orgRepos: Array<{
    githubOrganizationId: number;
    name: string;
    provider: 'github';
    repos: Array<{
      fullName: string;
      id: string;
      name: string;
    }>;
  }>;
}

export interface PreventAIOrgReposResponse {
  orgRepos: PreventAIOrg[];
}

interface PreventAIOrgsReposResult {
  data: PreventAIOrgReposResponse | undefined;
  isError: boolean;
  isPending: boolean;
  refetch: () => void;
}

function transformApiResponse(
  apiResponse: PreventAIOrgReposApiResponse | undefined
): PreventAIOrgReposResponse | undefined {
  if (!apiResponse) {
    return undefined;
  }

  return {
    orgRepos: apiResponse.orgRepos.map(org => ({
      ...org,
      githubOrganizationId: String(org.githubOrganizationId),
    })),
  };
}

export function usePreventAIOrgRepos(): PreventAIOrgsReposResult {
  const organization = useOrganization();

  const {
    data: rawData,
    isPending,
    isError,
    refetch,
  } = useApiQuery<PreventAIOrgReposApiResponse>(
    [`/organizations/${organization.slug}/prevent/github/repos/`],
    {
      staleTime: 0,
      retry: false,
    }
  );

  const data = useMemo(() => transformApiResponse(rawData), [rawData]);

  return {
    data,
    isPending,
    isError,
    refetch,
  };
}
