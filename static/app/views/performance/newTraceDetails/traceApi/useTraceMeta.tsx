import {useMemo} from 'react';
import {useQuery} from '@tanstack/react-query';
import type {Location} from 'history';
import * as qs from 'query-string';

import type {Client} from 'sentry/api';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {DEFAULT_STATS_PERIOD} from 'sentry/constants';
import type {Organization} from 'sentry/types';
import type {PageFilters} from 'sentry/types/core';
import type {TraceMeta} from 'sentry/utils/performance/quickTrace/types';
import type {QueryStatus} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

type TraceMetaQueryParams =
  | {
      // demo has the format ${projectSlug}:${eventId}
      // used to query a demo transaction event from the backend.
      demo: string | undefined;
      statsPeriod: string;
    }
  | {
      demo: string | undefined;
      timestamp: string;
    };

function getMetaQueryParams(
  query: Location['query'],
  filters: Partial<PageFilters> = {}
): TraceMetaQueryParams {
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

async function fetchSingleTraceMetaNew(
  api: Client,
  organization: Organization,
  traceSlug: string,
  queryParams: any
) {
  const data = await api.requestPromise(
    `/organizations/${organization.slug}/events-trace-meta/${traceSlug}/`,
    {
      method: 'GET',
      data: queryParams,
    }
  );
  return data;
}

async function fetchTraceMetaInBatches(
  traceIds: string[],
  api: Client,
  organization: Organization,
  queryParams: TraceMetaQueryParams
) {
  const clonedTraceIds = [...traceIds];
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
      batch.map(slug => {
        return fetchSingleTraceMetaNew(api, organization, slug, queryParams);
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

export function useTraceMeta(traceSlugs: string[]): TraceMetaQueryResults {
  const filters = usePageFilters();
  const api = useApi();
  const organization = useOrganization();

  const queryParams = useMemo(() => {
    const query = qs.parse(location.search);
    return getMetaQueryParams(query, filters.selection);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mode = queryParams.demo ? 'demo' : undefined;

  const {data, isLoading, status} = useQuery<
    {
      apiErrors: Error[];
      metaResults: TraceMeta;
    },
    Error
  >(
    ['traceData', traceSlugs],
    () => fetchTraceMetaInBatches(traceSlugs, api, organization, queryParams),
    {
      enabled: traceSlugs.length > 0,
    }
  );

  const results = useMemo(() => {
    return {
      data: data?.metaResults,
      errors: data?.apiErrors || [],
      isLoading,
      status,
    };
  }, [data, isLoading, status]);

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
        transactiontoSpanChildrenCount: {'1': 0},
      },
      isLoading: false,
      errors: [],
      status: 'success',
    };
  }

  return results;
}
