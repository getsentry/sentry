import {useMemo} from 'react';

import {RELATIVE_DAYS_WINDOW} from 'sentry/components/events/eventStatisticalDetector/consts';
import {useRelativeDateTime} from 'sentry/utils/profiling/hooks/useRelativeDateTime';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';

import type {AggregateFlamegraphQueryParameters} from './useAggregateFlamegraphQuery';
import {useAggregateFlamegraphQuery} from './useAggregateFlamegraphQuery';

interface DifferentialFlamegraphQueryParameters {
  breakpoint: number;
  environments: AggregateFlamegraphQueryParameters['environments'];
  fingerprint: string | undefined;
  projectID: number | null;
  transaction: string;
}

export interface DifferentialFlamegraphQueryResult {
  after: ReturnType<typeof useAggregateFlamegraphQuery>;
  before: ReturnType<typeof useAggregateFlamegraphQuery>;
}

export function useDifferentialFlamegraphQuery(
  params: DifferentialFlamegraphQueryParameters
): DifferentialFlamegraphQueryResult {
  const query = useMemo(() => {
    // TODO: this should contain the user query
    // wait util we fully switch over to the transactions dataset
    const conditions = new MutableSearch('');
    conditions.setFilterValues('transaction', [params.transaction]);
    return conditions.formatString();
  }, [params.transaction]);

  const sharedAggregateQueryParams: AggregateFlamegraphQueryParameters = useMemo(() => {
    const p: Exclude<AggregateFlamegraphQueryParameters, 'datetime'> = {
      query,
      environments: params.environments,
      fingerprint: params.fingerprint,
      projects:
        params.projectID === null || isNaN(params.projectID) ? [] : [params.projectID],
      enabled: !!params.transaction,
    };

    return p;
  }, [
    query,
    params.environments,
    params.projectID,
    params.fingerprint,
    params.transaction,
  ]);

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
