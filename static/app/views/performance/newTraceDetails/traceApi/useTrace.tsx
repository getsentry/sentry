import {useMemo} from 'react';
import type {Location} from 'history';
import * as qs from 'query-string';

import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import type {PageFilters} from 'sentry/types/core';
import type {EventTransaction} from 'sentry/types/event';
import {useApiQuery, type UseApiQueryResult} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import type RequestError from 'sentry/utils/requestError/requestError';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {useIsEAPTraceEnabled} from 'sentry/views/performance/newTraceDetails/useIsEAPTraceEnabled';

import type {TraceFullDetailed, TraceSplitResults} from './types';

const DEFAULT_TIMESTAMP_LIMIT = 10_000;
const DEFAULT_LIMIT = 1_000;

type TraceQueryParamOptions = {
  limit?: number;
  targetId?: string;
  timestamp?: number;
};

function getTargetIdParams(
  traceType: 'eap' | 'non-eap',
  options: TraceQueryParamOptions,
  normalizedParams: ReturnType<typeof normalizeDateTimeParams>
): {targetId?: string} | {errorId?: string} {
  // Node params occur in the format `${event-type}-${eventId}`, where the most relevant event is the last one in the array.
  // If not an array, it is a string with the same format.
  const nodeParams = normalizedParams.node;
  const targetIdFromNodeParams = Array.isArray(nodeParams)
    ? nodeParams[nodeParams.length - 1]?.split('-')[1]
    : typeof nodeParams === 'string'
      ? nodeParams.split('-')[1]
      : undefined;

  // We try our best to pass a target event id to the trace query.
  // We first check if targetId is passed in the options, then we check for
  // targetId/eventId in the query params, lastly we check for the node params.
  const targetId =
    options.targetId ??
    decodeScalar(normalizedParams.targetId ?? normalizedParams.eventId) ??
    targetIdFromNodeParams;

  if (!targetId) {
    return {};
  }

  if (traceType === 'eap') {
    return isValidEventUUID(targetId) ? {errorId: targetId} : {};
  }

  return {targetId};
}

type TraceQueryParams = {
  limit: number;
  demo?: string;
  pageEnd?: string;
  pageStart?: string;
  statsPeriod?: string;
  timestamp?: string;
} & ({targetId?: string} | {errorId?: string});

export function getTraceQueryParams(
  traceType: 'eap' | 'non-eap',
  query: Location['query'],
  filters?: Partial<PageFilters>,
  options: TraceQueryParamOptions = {}
): TraceQueryParams {
  const normalizedParams = normalizeDateTimeParams(query, {
    allowAbsolutePageDatetime: true,
  });
  const statsPeriod = decodeScalar(normalizedParams.statsPeriod);
  const demo = decodeScalar(normalizedParams.demo);

  const timestamp = options.timestamp ?? decodeScalar(normalizedParams.timestamp);
  let limit = options.limit ?? decodeScalar(normalizedParams.limit);
  if (typeof limit === 'string') {
    limit = parseInt(limit, 10);
  }
  if (timestamp) {
    limit = limit ?? DEFAULT_TIMESTAMP_LIMIT;
  } else {
    limit = limit ?? DEFAULT_LIMIT;
  }

  const timeRangeParams: Record<string, string | string[] | undefined | null> = {
    end: normalizedParams.pageEnd,
    start: normalizedParams.pageStart,
    statsPeriod: statsPeriod || filters?.datetime?.period,
  };

  // We prioritize timestamp over statsPeriod as it makes the query more specific, faster
  // and not prone to time drift issues.
  if (timestamp) {
    delete timeRangeParams.statsPeriod;
  }

  const targetEventParams = getTargetIdParams(traceType, options, normalizedParams);

  const queryParams = {
    ...timeRangeParams,
    ...targetEventParams,
    demo,
    limit,
    timestamp: timestamp?.toString(),
    include_uptime: query.includeUptime,
  };

  for (const key in queryParams) {
    if (
      queryParams[key as keyof typeof queryParams] === '' ||
      queryParams[key as keyof typeof queryParams] === null ||
      queryParams[key as keyof typeof queryParams] === undefined
    ) {
      delete queryParams[key as keyof typeof queryParams];
    }
  }

  return queryParams;
}

function parseDemoEventSlug(
  demoEventSlug: string | undefined
): {event_id: string; project_slug: string} | null {
  if (!demoEventSlug) {
    return null;
  }

  const [project_slug, event_id] = demoEventSlug.split(':');
  return {project_slug: project_slug!, event_id: event_id!};
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
): UseApiQueryResult<TraceSplitResults<TraceTree.Transaction>, RequestError> {
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
  return {...demoEventQuery, data} as unknown as UseApiQueryResult<
    TraceSplitResults<TraceTree.Transaction>,
    any
  >;
}

type UseTraceOptions = {
  additionalAttributes?: string[];
  limit?: number;
  /**
   * When passed we make sure that the corresponding event is a part of the trace (if it exists)
   * irrespective of the trace query count limit.
   */
  targetEventId?: string;
  timestamp?: number;
  traceSlug?: string;
};

export function useTrace(
  options: UseTraceOptions
): UseApiQueryResult<TraceTree.Trace, RequestError> {
  const filters = usePageFilters();
  const organization = useOrganization();
  const query = qs.parse(location.search);

  const isEAPEnabled = useIsEAPTraceEnabled();
  const hasValidTrace = Boolean(options.traceSlug && organization.slug);

  const queryParams = useMemo(() => {
    return getTraceQueryParams(
      isEAPEnabled ? 'eap' : 'non-eap',
      query,
      filters.selection,
      {
        limit: options.limit,
        timestamp: options.timestamp,
        targetId: options.targetEventId,
      }
    );

    // Only re-run this if the view query param changes, otherwise if we pass location.search
    // as a dependency, the query will re-run every time we perform actions on the trace view; like
    // clicking on a span, that updates the url.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    options.limit,
    options.timestamp,
    options.targetEventId,
    isEAPEnabled,
    filters.selection,
  ]);

  const isDemoMode = Boolean(queryParams.demo);
  const demoTrace = useDemoTrace(queryParams.demo, organization);

  const traceQuery = useApiQuery<TraceSplitResults<TraceTree.Transaction>>(
    [
      `/organizations/${organization.slug}/events-trace/${options.traceSlug ?? ''}/`,
      {query: queryParams},
    ],
    {
      staleTime: Infinity,
      enabled: hasValidTrace && !isDemoMode && !isEAPEnabled,
    }
  );

  const eapTraceQuery = useApiQuery<TraceTree.EAPTrace>(
    [
      `/organizations/${organization.slug}/trace/${options.traceSlug ?? ''}/`,
      {
        query: {
          ...queryParams,
          project: -1,
          additional_attributes: options.additionalAttributes,
        },
      },
    ],
    {
      staleTime: Infinity,
      retry: false,
      enabled: hasValidTrace && !isDemoMode && isEAPEnabled,
    }
  );

  return isDemoMode ? demoTrace : isEAPEnabled ? eapTraceQuery : traceQuery;
}

const isValidEventUUID = (id: string): boolean => {
  const uuidRegex =
    /^[0-9a-f]{8}[0-9a-f]{4}[1-5][0-9a-f]{3}[89ab][0-9a-f]{3}[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};
