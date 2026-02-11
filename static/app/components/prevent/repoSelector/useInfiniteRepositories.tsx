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
    hasPreviousPage: boolean;
    startCursor: string;
  };
  results: RepositoryItem[];
  totalCount: number;
}

type QueryKey = [
  url: ReturnType<typeof getApiUrl>,
  endpointOptions: QueryKeyEndpointOptions,
];

type Props = {
  term?: string;
};

export function useInfiniteRepositories({term}: Props) {
  const {integratedOrgId} = usePreventContext();
  const organization = useOrganization();

  const {data, ...rest} = useInfiniteQuery<
    ApiResult<Repositories>,
    Error,
    InfiniteData<ApiResult<Repositories>>,
    QueryKey
  >({
    queryKey: [
      getApiUrl(
        '/organizations/$organizationIdOrSlug/prevent/owner/$owner/repositories/',
        {
          path: {
            organizationIdOrSlug: organization.slug,
            owner: integratedOrgId!,
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
    }): Promise<ApiResult<Repositories>> => {
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

      return result as ApiResult<Repositories>;
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
