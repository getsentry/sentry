import {useMemo} from 'react';

import type {ApiResult} from 'sentry/api';
import {useCodecovContext} from 'sentry/components/codecov/context/codecovContext';
import {
  fetchDataQuery,
  type InfiniteData,
  type QueryKeyEndpointOptions,
  useInfiniteQuery,
} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

type RepositoryBranchItem = {
  name: string;
};

interface RepositoryBranches {
  defaultBranch: string;
  pageInfo: {
    endCursor: string;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string;
  };
  results: RepositoryBranchItem[];
  totalCount: number;
}

type QueryKey = [url: string, endpointOptions: QueryKeyEndpointOptions];

type Props = {
  term?: string;
};

export function useInfiniteRepositoryBranches({term}: Props) {
  const {integratedOrgId, repository} = useCodecovContext();
  const organization = useOrganization();

  const {data, ...rest} = useInfiniteQuery<
    ApiResult<RepositoryBranches>,
    Error,
    InfiniteData<ApiResult<RepositoryBranches>>,
    QueryKey
  >({
    queryKey: [
      `/organizations/${organization.slug}/prevent/owner/${integratedOrgId}/repository/${repository}/branches/`,
      {query: {term}},
    ],
    queryFn: async ({
      queryKey: [url, {query}],
      pageParam,
      client,
      signal,
      meta,
    }): Promise<ApiResult<RepositoryBranches>> => {
      const result = await fetchDataQuery({
        queryKey: [
          url,
          {
            query: {
              ...query,
              cursor: pageParam ?? undefined,
            },
          },
        ],
        client,
        signal,
        meta,
      });

      return result as ApiResult<RepositoryBranches>;
    },
    getNextPageParam: ([lastPage]) => {
      return lastPage.pageInfo?.hasNextPage ? lastPage.pageInfo.endCursor : undefined;
    },
    getPreviousPageParam: ([firstPage]) => {
      return firstPage.pageInfo?.hasPreviousPage
        ? firstPage.pageInfo.startCursor
        : undefined;
    },
    initialPageParam: undefined,
    enabled: !!(integratedOrgId && repository),
  });

  const memoizedData = useMemo(
    () =>
      data?.pages?.flatMap(([pageData]) =>
        pageData.results.map(({name}) => {
          return {
            name,
          };
        })
      ) ?? [],
    [data]
  );

  return {
    data: {
      branches: memoizedData,
      defaultBranch: data?.pages?.[0]?.[0]?.defaultBranch,
    },
    // TODO: only provide the values that we're interested in
    ...rest,
  };
}
