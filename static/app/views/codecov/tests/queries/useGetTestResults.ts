import {useMemo} from 'react';
import {useSearchParams} from 'react-router-dom';

import type {ApiResult} from 'sentry/api';
import {useCodecovContext} from 'sentry/components/codecov/context/codecovContext';
import {
  fetchDataQuery,
  type InfiniteData,
  type QueryKeyEndpointOptions,
  useInfiniteQuery,
} from 'sentry/utils/queryClient';
import type {
  SummaryFilterKey,
  SummaryTAFilterKey,
} from 'sentry/views/codecov/tests/config';
import {
  DATE_TO_QUERY_INTERVAL,
  SUMMARY_TO_TA_TABLE_FILTER_KEY,
  TABLE_FIELD_NAME_TO_SORT_KEY,
} from 'sentry/views/codecov/tests/config';
import type {SortableTAOptions} from 'sentry/views/codecov/tests/testAnalyticsTable/testAnalyticsTable';

/**
 * This function will take the column value and adjust it to the
 * value the backend expects to sort on.
 *
 * @param value the column that was selected for sorting
 *
 * @returns a key the backend expects to sort by
 */
function sortValueToSortKey(value: string) {
  const word = value.replace(/^[+-]/, '') as SortableTAOptions;
  const sign = value[0] === '-' ? '-' : '';
  return `${sign}${TABLE_FIELD_NAME_TO_SORT_KEY[word]}`;
}

type TestResultItem = {
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
  const {integratedOrg, repository, branch, codecovPeriod} = useCodecovContext();
  const [searchParams] = useSearchParams();

  const sortBy = searchParams.get('sort') || '-commitsFailed';
  const signedSortBy = sortValueToSortKey(sortBy);

  const filterBy = searchParams.get('filterBy') as SummaryFilterKey;
  let mappedFilterBy = null;
  if (filterBy in SUMMARY_TO_TA_TABLE_FILTER_KEY) {
    mappedFilterBy = SUMMARY_TO_TA_TABLE_FILTER_KEY[filterBy as SummaryTAFilterKey];
  }

  const {data, ...rest} = useInfiniteQuery<
    ApiResult<TestResults>,
    Error,
    InfiniteData<ApiResult<TestResults>>,
    QueryKey
  >({
    queryKey: [
      `/prevent/owner/${integratedOrg}/repository/${repository}/test-results/`,
      {query: {branch, codecovPeriod, signedSortBy, mappedFilterBy}},
    ],
    queryFn: async ({
      queryKey: [url],
      client,
      signal,
      meta,
    }): Promise<ApiResult<TestResults>> => {
      const result = await fetchDataQuery({
        queryKey: [
          url,
          {
            query: {
              interval:
                DATE_TO_QUERY_INTERVAL[
                  codecovPeriod as keyof typeof DATE_TO_QUERY_INTERVAL
                ],
              sortBy: signedSortBy,
              branch,
              ...(mappedFilterBy ? {filterBy: mappedFilterBy} : {}),
            },
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
            flakeRate,
            ...other
          }) => {
            const isBrokenTest =
              totalFailCount === totalPassCount + totalFlakyFailCount + totalSkipCount;
            return {
              ...other,
              testName: name,
              averageDurationMs: avgDuration * 1000,
              lastRun: updatedAt,
              flakeRate: flakeRate * 100,
              isBrokenTest,
            };
          }
        )
      ) ?? [],
    [data]
  );

  return {
    data: memoizedData,
    // TODO: only provide the values that we're interested in
    ...rest,
  };
}
