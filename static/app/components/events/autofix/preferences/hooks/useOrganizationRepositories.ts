import {useCallback, useEffect, useMemo, useRef} from 'react';

import type {Repository, RepositoryWithSettings} from 'sentry/types/integrations';
import useFetchSequentialPages from 'sentry/utils/api/useFetchSequentialPages';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  query?: Record<string, string>;
}

export function useOrganizationRepositories<T extends Repository = Repository>(
  {query = {}} = {} as Props
) {
  const queryRef = useRef<Record<string, string>>(query);
  useEffect(() => {
    queryRef.current = query;
  }, [query]);

  const organization = useOrganization();

  const getQueryKey = useCallback(
    ({cursor, per_page}: {cursor: string; per_page: number}): ApiQueryKey => [
      `/organizations/${organization.slug}/repos/`,
      {query: {...queryRef.current, cursor, per_page}},
    ],
    [organization.slug]
  );

  const {pages, isFetching, ...rest} = useFetchSequentialPages<T[]>({
    getQueryKey,
    perPage: 100,
    enabled: true,
  });

  const data = useMemo(() => {
    const flattenedRepos = pages.flat();
    const uniqueReposMap = new Map<string, T>();
    flattenedRepos.forEach(repo => {
      if (repo.externalId && !uniqueReposMap.has(repo.externalId)) {
        uniqueReposMap.set(repo.externalId, repo);
      }
    });
    return Array.from(uniqueReposMap.values());
  }, [pages]);

  return useMemo(
    () => ({
      ...rest,
      data,
      isFetching,
    }),
    [data, isFetching, rest]
  );
}

// TODO(ryan953): express this in typescript instead of having the extra function
export function useOrganizationRepositoriesWithSettings() {
  return useOrganizationRepositories<RepositoryWithSettings>({
    query: {expand: 'settings'},
  });
}
