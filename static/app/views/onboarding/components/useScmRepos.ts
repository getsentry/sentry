import {useMemo} from 'react';

import type {IntegrationRepository, Repository} from 'sentry/types/integrations';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchDataQuery, useQuery} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';

interface ScmReposResult {
  repos: IntegrationRepository[];
}

export function useScmRepos(integrationId: string, selectedRepo?: Repository) {
  const organization = useOrganization();

  const reposQuery = useQuery({
    queryKey: [
      getApiUrl(
        '/organizations/$organizationIdOrSlug/integrations/$integrationId/repos/',
        {
          path: {
            organizationIdOrSlug: organization.slug,
            integrationId,
          },
        }
      ),
      {method: 'GET'},
    ] as const,
    queryFn: async context => {
      return fetchDataQuery<ScmReposResult>(context);
    },
    retry: 0,
    staleTime: 20_000,
  });

  const selectedRepoSlug = selectedRepo?.externalSlug;

  const {reposByIdentifier, dropdownItems} = useMemo(
    () =>
      (reposQuery.data?.[0]?.repos ?? []).reduce<{
        dropdownItems: Array<{
          disabled: boolean;
          label: string;
          value: string;
        }>;
        reposByIdentifier: Map<string, IntegrationRepository>;
      }>(
        (acc, repo) => {
          acc.reposByIdentifier.set(repo.identifier, repo);
          acc.dropdownItems.push({
            value: repo.identifier,
            label: repo.name,
            disabled: repo.identifier === selectedRepoSlug,
          });
          return acc;
        },
        {
          reposByIdentifier: new Map(),
          dropdownItems: [],
        }
      ),
    [reposQuery.data, selectedRepoSlug]
  );

  return {
    reposByIdentifier,
    dropdownItems,
    isFetching: reposQuery.isFetching,
    isError: reposQuery.isError,
  };
}
