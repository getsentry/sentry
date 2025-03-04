import {useEffect, useRef} from 'react';

import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {useInfiniteApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

interface ReleaseMetaBasic {
  date: string;
  version: string;
}

interface UseReleaseStatsParams {
  datetime: Parameters<typeof normalizeDateTimeParams>[0];
  environments: readonly string[];
  projects: readonly number[];

  /**
   * Max number of pages to fetch. Default is 10 pages, which should be
   * sufficient to fetch "all" releases.
   */
  maxPages?: number;
}

/**
 * This is intended to fetch "all" releases, we have a default limit of
 * 10 pages (of 1000 results) to be slightly cautious.
 */
export function useReleaseStats(
  {datetime, environments, projects, maxPages = 10}: UseReleaseStatsParams,
  queryOptions: {staleTime: number} = {staleTime: Infinity}
) {
  const organization = useOrganization();
  const currentNumberPages = useRef(0);

  const {
    isLoading,
    isFetching,
    fetchNextPage,
    hasNextPage,
    isPending,
    isError,
    error,
    data,
  } = useInfiniteApiQuery<ReleaseMetaBasic[]>({
    queryKey: [
      `/organizations/${organization.slug}/releases/stats/`,
      {
        query: {
          environment: environments,
          project: projects,
          ...normalizeDateTimeParams(datetime),
        },
      },
      // This is here to prevent a cache key conflict between normal queries and
      // "infinite" queries. Read more here: https://tkdodo.eu/blog/effective-react-query-keys#caching-data
      'load-all',
    ],
    ...queryOptions,
    enabled: currentNumberPages.current < maxPages,
  });

  useEffect(() => {
    if (!isFetching && hasNextPage && currentNumberPages.current + 1 < maxPages) {
      fetchNextPage();
      currentNumberPages.current++;
    }
  }, [isFetching, hasNextPage, fetchNextPage, maxPages]);

  return {
    isLoading,
    isPending,
    isError,
    error,
    releases: data?.pages.flatMap(([pageData]) => pageData),
  };
}
