import {useMemo} from 'react';
import type {Location} from 'history';
import * as qs from 'query-string';

import type {Client} from 'sentry/api';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import type {EventTransaction, PageFilters} from 'sentry/types';
import type {
  TraceFullDetailed,
  TraceSplitResults,
} from 'sentry/utils/performance/quickTrace/types';
import {useApiQuery, type UseApiQueryResult} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useParams} from 'sentry/utils/useParams';

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
  options: {limit?: number} = {}
): {
  eventId: string | undefined;
  limit: number;
  timestamp: string | undefined;
  useSpans: number;
  pageEnd?: string | undefined;
  pageStart?: string | undefined;
  sampleSlug?: string | undefined;
  statsPeriod?: string | undefined;
} {
  const normalizedParams = normalizeDateTimeParams(query, {
    allowAbsolutePageDatetime: true,
  });
  const statsPeriod = decodeScalar(normalizedParams.statsPeriod);
  const sampleSlug = decodeScalar(normalizedParams.sampleSlug);
  const timestamp = decodeScalar(normalizedParams.timestamp);
  let decodedLimit: string | number | undefined =
    options.limit ?? decodeScalar(normalizedParams.limit);

  if (typeof decodedLimit === 'string') {
    decodedLimit = parseInt(decodedLimit, 10);
  }

  const eventId = decodeScalar(normalizedParams.eventId);

  if (timestamp) {
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
  if (timestamp) {
    delete otherParams.statsPeriod;
  }

  const queryParams = {
    ...otherParams,
    sampleSlug,
    limit,
    timestamp,
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

  return queryParams;
}

function parseSampleSlug(
  sample: string | undefined
): {event_id: string; project_slug: string} | null {
  if (!sample) {
    return null;
  }

  const [project_slug, event_id] = sample.split(':');
  return {project_slug, event_id};
}

function makeTraceFromTransaction(
  event: EventTransaction | undefined
): TraceSplitResults<TraceFullDetailed> {
  if (!event) {
    return {transactions: [], orphan_errors: []};
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
    children: [],
    start_timestamp: event.startTimestamp,
    'transaction.op': traceContext?.op ?? '',
    'transaction.status': traceContext?.status ?? '',
    measurements: event.measurements ?? {},
    tags: [],
  };

  return {transactions: [transaction], orphan_errors: []};
}

type UseTraceParams = {
  limit?: number;
};

const DEFAULT_OPTIONS = {};
export function useTrace(options: Partial<UseTraceParams> = DEFAULT_OPTIONS): {
  data: TraceSplitResults<TraceFullDetailed> | undefined;
  status: UseApiQueryResult<TraceSplitResults<TraceFullDetailed>, any>['status'];
} {
  const filters = usePageFilters();
  const organization = useOrganization();
  const params = useParams<{traceSlug?: string}>();
  const queryParams = useMemo(() => {
    const query = qs.parse(location.search);
    return getTraceQueryParams(query, filters.selection, options);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options]);
  const sample = parseSampleSlug(queryParams.sampleSlug);

  const sampleQuery = useApiQuery<EventTransaction>(
    [
      `/organizations/${organization.slug}/events/${sample?.project_slug}:${sample?.event_id}/`,
      {
        query: {
          referrer: 'trace-view',
        },
      },
    ],
    {
      staleTime: Infinity,
      enabled: !!sample,
    }
  );

  const traceQuery = useApiQuery<TraceSplitResults<TraceFullDetailed>>(
    [
      `/organizations/${organization.slug}/events-trace/${params.traceSlug ?? ''}/`,
      {query: queryParams},
    ],
    {
      staleTime: Infinity,
      enabled: !!params.traceSlug && !!organization.slug && !sample,
    }
  );

  if (sample) {
    return {data: makeTraceFromTransaction(sampleQuery.data), status: sampleQuery.status};
  }

  return {data: traceQuery.data, status: traceQuery.status};
}
