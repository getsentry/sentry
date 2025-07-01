import {useMemo} from 'react';

import {useCodecovContext} from 'sentry/components/codecov/context/codecovContext';
import type {QueryKeyEndpointOptions} from 'sentry/utils/queryClient';
import {useQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import {DATE_TO_QUERY_INTERVAL} from 'sentry/views/codecov/tests/config';

type TestResultAggregate = {
  flakeCount: number;
  flakeCountPercentChange: number | null;
  flakeRate: number;
  flakeRatePercentChange: number | null;
  slowestTestsDuration: number;
  slowestTestsDurationPercentChange: number | null;
  totalDuration: number;
  totalDurationPercentChange: number | null;
  totalFails: number;
  totalFailsPercentChange: number | null;
  totalSkips: number;
  totalSkipsPercentChange: number | null;
  totalSlowTests: number;
  totalSlowTestsPercentChange: number | null;
};

type QueryKey = [url: string, endpointOptions: QueryKeyEndpointOptions];

export function useTestResultsAggregates() {
  const api = useApi();
  const {integratedOrg, repository, codecovPeriod} = useCodecovContext();

  const {data, ...rest} = useQuery<
    TestResultAggregate,
    Error,
    TestResultAggregate,
    QueryKey
  >({
    queryKey: [
      `/prevent/owner/${integratedOrg}/repository/${repository}/test-results-aggregates/`,
      {query: {codecovPeriod}},
    ],
    queryFn: async ({queryKey: [url]}): Promise<TestResultAggregate> => {
      const result = await api.requestPromise(url, {
        method: 'GET',
        query: {
          interval:
            DATE_TO_QUERY_INTERVAL[codecovPeriod as keyof typeof DATE_TO_QUERY_INTERVAL],
        },
      });

      return result as TestResultAggregate;
    },
  });

  const memoizedData = useMemo(() => {
    return {
      ciEfficiency: {
        totalTestsRunTime: data && data?.totalDuration * 1000,
        slowestTestsDuration: data && data?.slowestTestsDuration * 1000,
        slowestTests: data?.totalSlowTests,
        totalTestsRunTimeChange: data?.totalDurationPercentChange,
      },
      testPerformance: {
        flakyTests: data?.flakeCount,
        flakyTestsChange: data?.flakeCountPercentChange,
        averageFlakeRate: data?.flakeRate,
        averageFlakeRateChange: data?.flakeRatePercentChange,
        cumulativeFailures: data?.totalFails,
        cumulativeFailuresChange: data?.totalFailsPercentChange,
        skippedTests: data?.totalSkips,
        skippedTestsChange: data?.totalSkipsPercentChange,
      },
    };
  }, [data]);

  return {
    data: memoizedData,
    // TODO: only provide the values that we're interested in
    ...rest,
  };
}
