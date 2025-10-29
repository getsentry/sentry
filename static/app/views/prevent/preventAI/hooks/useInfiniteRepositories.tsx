import {useMemo} from 'react';

import type {ApiResult} from 'sentry/api';
import type {Repository} from 'sentry/types/integrations';
import {
  fetchDataQuery,
  useInfiniteQuery,
  type InfiniteData,
  type QueryKeyEndpointOptions,
} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

type QueryKey = [url: string, endpointOptions: QueryKeyEndpointOptions];

type Props = {
  integrationId: string;
  term?: string;
};

export function useInfiniteRepositories({integrationId, term}: Props) {
  const organization = useOrganization();

  const {data, ...rest} = useInfiniteQuery<
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
          query: term || undefined,
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
      // eslint-disable-next-line no-console
      console.log('Fetching page with cursor:', pageParam);
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

      // eslint-disable-next-line no-console
      console.log('Fetched page, result length:', (result as any)[0]?.length);
      return result as ApiResult<Repository[]>;
    },
    getNextPageParam: _lastPage => {
      // The /repos/ endpoint uses Link header pagination
      const [, , responseMeta] = _lastPage;
      const linkHeader = responseMeta?.getResponseHeader('Link');
      // eslint-disable-next-line no-console
      console.log('getNextPageParam - Link header:', linkHeader);
      if (!linkHeader) {
        return undefined;
      }

      // Parse Link header for next page cursor and check if results="true"
      const nextMatch = linkHeader.match(
        /<[^>]*[?&]cursor=([^&>]+)[^>]*>;\s*rel="next";\s*results="([^"]+)"/
      );
      if (!nextMatch) {
        return undefined;
      }

      const nextCursor = nextMatch[1];
      const hasResults = nextMatch[2] === 'true';

      // eslint-disable-next-line no-console
      console.log(
        'getNextPageParam - next cursor:',
        nextCursor,
        'hasResults:',
        hasResults
      );

      // Only return cursor if there are actually results
      return hasResults ? nextCursor : undefined;
    },
    getPreviousPageParam: _lastPage => {
      // The /repos/ endpoint uses Link header pagination
      const [, , responseMeta] = _lastPage;
      const linkHeader = responseMeta?.getResponseHeader('Link');
      if (!linkHeader) {
        return undefined;
      }

      // Parse Link header for previous page cursor and check if results="true"
      const prevMatch = linkHeader.match(
        /<[^>]*[?&]cursor=([^&>]+)[^>]*>;\s*rel="previous";\s*results="([^"]+)"/
      );
      if (!prevMatch) {
        return undefined;
      }

      const prevCursor = prevMatch[1];
      const hasResults = prevMatch[2] === 'true';

      // Only return cursor if there are actually results
      return hasResults ? prevCursor : undefined;
    },
    initialPageParam: undefined,
    enabled: Boolean(integrationId),
    staleTime: 0,
  });

  const memoizedData = useMemo(() => {
    const flattened = data?.pages?.flatMap(([pageData]) => pageData) ?? [];
    // eslint-disable-next-line no-console
    console.log(
      'memoizedData - pages:',
      data?.pages?.length,
      'total repos:',
      flattened.length
    );
    return flattened;
  }, [data]);

  return {
    data: memoizedData,
    ...rest,
  };
}
