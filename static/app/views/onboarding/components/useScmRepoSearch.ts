import {useMemo, useState} from 'react';

import type {IntegrationRepository, Repository} from 'sentry/types/integrations';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchDataQuery, useQuery} from 'sentry/utils/queryClient';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {useOrganization} from 'sentry/utils/useOrganization';

interface ScmRepoSearchResult {
  repos: IntegrationRepository[];
}

export function useScmRepoSearch(integrationId: string, selectedRepo?: Repository) {
  const organization = useOrganization();
  const [search, setSearch] = useState<string>();
  const debouncedSearch = useDebouncedValue(search, 200);

  const searchQuery = useQuery({
    queryKey: [
      getApiUrl(
        `/organizations/$organizationIdOrSlug/integrations/$integrationId/repos/`,
        {
          path: {
            organizationIdOrSlug: organization.slug,
            integrationId,
          },
        }
      ),
      {method: 'GET', query: {search: debouncedSearch}},
    ] as const,
    queryFn: async context => {
      return fetchDataQuery<ScmRepoSearchResult>(context);
    },
    retry: 0,
    staleTime: 20_000,
    placeholderData: previousData => (debouncedSearch ? previousData : undefined),
    enabled: !!debouncedSearch,
  });

  const {reposByIdentifier, dropdownItems} = useMemo(
    () =>
      (searchQuery.data?.[0]?.repos ?? []).reduce<{
        dropdownItems: Array<{
          disabled: boolean;
          label: string;
          textValue: string;
          value: string;
        }>;
        reposByIdentifier: Map<string, IntegrationRepository>;
      }>(
        (acc, repo) => {
          acc.reposByIdentifier.set(repo.identifier, repo);
          acc.dropdownItems.push({
            value: repo.identifier,
            label: repo.name,
            textValue: repo.name,
            disabled: repo.identifier === selectedRepo?.externalSlug,
          });
          return acc;
        },
        {
          reposByIdentifier: new Map(),
          dropdownItems: [],
        }
      ),
    [searchQuery.data, selectedRepo]
  );

  return {
    reposByIdentifier,
    dropdownItems,
    isFetching: searchQuery.isFetching,
    debouncedSearch,
    setSearch,
  };
}
