import {useEffect} from 'react';

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
    ],
    ...queryOptions,
  });

  const currentNumberPages = data?.pages.length ?? 0;

  useEffect(() => {
    if (!isFetching && hasNextPage && currentNumberPages + 1 < maxPages) {
      fetchNextPage();
    }
  }, [isFetching, hasNextPage, fetchNextPage, maxPages, currentNumberPages]);

  return {
    isLoading,
    isPending,
    isError,
    error,
    releases: data?.pages.flatMap(([pageData]) => pageData),
  };
}
