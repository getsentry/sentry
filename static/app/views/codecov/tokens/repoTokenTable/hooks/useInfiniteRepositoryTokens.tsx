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

type RepositoryTokenItem = {
  name: string;
  token: string;
};

interface RepositoryTokens {
  pageInfo: {
    endCursor: string;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string;
  };
  results: RepositoryTokenItem[];
  totalCount: number;
}

type QueryKey = [url: string, endpointOptions: QueryKeyEndpointOptions];

export function useInfiniteRepositoryTokens({
  cursor,
  navigation,
}: {
  cursor: string | undefined;
  navigation: 'next' | 'prev' | undefined;
}) {
  const {integratedOrgId} = useCodecovContext();
  const organization = useOrganization();

  const {data, ...rest} = useInfiniteQuery<
    ApiResult<RepositoryTokens>,
    Error,
    InfiniteData<ApiResult<RepositoryTokens>>,
    QueryKey
  >({
    queryKey: [
      `/organizations/${organization.slug}/prevent/owner/${integratedOrgId}/repositories/tokens/`,
      {
        query: {
          cursor: cursor ?? undefined,
          navigation: navigation ?? undefined,
        },
      },
    ],
    queryFn: async ({
      queryKey: [url, {query}],
      client,
      signal,
      meta,
    }): Promise<ApiResult<RepositoryTokens>> => {
      const result = await fetchDataQuery({
        queryKey: [
          url,
          {
            query: {
              ...query,
              ...(cursor ? {cursor} : {}),
              ...(navigation ? {navigation} : {}),
            },
          },
        ],
        client,
        signal,
        meta,
      });

      return result as ApiResult<RepositoryTokens>;
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
    enabled: Boolean(integratedOrgId),
  });

  const memoizedData = useMemo(
    () =>
      data?.pages?.flatMap(([pageData]) =>
        pageData.results.map(({name, token}) => {
          return {
            name,
            token,
          };
        })
      ) ?? [],
    [data]
  );

  return {
    data: memoizedData,
    totalCount: data?.pages?.[0]?.[0]?.totalCount ?? 0,
    startCursor: data?.pages?.[0]?.[0]?.pageInfo?.startCursor,
    endCursor: data?.pages?.[0]?.[0]?.pageInfo?.endCursor,
    // TODO: only provide the values that we're interested in
    ...rest,
  };
}
