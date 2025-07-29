import {useMemo} from 'react';

import {useCodecovContext} from 'sentry/components/codecov/context/codecovContext';
import type {QueryKeyEndpointOptions} from 'sentry/utils/queryClient';
import {useQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

type TestSuite = {
  testSuites: string[];
};

type QueryKey = [url: string, endpointOptions: QueryKeyEndpointOptions];

export function useTestSuites() {
  const api = useApi();
  const organization = useOrganization();
  const {integratedOrgId, repository} = useCodecovContext();

  const {data, ...rest} = useQuery<TestSuite, Error, TestSuite, QueryKey>({
    queryKey: [
      `/organizations/${organization.slug}/prevent/owner/${integratedOrgId}/repository/${repository}/test-suites/`,
      {query: {}},
    ],
    queryFn: async ({queryKey: [url]}): Promise<TestSuite> => {
      const result = await api.requestPromise(url, {
        method: 'GET',
        query: {},
      });

      return result as TestSuite;
    },
    enabled: !!(integratedOrgId && repository),
  });

  const memoizedData = useMemo(() => {
    return data?.testSuites || [];
  }, [data]);

  return {
    data: memoizedData,
    // TODO: only provide the values that we're interested in
    ...rest,
  };
}
