import {useMemo} from 'react';

import {useCodecovContext} from 'sentry/components/codecov/context/codecovContext';
import {useQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';

type TestResultAggregate = {
  slowestTestsDuration: number;
  slowestTestsDurationPercentChange: number;
  totalDuration: number;
  totalDurationPercentChange: number;
  totalFails: number;
  totalFailsPercentChange: number;
  totalSkips: number;
  totalSkipsPercentChange: number;
  totalSlowTests: number;
  totalSlowTestsPercentChange: number;
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
      totalTestsRunTime: (data?.totalDuration ?? 0) * 1000,
      slowestTestsDuration: (data?.slowestTestsDuration ?? 0) * 1000,
      slowestTests: data?.totalSlowTests ?? 0,
      totalTestsRunTimeChange: data?.totalDurationPercentChange || null,
    };
  }, [data]);

  return {
    data: memoizedData,
    // TODO: only provide the values that we're interested in
    ...rest,
  };
}
