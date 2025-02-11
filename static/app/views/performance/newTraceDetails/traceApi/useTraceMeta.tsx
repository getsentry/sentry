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
  const meta: TraceMeta = {
    errors: 0,
    performance_issues: 0,
    projects: 0,
    transactions: 0,
    transaction_child_count_map: {},
    span_count: 0,
    span_count_map: {},
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

    results.reduce((acc, result) => {
      if (result.status === 'fulfilled') {
        acc.errors += result.value.errors;
        acc.performance_issues += result.value.performance_issues;
        acc.projects = Math.max(acc.projects, result.value.projects);
        acc.transactions += result.value.transactions;

        // Turn the transaction_child_count_map array into a map of transaction id to child count
        // for more efficient lookups.
        result.value.transaction_child_count_map.forEach(
          ({'transaction.id': id, count}: any) => {
            acc.transaction_child_count_map[id] = count;
          }
        );

        acc.span_count += result.value.span_count;
        Object.entries(result.value.span_count_map).forEach(([span_op, count]: any) => {
          acc.span_count_map[span_op] = count;
        });
      } else {
        apiErrors.push(new Error(result?.reason));
      }
      return acc;
    }, meta);
  }

  return {meta, apiErrors};
}

export type TraceMetaQueryResults = {
  data: TraceMeta | undefined;
  errors: Error[];
  status: QueryStatus;
};

export function useTraceMeta(replayTraces: ReplayTrace[]): TraceMetaQueryResults {
  const api = useApi();
  const filters = usePageFilters();
  const organization = useOrganization();

  const normalizedParams = useMemo(() => {
    const query = qs.parse(location.search);
    return normalizeDateTimeParams(query, {
      allowAbsolutePageDatetime: true,
    });
  }, []);

  // demo has the format ${projectSlug}:${eventId}
  // used to query a demo transaction event from the backend.
  const mode = decodeScalar(normalizedParams.demo) ? 'demo' : undefined;

  const query = useQuery<
    {
      apiErrors: Error[];
      meta: TraceMeta;
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
      data: query.data?.meta,
      errors: query.data?.apiErrors ?? [],
      status:
        query.data?.apiErrors?.length === replayTraces.length ? 'error' : query.status,
    };
  }, [query, replayTraces.length]);

  // When projects don't have performance set up, we allow them to view a sample transaction.
  // The backend creates the sample transaction, however the trace is created async, so when the
  // page loads, we cannot guarantee that querying the trace will succeed as it may not have been stored yet.
  // When this happens, we assemble a fake trace response to only include the transaction that had already been
  // created and stored already so that the users can visualize in the context of a trace.
  // The trace meta query has to reflect this by returning a single transaction and project.
  const demoResults = useMemo(() => {
    return {
      data: {
        errors: 0,
        performance_issues: 0,
        projects: 1,
        transactions: 1,
        transaction_child_count_map: {},
        span_count: 0,
        span_count_map: {},
      },
      errors: [],
      status: 'success' as QueryStatus,
    };
  }, []);

  return mode === 'demo' ? demoResults : results;
}
