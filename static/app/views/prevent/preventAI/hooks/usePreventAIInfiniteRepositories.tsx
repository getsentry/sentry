import type {ApiResult} from 'sentry/api';
import type {Repository} from 'sentry/types/integrations';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';
import {
  fetchDataQuery,
  useInfiniteQuery,
  type InfiniteData,
  type QueryKeyEndpointOptions,
} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

type QueryKey = [url: string, endpointOptions: QueryKeyEndpointOptions];

type UseInfiniteRepositoriesOptions = {
  integrationId: string;
  searchTerm?: string;
};

function removeReposWithNullExternalId(
  result: ApiResult<Repository[]>
): ApiResult<Repository[]> {
  // result is [data, status, responseMeta]; data is Repository[]
  if (Array.isArray(result) && Array.isArray(result[0])) {
    return [
      result[0].filter(repo => repo && repo.externalId !== null),
      result[1],
      result[2],
    ];
  }
  return result;
}

export function useInfiniteRepositories({
  integrationId,
  searchTerm,
}: UseInfiniteRepositoriesOptions) {
  const organization = useOrganization();

  return useInfiniteQuery<
    ApiResult<Repository[]>,
    Error,
    InfiniteData<ApiResult<Repository[]>>,
    QueryKey
  >({
    queryKey: [
      `/organizations/${organization.slug}/repos/`,
      {
        query: {
          integration_id: integrationId || undefined,
          status: 'active',
          query: searchTerm || undefined,
        },
      },
    ],
    queryFn: async ({
      queryKey: [url, {query}],
      pageParam,
      client,
      signal,
      meta,
    }): Promise<ApiResult<Repository[]>> => {
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
      return removeReposWithNullExternalId(result as ApiResult<Repository[]>);
    },
    getNextPageParam: _lastPage => {
      const [, , responseMeta] = _lastPage;
      const linkHeader = responseMeta?.getResponseHeader('Link') ?? null;
      const links = parseLinkHeader(linkHeader);
      return links.next?.results ? links.next.cursor : undefined;
    },
    getPreviousPageParam: _lastPage => {
      const [, , responseMeta] = _lastPage;
      const linkHeader = responseMeta?.getResponseHeader('Link') ?? null;
      const links = parseLinkHeader(linkHeader);
      return links.previous?.results ? links.previous.cursor : undefined;
    },
    initialPageParam: undefined,
    enabled: Boolean(integrationId),
    staleTime: 0,
  });
}
