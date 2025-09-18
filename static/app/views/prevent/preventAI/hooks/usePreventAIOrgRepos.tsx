// import {useApiQuery} from 'sentry/utils/queryClient';
// import useOrganization from 'sentry/utils/useOrganization';

import type {IntegrationOrg} from 'sentry/views/prevent/preventAI/types';

export interface PreventAIIntegrationOrgsResponse {
  orgRepos: IntegrationOrg[];
}

export interface PreventAIIntegrationOrgsReposResult {
  data: PreventAIIntegrationOrgsResponse | undefined;
  isError: boolean;
  isLoading: boolean;
  refetch: () => void;
}

export function usePreventAIOrgRepos(): PreventAIIntegrationOrgsReposResult {
  // TODO: Hook up to real API
  // const organization = useOrganization();
  // const {data, isLoading, isError, refetch} = useApiQuery<PreventAIIntegrationOrgsResponse>(
  //   [`/organizations/${organization.slug}/prevent-ai/${provider}/orgs/`],
  //   {staleTime: 30000}
  // );

  return {
    data: {
      orgRepos: [
        {
          id: '1',
          name: 'org-1',
          provider: 'github',
          repos: [
            {
              id: '1',
              name: 'repo-1',
              fullName: 'org-1/repo-1',
              url: 'https://github.com/org-1/repo-1',
            },
          ],
        },
        {
          id: '2',
          name: 'org-2',
          provider: 'github',
          repos: [
            {
              id: '2',
              name: 'repo-2',
              fullName: 'org-2/repo-2',
              url: 'https://github.com/org-2/repo-2',
            },
            {
              id: '3',
              name: 'repo-3',
              fullName: 'org-2/repo-3',
              url: 'https://github.com/org-2/repo-3',
            },
          ],
        },
      ],
    },
    isLoading: false,
    isError: false,
    refetch: () => {},
  };
}
