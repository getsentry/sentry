import {useEffect, useMemo, useState} from 'react';
import type {Location} from 'history';
import * as qs from 'query-string';

import type {Client} from 'sentry/api';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import type {PageFilters} from 'sentry/types/core';
import type {EventTransaction} from 'sentry/types/event';
import type {
  TraceFullDetailed,
  TraceSplitResults,
} from 'sentry/utils/performance/quickTrace/types';
import {useApiQuery, type UseApiQueryResult} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import type {TraceDataRow} from 'sentry/views/replays/detail/trace/replayTransactionContext';

import type {TraceTree} from '../traceModels/traceTree';

export function fetchTrace(
  api: Client,
  params: {
    orgSlug: string;
    query: string;
    traceId: string;
  }
): Promise<TraceSplitResults<TraceFullDetailed>> {
  return api.requestPromise(
    `/organizations/${params.orgSlug}/events-trace/${params.traceId}/?${params.query}`
  );
}

const DEFAULT_TIMESTAMP_LIMIT = 10_000;
const DEFAULT_LIMIT = 1_000;

export function getTraceQueryParams(
  query: Location['query'],
  filters: Partial<PageFilters> = {},
  options: {limit?: number} = {},
  traceDataRow: TraceDataRow
): string {
  const normalizedParams = normalizeDateTimeParams(query, {
    allowAbsolutePageDatetime: true,
  });
  const statsPeriod = decodeScalar(normalizedParams.statsPeriod);
  const demo = decodeScalar(normalizedParams.demo);
  let decodedLimit: string | number | undefined =
    options.limit ?? decodeScalar(normalizedParams.limit);

  if (typeof decodedLimit === 'string') {
    decodedLimit = parseInt(decodedLimit, 10);
  }

  const eventId = decodeScalar(normalizedParams.eventId);

  if (traceDataRow?.timestamp) {
    decodedLimit = decodedLimit ?? DEFAULT_TIMESTAMP_LIMIT;
  } else {
    decodedLimit = decodedLimit ?? DEFAULT_LIMIT;
  }

  const limit = decodedLimit;

  const otherParams: Record<string, string | string[] | undefined | null> = {
    end: normalizedParams.pageEnd,
    start: normalizedParams.pageStart,
    statsPeriod: statsPeriod || filters.datetime?.period,
  };

  // We prioritize timestamp over statsPeriod as it makes the query more specific, faster
  // and not prone to time drift issues.
  if (traceDataRow?.timestamp) {
    delete otherParams.statsPeriod;
  }

  const queryParams = {
    ...otherParams,
    demo,
    limit,
    timestamp: traceDataRow?.timestamp?.toString(),
    eventId,
    useSpans: 1,
  };
  for (const key in queryParams) {
    if (
      queryParams[key] === '' ||
      queryParams[key] === null ||
      queryParams[key] === undefined
    ) {
      delete queryParams[key];
    }
  }

  return qs.stringify(queryParams);
}

function parseDemoEventSlug(
  demoEventSlug: string | undefined
): {event_id: string; project_slug: string} | null {
  if (!demoEventSlug) {
    return null;
  }

  const [project_slug, event_id] = demoEventSlug.split(':');
  return {project_slug, event_id};
}

function makeTraceFromTransaction(
  event: EventTransaction | undefined
): TraceSplitResults<TraceFullDetailed> | undefined {
  if (!event) {
    return undefined;
  }

  const traceContext = event.contexts?.trace;

  const transaction = {
    event_id: event.eventID,
    generation: 0,
    parent_event_id: '',
    parent_span_id: traceContext?.parent_span_id ?? '',
    performance_issues: [],
    project_id: Number(event.projectID),
    project_slug: event.projectSlug ?? '',
    span_id: traceContext?.span_id ?? '',
    timestamp: event.endTimestamp,
    transaction: event.title,
    'transaction.duration': (event.endTimestamp - event.startTimestamp) * 1000,
    errors: [],
    sdk_name: event.sdk?.name ?? '',
    children: [],
    start_timestamp: event.startTimestamp,
    'transaction.op': traceContext?.op ?? '',
    'transaction.status': traceContext?.status ?? '',
    measurements: event.measurements ?? {},
    tags: [],
  };

  return {transactions: [transaction], orphan_errors: []};
}

