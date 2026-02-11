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

type QueryKey = [
  url: ReturnType<typeof getApiUrl>,
  endpointOptions: QueryKeyEndpointOptions,
];

type Sort = {
  direction: 'asc' | 'desc';
  field: 'name';
};

function sortToSortBy(sort?: Sort): string | undefined {
  if (!sort) return undefined;

  if (sort.field === 'name') {
    return sort.direction === 'desc' ? '-NAME' : 'NAME';
  }

  return undefined;
}

export function useInfiniteRepositoryTokens({
  cursor,
  navigation,
  sort,
}: {
  cursor: string | undefined;
  navigation: 'next' | 'prev' | undefined;
  sort?: Sort;
}) {
  const {integratedOrgId} = usePreventContext();
  const organization = useOrganization();

  const sortBy = sortToSortBy(sort);

  const {data, ...rest} = useInfiniteQuery<
    ApiResult<RepositoryTokens>,
    Error,
    InfiniteData<ApiResult<RepositoryTokens>>,
    QueryKey
  >({
    queryKey: [
      getApiUrl(
        '/organizations/$organizationIdOrSlug/prevent/owner/$owner/repositories/tokens/',
        {
          path: {organizationIdOrSlug: organization.slug, owner: integratedOrgId!},
        }
      ),
      {
        query: {
          cursor: cursor ?? undefined,
          navigation: navigation ?? undefined,
          sortBy: sortBy ?? undefined,
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
              ...(sortBy ? {sortBy} : {}),
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
