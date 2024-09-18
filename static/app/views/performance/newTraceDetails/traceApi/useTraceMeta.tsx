import {useMemo} from 'react';
import {useQuery} from '@tanstack/react-query';
import * as qs from 'query-string';

import type {Client} from 'sentry/api';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {DEFAULT_STATS_PERIOD} from 'sentry/constants';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {TraceMeta} from 'sentry/utils/performance/quickTrace/types';
import type {QueryStatus} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import type {ReplayTrace} from 'sentry/views/replays/detail/trace/useReplayTraces';

type TraceMetaQueryParams =
  | {
      // demo has the format ${projectSlug}:${eventId}
      // used to query a demo transaction event from the backend.
      statsPeriod: string;
    }
  | {
      timestamp: number;
    };

function getMetaQueryParams(
  row: ReplayTrace,
  normalizedParams: any,
  filters: Partial<PageFilters> = {}
): TraceMetaQueryParams {
  const statsPeriod = decodeScalar(normalizedParams.statsPeriod);

  if (row.timestamp) {
    return {timestamp: row.timestamp};
  }

  return {
    statsPeriod: (statsPeriod || filters?.datetime?.period) ?? DEFAULT_STATS_PERIOD,
  };
}

async function fetchSingleTraceMetaNew(
  api: Client,
  organization: Organization,
  replayTrace: ReplayTrace,
  queryParams: any
) {
  const data = await api.requestPromise(
    `/organizations/${organization.slug}/events-trace-meta/${replayTrace.traceSlug}/`,
    {
      method: 'GET',
      data: queryParams,
    }
  );
  return data;
}

async function fetchTraceMetaInBatches(
  api: Client,
  organization: Organization,
  replayTraces: ReplayTrace[],
  normalizedParams: any,
  filters: Partial<PageFilters> = {}
) {
  const clonedTraceIds = [...replayTraces];
  const metaResults: TraceMeta = {
    errors: 0,
    performance_issues: 0,
    projects: 0,
    transactions: 0,
    transactiontoSpanChildrenCount: {},
  };

  const apiErrors: Error[] = [];

  while (clonedTraceIds.length > 0) {
    const batch = clonedTraceIds.splice(0, 3);
    const results = await Promise.allSettled(
      batch.map(replayTrace => {
        const queryParams = getMetaQueryParams(replayTrace, normalizedParams, filters);
        return fetchSingleTraceMetaNew(api, organization, replayTrace, queryParams);
      })
    );

    const updatedData = results.reduce(
      (acc, result) => {
        if (result.status === 'fulfilled') {
          const {
            errors,
            performance_issues,
            projects,
            transactions,
            transaction_child_count_map,
          } = result.value;
          acc.errors += errors;
          acc.performance_issues += performance_issues;
          acc.projects = Math.max(acc.projects, projects);
          acc.transactions += transactions;

          // Turn the transaction_child_count_map array into a map of transaction id to child count
          // for more efficient lookups.
          transaction_child_count_map.forEach(({'transaction.id': id, count}) => {
            acc.transactiontoSpanChildrenCount[id] = count;
          });
        } else {
          apiErrors.push(new Error(result.reason));
        }
        return acc;
      },
      {...metaResults}
    );

    metaResults.errors = updatedData.errors;
    metaResults.performance_issues = updatedData.performance_issues;
    metaResults.projects = Math.max(updatedData.projects, metaResults.projects);
    metaResults.transactions = updatedData.transactions;
    metaResults.transactiontoSpanChildrenCount =
      updatedData.transactiontoSpanChildrenCount;
  }

  return {metaResults, apiErrors};
}

export type TraceMetaQueryResults = {
  data: TraceMeta | undefined;
  errors: Error[];
  isLoading: boolean;
  status: QueryStatus;
};

export function useTraceMeta(replayTraces: ReplayTrace[]): TraceMetaQueryResults {
  const filters = usePageFilters();
  const api = useApi();
  const organization = useOrganization();

  const normalizedParams = useMemo(() => {
    const query = qs.parse(location.search);
    return normalizeDateTimeParams(query, {
      allowAbsolutePageDatetime: true,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // demo has the format ${projectSlug}:${eventId}
  // used to query a demo transaction event from the backend.
  const mode = decodeScalar(normalizedParams.demo) ? 'demo' : undefined;

  const {data, isPending, status} = useQuery<
    {
      apiErrors: Error[];
      metaResults: TraceMeta;
    },
    Error
  >({
    queryKey: ['traceData', replayTraces],
    queryFn: () =>
      fetchTraceMetaInBatches(
        api,
        organization,
        replayTraces,
        normalizedParams,
        filters.selection
      ),
    enabled: replayTraces.length > 0,
  });

  const results = useMemo(() => {
    return {
      data: data?.metaResults,
      errors: data?.apiErrors || [],
      isLoading: isPending,
      status,
    };
  }, [data, isPending, status]);

  // When projects don't have performance set up, we allow them to view a sample transaction.
  // The backend creates the sample transaction, however the trace is created async, so when the
  // page loads, we cannot guarantee that querying the trace will succeed as it may not have been stored yet.
  // When this happens, we assemble a fake trace response to only include the transaction that had already been
  // created and stored already so that the users can visualize in the context of a trace.
  // The trace meta query has to reflect this by returning a single transaction and project.
  if (mode === 'demo') {
    return {
      data: {
        errors: 0,
        performance_issues: 0,
        projects: 1,
        transactions: 1,
        transactiontoSpanChildrenCount: {},
      },
      isLoading: false,
      errors: [],
      status: 'success',
    };
  }

  return results;
}
