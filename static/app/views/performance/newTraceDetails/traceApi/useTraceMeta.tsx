import {useCallback, useLayoutEffect, useMemo, useState} from 'react';
import type {Location} from 'history';
import * as qs from 'query-string';

import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {DEFAULT_STATS_PERIOD} from 'sentry/constants';
import type {PageFilters} from 'sentry/types/core';
import type {TraceMeta} from 'sentry/utils/performance/quickTrace/types';
import {decodeScalar} from 'sentry/utils/queryString';
import useApi from 'sentry/utils/useApi';
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

export type TraceMetaQueryResults = {
  data: TraceMeta;
  errors: Error[];
  isLoading: boolean;
};

export function useTraceMeta(traceSlugs: string[]): TraceMetaQueryResults {
  const filters = usePageFilters();
  const api = useApi();
  const [metaResults, setMetaResults] = useState<TraceMetaQueryResults>({
    data: {
      errors: 0,
      performance_issues: 0,
      projects: 0,
      transactions: 0,
    },
    isLoading: true,
    errors: [],
  });
  const organization = useOrganization();

  const queryParams = useMemo(() => {
    const query = qs.parse(location.search);
    return getMetaQueryParams(query, filters.selection);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mode = queryParams.demo ? 'demo' : undefined;

  const fetchSingleTraceMeta = useCallback(
    async (traceSlug: string): Promise<TraceMeta> => {
      const data = await api.requestPromise(
        `/organizations/${organization.slug}/events-trace-meta/${traceSlug}/`,
        {
          method: 'GET',
          data: queryParams,
        }
      );
      return data;
    },
    [api, organization.slug, queryParams]
  );

  const fetchTraceMetasInBatches = useCallback(
    async (traceIds: string[]) => {
      const clonedTraceIds = [...traceIds];

      while (clonedTraceIds.length > 0) {
        const batch = clonedTraceIds.splice(0, 3);
        try {
          const results = await Promise.allSettled(batch.map(fetchSingleTraceMeta));
          setMetaResults(prev => {
            const updatedData = results.reduce(
              (acc, result) => {
                if (result.status === 'fulfilled') {
                  const {errors, performance_issues, projects, transactions} =
                    result.value;
                  acc.errors += errors;
                  acc.performance_issues += performance_issues;
                  acc.projects = Math.max(acc.projects, projects);
                  acc.transactions += transactions;
                }
                return acc;
              },
              {...prev.data}
            );

            return {
              ...prev,
              isLoading: clonedTraceIds.length > 0,
              data: updatedData,
            };
          });
        } catch (error) {
          setMetaResults(prev => {
            return {
              ...prev,
              isLoading: false,
              errors: prev.errors.concat(error),
            };
          });
        }
      }
    },
    [fetchSingleTraceMeta]
  );

  useLayoutEffect(() => {
    fetchTraceMetasInBatches(traceSlugs);
  }, [traceSlugs, fetchTraceMetasInBatches]);

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
      errors: [],
    };
  }

  return metaResults;
}
