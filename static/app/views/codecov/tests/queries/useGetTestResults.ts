import {useMemo} from 'react';

import type {ApiResult} from 'sentry/api';
import {useCodecovContext} from 'sentry/components/codecov/context/codecovContext';
import {
  fetchDataQuery,
  type InfiniteData,
  type QueryKeyEndpointOptions,
  useInfiniteQuery,
} from 'sentry/utils/queryClient';

export type TestResultItem = {
  avgDuration: number;
  commitsFailed: number;
  failureRate: number;
  flakeRate: number;
  lastDuration: number;
  name: string;
  totalFailCount: number;
  totalFlakyFailCount: number;
  totalPassCount: number;
  totalSkipCount: number;
  updatedAt: string;
};

interface TestResults {
  pageInfo: {
    endCursor: string;
    hasNextPage: boolean;
  };
  results: TestResultItem[];
  totalCount: number;
}

type QueryKey = [url: string, endpointOptions: QueryKeyEndpointOptions];

export function useInfiniteTestResults() {
  const {integratedOrg, repository} = useCodecovContext();

  const {data, ...rest} = useInfiniteQuery<
    ApiResult<TestResults>,
    Error,
    InfiniteData<ApiResult<TestResults>>,
    QueryKey
  >({
    // TODO: this query key should have branch and codecovPeriod so the request updates when these change
    queryKey: [
      `/prevent/owner/${integratedOrg}/repository/${repository}/test-results/`,
      {},
    ],
    queryFn: async ({
      queryKey: [url, endpointOptions],
      client,
      signal,
      meta,
    }): Promise<ApiResult<TestResults>> => {
      // console.log('asdfasdf', client, signal, meta);
      const result = await fetchDataQuery({
        queryKey: [
          url,
          {
            ...endpointOptions,
            // TODO: expand when query params are known
            query: {},
          },
        ],
        client,
        signal,
        meta,
      });

      return result as ApiResult<TestResults>;
    },
    getNextPageParam: ([lastPage]) => {
      return lastPage.pageInfo?.hasNextPage ? lastPage.pageInfo.endCursor : undefined;
    },
    initialPageParam: null,
  });

  const memoizedData = useMemo(
    () =>
      data?.pages.flatMap(([pageData]) =>
        pageData.results.map(
          ({
            name,
            avgDuration,
            updatedAt,
            totalFailCount,
            totalPassCount,
            totalFlakyFailCount,
            totalSkipCount,
            ...other
          }) => {
            const isBrokenTest =
              totalFailCount === totalPassCount + totalFlakyFailCount + totalSkipCount;
            return {
              ...other,
              testName: name,
              averageDurationMs: avgDuration,
              lastRun: updatedAt,
              isBrokenTest,
            };
          }
        )
      ) ?? [],
    [data]
  );

  return {
    data: memoizedData,
    ...rest,
  };
}
