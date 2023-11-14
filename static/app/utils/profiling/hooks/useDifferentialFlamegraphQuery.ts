import {useMemo} from 'react';
import {UseQueryResult} from '@tanstack/react-query';

import {RELATIVE_DAYS_WINDOW} from 'sentry/components/events/eventStatisticalDetector/consts';
import {useRelativeDateTime} from 'sentry/utils/profiling/hooks/useRelativeDateTime';
import RequestError from 'sentry/utils/requestError/requestError';

import {
  AggregateFlamegraphQueryParameters,
  useAggregateFlamegraphQuery,
} from './useAggregateFlamegraphQuery';

interface DifferentialFlamegraphQueryParameters {
  breakpoint: number;
  environments: AggregateFlamegraphQueryParameters['environments'];
  projectID: number;
  transaction: string;
}

export function useDifferentialFlamegraphQuery(
  params: DifferentialFlamegraphQueryParameters
): {
  after: UseQueryResult<Profiling.Schema, RequestError>;
  before: UseQueryResult<Profiling.Schema, RequestError>;
} {
  const sharedAggregateQueryParams: AggregateFlamegraphQueryParameters = useMemo(() => {
    return {
      transaction: params.transaction,
      environments: params.environments,
      projects: isNaN(params.projectID) ? [] : [params.projectID],
      datetime: {},
    };
  }, [params.transaction, params.environments, params.projectID]);

  const regressionDateRange = useRelativeDateTime({
    anchor: params.breakpoint,
    relativeDays: RELATIVE_DAYS_WINDOW,
  });

  const beforeAggregateQueryParams: AggregateFlamegraphQueryParameters = useMemo(() => {
    return {
      ...sharedAggregateQueryParams,
      datetime: {
        start: regressionDateRange.start,
        end: new Date(params.breakpoint),
      },
    };
  }, [sharedAggregateQueryParams, regressionDateRange.start, params.breakpoint]);

  const afterAggregateQueryParams: AggregateFlamegraphQueryParameters = useMemo(() => {
    return {
      ...sharedAggregateQueryParams,
      datetime: {
        start: new Date(params.breakpoint),
        end: regressionDateRange.end,
      },
    };
  }, [sharedAggregateQueryParams, regressionDateRange.end, params.breakpoint]);

  const before = useAggregateFlamegraphQuery(beforeAggregateQueryParams);
  const after = useAggregateFlamegraphQuery(afterAggregateQueryParams);

  return {
    before,
    after,
  };
}
