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

type RepositoryItem = {
  defaultBranch: string;
  latestCommitAt: string;
  name: string;
  updatedAt: string;
};

interface Repositories {
  pageInfo: {
    endCursor: string;
    hasNextPage: boolean;
  };
  results: RepositoryItem[];
  totalCount: number;
}

type QueryKey = [url: string, endpointOptions: QueryKeyEndpointOptions];

type Props = {
  term?: string;
};

export function useRepositories({term}: Props) {
  const {integratedOrg} = useCodecovContext();
  const organization = useOrganization();

  const {data, ...rest} = useInfiniteQuery<
    ApiResult<Repositories>,
    Error,
    InfiniteData<ApiResult<Repositories>>,
    QueryKey
  >({
    queryKey: [
      `/organizations/${organization.slug}/prevent/owner/${integratedOrg}/repositories/`,
      {query: {term}},
    ],
    queryFn: async ({
      queryKey: [url],
      client,
      signal,
      meta,
    }): Promise<ApiResult<Repositories>> => {
      const result = await fetchDataQuery({
        queryKey: [
          url,
          {
            query: {
              term,
            },
          },
        ],
        client,
        signal,
        meta,
      });

      return result as ApiResult<Repositories>;
    },
    getNextPageParam: ([lastPage]) => {
      return lastPage.pageInfo?.hasNextPage ? lastPage.pageInfo.endCursor : undefined;
    },
    initialPageParam: null,
  });

  const memoizedData = useMemo(
    () =>
      data?.pages.flatMap(([pageData]) =>
        pageData.results.map(({defaultBranch, latestCommitAt, name, updatedAt}) => {
          return {
            name,
            updatedAt,
            defaultBranch,
            latestCommitAt,
          };
        })
      ) ?? [],
    [data]
  );

  return {
    data: memoizedData,
    // TODO: only provide the values that we're interested in
    ...rest,
  };
}
