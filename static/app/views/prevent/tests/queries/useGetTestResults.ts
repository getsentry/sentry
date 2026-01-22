import {useMemo} from 'react';
import {useSearchParams} from 'react-router-dom';

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
import type {
  SummaryFilterKey,
  SummaryTAFilterKey,
} from 'sentry/views/prevent/tests/config';
import {
  DATE_TO_QUERY_INTERVAL,
  SUMMARY_TO_TA_TABLE_FILTER_KEY,
  TABLE_FIELD_NAME_TO_SORT_KEY,
} from 'sentry/views/prevent/tests/config';
import type {SortableTAOptions} from 'sentry/views/prevent/tests/testAnalyticsTable/testAnalyticsTable';

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
  defaultBranch: string;
  pageInfo: {
    endCursor: string;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string;
  };
  results: TestResultItem[];
  totalCount: number;
}

type QueryKey = [
  url: ReturnType<typeof getApiUrl>,
  endpointOptions: QueryKeyEndpointOptions,
];

export function useInfiniteTestResults({
  cursor,
  navigation,
}: {
  cursor?: string | null;
  navigation?: 'next' | 'prev';
}) {
  const {
    integratedOrgId,
    repository,
    branch: rawBranch,
    preventPeriod,
  } = usePreventContext();
  const organization = useOrganization();
  const [searchParams] = useSearchParams();

  // Normalize branch to undefined when falsy for consistent caching
  const branch = rawBranch || undefined;

  const sortBy = searchParams.get('sort') || '-totalFailCount';
  const signedSortBy = sortValueToSortKey(sortBy);

  const term = searchParams.get('term') || '';
  const testSuites = searchParams.has('testSuites')
    ? searchParams.getAll('testSuites')
    : null;

  const filterBy = searchParams.get('filterBy') as SummaryFilterKey;
  let mappedFilterBy = null;
  if (filterBy in SUMMARY_TO_TA_TABLE_FILTER_KEY) {
    mappedFilterBy = SUMMARY_TO_TA_TABLE_FILTER_KEY[filterBy as SummaryTAFilterKey];
  }

  const {data, hasNextPage, hasPreviousPage, ...rest} = useInfiniteQuery<
    ApiResult<TestResults>,
    Error,
    InfiniteData<ApiResult<TestResults>>,
    QueryKey
  >({
    queryKey: [
      getApiUrl(
        '/organizations/$organizationIdOrSlug/prevent/owner/$owner/repository/$repository/test-results/',
        {
          path: {
            organizationIdOrSlug: organization.slug,
            owner: integratedOrgId!,
            repository: repository!,
          },
        }
      ),
      {
        query: {
          branch,
          preventPeriod,
          signedSortBy,
          mappedFilterBy,
          term,
          cursor,
          navigation,
          testSuites,
        },
      },
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
                  preventPeriod as keyof typeof DATE_TO_QUERY_INTERVAL
                ],
              sortBy: signedSortBy,
              term,
              branch,
              ...(mappedFilterBy ? {filterBy: mappedFilterBy} : {}),
              ...(testSuites ? {testSuites} : {}),
              ...(cursor ? {cursor} : {}),
              ...(navigation ? {navigation} : {}),
            },
          },
        ],
        client,
        signal,
        meta,
      });

      return result as ApiResult<TestResults>;
    },
    getNextPageParam: ([pageData]) => {
      return pageData.pageInfo?.hasNextPage ? pageData.pageInfo.endCursor : undefined;
    },
    getPreviousPageParam: ([pageData]) => {
      return pageData.pageInfo?.hasPreviousPage
        ? pageData.pageInfo.startCursor
        : undefined;
    },
    initialPageParam: null,
    enabled: !!(integratedOrgId && repository && preventPeriod),
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
              totalPassCount,
              totalFailCount,
              totalSkipCount,
              totalFlakyFailCount,
            };
          }
        )
      ) ?? [],
    [data]
  );

  return {
    data: {
      testResults: memoizedData,
      defaultBranch: data?.pages?.[0]?.[0]?.defaultBranch,
    },
    totalCount: data?.pages?.[0]?.[0]?.totalCount ?? 0,
    startCursor: data?.pages?.[0]?.[0]?.pageInfo?.startCursor,
    endCursor: data?.pages?.[0]?.[0]?.pageInfo?.endCursor,
    hasNextPage,
    hasPreviousPage,
    // TODO: only provide the values that we're interested in
    ...rest,
  };
}

export type UseInfiniteTestResultsResult = ReturnType<typeof useInfiniteTestResults>;
