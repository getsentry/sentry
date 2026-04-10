import {useCallback, useEffect, useMemo, useRef} from 'react';

import type {Repository} from 'sentry/types/integrations';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useFetchSequentialPages} from 'sentry/utils/api/useFetchSequentialPages';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';

interface Props {
  query?: Record<string, string>;
}

/**
 * @deprecated Use organizationRepositoriesInfiniteOptions instead.
 */
export function useOrganizationRepositories({query = {}} = {} as Props) {
  const queryRef = useRef<Record<string, string>>(query);
  useEffect(() => {
    queryRef.current = query;
  }, [query]);

  const organization = useOrganization();

  const getQueryKey = useCallback(
    ({cursor, per_page}: {cursor: string; per_page: number}): ApiQueryKey => [
      getApiUrl('/organizations/$organizationIdOrSlug/repos/', {
        path: {
          organizationIdOrSlug: organization.slug,
        },
      }),
      {query: {...queryRef.current, cursor, per_page}},
    ],
    [organization.slug]
  );

  const {pages, isFetching, ...rest} = useFetchSequentialPages<Repository[]>({
    getQueryKey,
    perPage: 100,
    enabled: true,
  });

  const data = useMemo(() => {
    const flattenedRepos = pages.flat();
    const uniqueReposMap = new Map<string, Repository>();
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
