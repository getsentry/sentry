import {useMemo} from 'react';

import {RELATIVE_DAYS_WINDOW} from 'sentry/components/events/eventStatisticalDetector/consts';
import {useRelativeDateTime} from 'sentry/utils/profiling/hooks/useRelativeDateTime';

import type {AggregateFlamegraphQueryParameters} from './useAggregateFlamegraphQuery';
import {useAggregateFlamegraphQuery} from './useAggregateFlamegraphQuery';

interface DifferentialFlamegraphQueryParameters {
  breakpoint: number;
  environments: AggregateFlamegraphQueryParameters['environments'];
  fingerprint: string | undefined;
  projectID: number | null;
}

export interface DifferentialFlamegraphQueryResult {
  after: ReturnType<typeof useAggregateFlamegraphQuery>;
  before: ReturnType<typeof useAggregateFlamegraphQuery>;
}

export function useDifferentialFlamegraphQuery(
  params: DifferentialFlamegraphQueryParameters
): DifferentialFlamegraphQueryResult {
  const sharedAggregateQueryParams: AggregateFlamegraphQueryParameters = useMemo(() => {
    const p: Exclude<AggregateFlamegraphQueryParameters, 'datetime'> = {
      query: '',
      environments: params.environments,
      fingerprint: params.fingerprint,
      projects:
        params.projectID === null || isNaN(params.projectID) ? [] : [params.projectID],
    };

    return p;
  }, [params.environments, params.projectID, params.fingerprint]);

  const regressionDateRange = useRelativeDateTime({
    anchor: params.breakpoint,
    relativeDays: RELATIVE_DAYS_WINDOW,
  });

  const beforeAggregateQueryParams: AggregateFlamegraphQueryParameters = useMemo(() => {
    return {
      ...sharedAggregateQueryParams,
      datetime: {
        start: regressionDateRange.start,
        end: new Date(params.breakpoint * 1000),
        period: null,
        utc: null,
      },
    };
  }, [sharedAggregateQueryParams, regressionDateRange.start, params.breakpoint]);

  const afterAggregateQueryParams: AggregateFlamegraphQueryParameters = useMemo(() => {
    return {
      ...sharedAggregateQueryParams,
      datetime: {
        start: new Date(params.breakpoint * 1000),
        end: regressionDateRange.end,
        period: null,
        utc: null,
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
