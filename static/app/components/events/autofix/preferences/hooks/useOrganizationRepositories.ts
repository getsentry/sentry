import {useCallback, useMemo} from 'react';

import type {Repository, RepositoryWithSettings} from 'sentry/types/integrations';
import useFetchSequentialPages from 'sentry/utils/api/useFetchSequentialPages';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

export function useOrganizationRepositoriesWithSettings() {
  return useOrganizationRepositories<RepositoryWithSettings>({expand: 'settings'});
}

/**
 * Warning this will fetch *all* pages of repositories
 */
export function useOrganizationRepositories<T extends Repository>({
  expand,
}: {expand?: 'settings'} = {}) {
  const organization = useOrganization();

  const getQueryKey = useCallback(
    ({cursor, per_page}: {cursor: string; per_page: number}): ApiQueryKey => [
      `/organizations/${organization.slug}/repos/`,
      {query: {cursor, per_page, expand}},
    ],
    [organization.slug, expand]
  );

  const {pages, isFetching} = useFetchSequentialPages<T[]>({
    getQueryKey,
    perPage: 100,
    enabled: true,
  });

  return {
    data: useMemo(() => {
      const flattenedRepos = pages.flat();
      const uniqueReposMap = new Map<string, T>();
      flattenedRepos.forEach(repo => {
        if (repo.externalId && !uniqueReposMap.has(repo.externalId)) {
          uniqueReposMap.set(repo.externalId, repo);
        }
      });
      return Array.from(uniqueReposMap.values());
    }, [pages]),
    isFetching,
  };
}
