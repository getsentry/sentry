import {useMemo} from 'react';

import type {ApiResult} from 'sentry/api';
import {usePreventContext} from 'sentry/components/prevent/context/preventContext';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {
  fetchDataQuery,
  useInfiniteQuery,
  type InfiniteData,
  type QueryKeyEndpointOptions,
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

type QueryKey = [
  url: ReturnType<typeof getApiUrl>,
  endpointOptions: QueryKeyEndpointOptions,
];

type Props = {
  term?: string;
};

export function useInfiniteRepositoryBranches({term}: Props) {
  const {integratedOrgId, repository} = usePreventContext();
  const organization = useOrganization();

  const {data, ...rest} = useInfiniteQuery<
    ApiResult<RepositoryBranches>,
    Error,
    InfiniteData<ApiResult<RepositoryBranches>>,
    QueryKey
  >({
    queryKey: [
      getApiUrl(
        '/organizations/$organizationIdOrSlug/prevent/owner/$owner/repository/$repository/branches/',
        {
          path: {
            organizationIdOrSlug: organization.slug,
            owner: integratedOrgId!,
            repository: repository!,
          },
        }
      ),
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
    getNextPageParam: ([pageData]) => {
      return pageData.pageInfo?.hasNextPage ? pageData.pageInfo.endCursor : undefined;
    },
    getPreviousPageParam: ([pageData]) => {
      return pageData.pageInfo?.hasPreviousPage
        ? pageData.pageInfo.startCursor
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
