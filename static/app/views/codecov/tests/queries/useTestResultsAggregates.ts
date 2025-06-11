import {useMemo} from 'react';

import {useCodecovContext} from 'sentry/components/codecov/context/codecovContext';
import {useQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';

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

export function useTestResultsAggregates() {
  const api = useApi();
  const {integratedOrg, repository} = useCodecovContext();

  const {data, ...rest} = useQuery<
    TestResultAggregate,
    Error,
    TestResultAggregate,
    [string]
  >({
    // TODO: this query key should have branch and codecovPeriod so the request updates when these change
    queryKey: [
      `/prevent/owner/${integratedOrg}/repository/${repository}/test-results-aggregates/`,
    ],
    queryFn: async ({queryKey: [url]}): Promise<TestResultAggregate> => {
      const result = await api.requestPromise(url, {
        method: 'GET',
        // TODO: expand when query params are known
        data: {},
      });

      return result as TestResultAggregate;
    },
  });

  const memoizedData = useMemo(() => {
    return {
      ciEfficiency: {
        totalTestsRunTime: data && data.totalDuration * 1000,
        slowestTestsDuration: data && data.slowestTestsDuration * 1000,
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
