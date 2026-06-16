import {useMemo} from 'react';
import {useQuery} from '@tanstack/react-query';

import type {IntegrationRepository, Repository} from 'sentry/types/integrations';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';

interface ScmReposResult {
  repos: IntegrationRepository[];
}

export function useScmRepos(integrationId: string, selectedRepo?: Repository) {
  const organization = useOrganization();

  const reposQuery = useQuery(
    apiOptions.as<ScmReposResult>()(
      '/organizations/$organizationIdOrSlug/integrations/$integrationId/repos/',
      {
        path: {organizationIdOrSlug: organization.slug, integrationId},
        staleTime: 60_000,
      }
    )
  );

  const selectedRepoSlug = selectedRepo?.externalSlug;

  const {reposByIdentifier, dropdownItems} = useMemo(
    () =>
      (reposQuery.data?.repos ?? []).reduce<{
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
