import {useMemo} from 'react';
import type {Location} from 'history';
import * as qs from 'query-string';

import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {DEFAULT_STATS_PERIOD} from 'sentry/constants';
import type {PageFilters} from 'sentry/types/core';
import type {TraceMeta} from 'sentry/utils/performance/quickTrace/types';
import {type ApiQueryKey, useApiQueries} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

function getMetaQueryParams(
  query: Location['query'],
  filters: Partial<PageFilters> = {}
):
  | {
      // demo has the format ${projectSlug}:${eventId}
      // used to query a demo transaction event from the backend.
      demo: string | undefined;
      statsPeriod: string;
    }
  | {
      demo: string | undefined;
      timestamp: string;
    } {
  const normalizedParams = normalizeDateTimeParams(query, {
    allowAbsolutePageDatetime: true,
  });

  const statsPeriod = decodeScalar(normalizedParams.statsPeriod);
  const timestamp = decodeScalar(normalizedParams.timestamp);

  if (timestamp) {
    return {timestamp, demo: decodeScalar(normalizedParams.demo)};
  }

  return {
    statsPeriod: (statsPeriod || filters?.datetime?.period) ?? DEFAULT_STATS_PERIOD,
    demo: decodeScalar(normalizedParams.demo),
  };
}

function getTraceMetaQueryKey(
  traceSlug: string,
  orgSlug: string,
  queryParams:
    | {
        // demo has the format ${projectSlug}:${eventId}
        // used to query a demo transaction event from the backend.
        demo: string | undefined;
        statsPeriod: string;
      }
    | {
        demo: string | undefined;
        timestamp: string;
      }
): ApiQueryKey {
  return [
    `/organizations/${orgSlug}/events-trace-meta/${traceSlug}/`,
    {query: queryParams},
  ];
}

export type TraceMetaQueryResults = {
  data: TraceMeta;
  isLoading: boolean;
  isRefetching: boolean;
  refetch: () => void;
};

export function useTraceMeta(traceSlugs: string[]): {
  data: TraceMeta;
  isLoading: boolean;
  isRefetching: boolean;
  refetch: () => void;
} {
  const filters = usePageFilters();
  const organization = useOrganization();

  const queryParams = useMemo(() => {
    const query = qs.parse(location.search);
    return getMetaQueryParams(query, filters.selection);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mode = queryParams.demo ? 'demo' : undefined;

  const queryKeys = useMemo(() => {
    return traceSlugs.map(traceSlug =>
      getTraceMetaQueryKey(traceSlug, organization.slug, queryParams)
    );
  }, [traceSlugs, organization, queryParams]);

  const results = useApiQueries<TraceMeta>(queryKeys, {
    enabled: traceSlugs.length > 0 && !!organization.slug && mode !== 'demo',
    staleTime: Infinity,
  });

  const {data, isLoading, isRefetching, refetch} = useMemo(() => {
    const mergedResult: {
      data: TraceMeta;
      isLoading: boolean;
      isRefetching: boolean;
      refetch: () => void;
    } = {
      data: {
        errors: 0,
        performance_issues: 0,
        projects: 0,
        transactions: 0,
      },
      isLoading: false,
      isRefetching: false,
      refetch: () => {
        results.forEach(result => result.refetch());
      },
    };

    for (const metaResult of results) {
      mergedResult.isLoading ||= metaResult.isLoading;
      mergedResult.isRefetching ||= metaResult.isRefetching;
      mergedResult.data.errors += metaResult.data?.errors ?? 0;
      mergedResult.data.performance_issues += metaResult.data?.performance_issues ?? 0;
      // TODO: We want the count of unique projects, not the sum of all projects. When there are multiple traces, taking the best guess by using the max
      // project count accross all traces for now.
      mergedResult.data.projects += Math.max(
        metaResult.data?.projects ?? 0,
        mergedResult.data.projects
      );
      mergedResult.data.transactions += metaResult.data?.transactions ?? 0;
    }

    return mergedResult;
  }, [results]);

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
      },
      isLoading: false,
      isRefetching: false,
      refetch: () => {},
    };
  }

  return {data, isLoading, isRefetching, refetch};
}
