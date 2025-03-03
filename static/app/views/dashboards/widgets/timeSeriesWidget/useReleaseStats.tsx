import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import type {PageFilters} from 'sentry/types/core';
import {useInfiniteApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

interface ReleaseMetaBasic {
  date: string;
  version: string;
}

interface ReleaseConditions extends PageFilters {
  query?: string;
}

/**
 * Fetches *ALL* releases (e.g. all pages worth)
 */
export function useReleaseStats({
  datetime,
  environments,
  projects,
  query,
}: ReleaseConditions) {
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
          query,
          cursor: undefined,
          ...normalizeDateTimeParams(datetime),
        },
      },
    ],
  });

  if (!isFetching && hasNextPage) {
    fetchNextPage();
  }

  const releases =
    data?.pages.flatMap(([pageData]) =>
      pageData.map(({date, version}) => ({timestamp: date, version}))
    ) ?? [];

  return {
    isLoading,
    isPending,
    isError,
    error,
    releases,
  };
}