function useDemoTrace(
  demo: string | undefined,
  organization: {slug: string}
): UseApiQueryResult<TraceSplitResults<TraceTree.Transaction> | undefined, any> {
  const demoEventSlug = parseDemoEventSlug(demo);

  // When projects don't have performance set up, we allow them to view a demo transaction.
  // The backend creates the demo transaction, however the trace is created async, so when the
  // page loads, we cannot guarantee that querying the trace will succeed as it may not have been stored yet.
  // When this happens, we assemble a fake trace response to only include the transaction that had already been
  // created and stored already so that the users can visualize in the context of a trace.
  const demoEventQuery = useApiQuery<EventTransaction>(
    [
      `/organizations/${organization.slug}/events/${demoEventSlug?.project_slug}:${demoEventSlug?.event_id}/`,
      {
        query: {
          referrer: 'trace-view',
        },
      },
    ],
    {
      staleTime: Infinity,
      enabled: !!demoEventSlug,
    }
  );

  // Without the useMemo, the trace from the transformed response  will be re-created on every render,
  // causing the trace view to re-render as we interact with it.
  const data = useMemo(() => {
    return makeTraceFromTransaction(demoEventQuery.data);
  }, [demoEventQuery.data]);

  // Casting here since the 'select' option is not available in the useApiQuery hook to transform the data
  // from EventTransaction to TraceSplitResults<TraceFullDetailed>
  return {...demoEventQuery, data} as UseApiQueryResult<
    TraceSplitResults<TraceTree.Transaction> | undefined,
    any
  >;
}

type UseTraceParams = {
  traceDataRows: TraceDataRow[] | undefined;
  limit?: number;
};

type TraceQueryResults = {
  errors: Error[];
  hasMultipleTraces: boolean;
  isIncrementallyFetching: boolean;
  isLoading: boolean;
  trace: TraceSplitResults<TraceTree.Transaction> | undefined;
};

const DEFAULT_OPTIONS = {
  traceDataRows: [],
};
export function useTrace(options: UseTraceParams = DEFAULT_OPTIONS): TraceQueryResults {
  const filters = usePageFilters();
  const api = useApi();
  const organization = useOrganization();
  const urlParams = useMemo(() => {
    return qs.parse(location.search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mode = decodeScalar(urlParams.demo);
  const demoTrace = useDemoTrace(decodeScalar(urlParams.demo), organization);

  const [traceData, setTraceData] = useState<{
    errors: Error[];
    hasMultipleTraces: boolean;
    isIncrementallyFetching: boolean;
    isLoading: boolean;
    trace: TraceSplitResults<TraceTree.Transaction> | undefined;
  }>({
    trace: undefined,
    isLoading: true,
    isIncrementallyFetching: false,
    hasMultipleTraces: options.traceDataRows ? options.traceDataRows.length > 1 : false,
    errors: [],
  });

  useEffect(() => {
    async function fetchTracesInBatches(traceDataRows: TraceDataRow[] | undefined) {
      if (!traceDataRows || traceDataRows.length === 0) {
        return;
      }

      const clonedTraceIds = [...traceDataRows];
      const apiErrors: Error[] = [];

      while (clonedTraceIds.length > 0) {
        const batch = clonedTraceIds.splice(0, 3);
        const results = await Promise.allSettled(
          batch.map(batchTraceData => {
            return fetchTrace(api, {
              orgSlug: organization.slug,
              query: getTraceQueryParams(
                urlParams,
                filters.selection,
                options,
                batchTraceData
              ),
              traceId: batchTraceData.traceSlug,
            });
          })
        );

        const updatedData = results.reduce(
          (acc, result) => {
            if (result.status === 'fulfilled') {
              const {transactions, orphan_errors} = result.value;
              acc.transactions.push(...transactions);
              acc.orphan_errors.push(...orphan_errors);
            } else {
              apiErrors.push(new Error(result.reason));
            }
            return acc;
          },
          {
            transactions: [],
            orphan_errors: [],
          } as TraceSplitResults<TraceTree.Transaction>
        );

        setTraceData(prev => {
          return {
            ...prev,
            trace: updatedData,
            isLoading: false,
            isIncrementallyFetching: true,
          };
        });
      }

      setTraceData(prev => {
        return {
          ...prev,
          isIncrementallyFetching: false,
          errors: apiErrors,
        };
      });
    }

    if (mode !== 'demo') {
      fetchTracesInBatches(options.traceDataRows);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return mode === 'demo'
    ? {
        trace: demoTrace.data ?? {
          transactions: [],
          orphan_errors: [],
        },
        isLoading: demoTrace.isLoading,
        isIncrementallyFetching: false,
        errors: demoTrace.error ? [demoTrace.error] : [],
        hasMultipleTraces: false,
      }
    : traceData;
}
