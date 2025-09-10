import {useMemo} from 'react';

import type {ApiResult} from 'sentry/api';
import {usePreventContext} from 'sentry/components/prevent/context/preventContext';
import type {Sort} from 'sentry/utils/discover/fields';
import {
  fetchDataQuery,
  useInfiniteQuery,
  type InfiniteData,
  type QueryKeyEndpointOptions,
} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

const TABLE_FIELD_NAME_TO_SORT_KEY = {
  name: 'NAME',
} as const;

type SortableTokenOptions = keyof typeof TABLE_FIELD_NAME_TO_SORT_KEY;

function sortToSortKey(sort: Sort): string | undefined {
  const field = sort.field as SortableTokenOptions;

  if (field in TABLE_FIELD_NAME_TO_SORT_KEY) {
    const backendField = TABLE_FIELD_NAME_TO_SORT_KEY[field];
    const sign = sort.kind === 'desc' ? '-' : '';
    return `${sign}${backendField}`;
  }

  return undefined;
}

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
  sort,
}: {
  cursor: string | undefined;
  navigation: 'next' | 'prev' | undefined;
  sort?: Sort;
}) {
  const {integratedOrgId} = usePreventContext();
  const organization = useOrganization();

  const sortBy = sort ? sortToSortKey(sort) : undefined;

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
