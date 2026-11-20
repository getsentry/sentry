import type {QueryClient} from '@tanstack/react-query';

import {ALL_ACCESS_PROJECTS} from 'sentry/components/pageFilters/constants';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getUtcDateString} from 'sentry/utils/dates';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {SAMPLING_MODE} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {
  getIsAiAgentSpan,
  getHasAiSpansFilter,
} from 'sentry/views/insights/pages/agents/utils/query';
import type {TraceTree} from 'sentry/views/performance/traceDetails/traceModels/traceTree';

/**
 * A span row from the spans dataset, with the fields needed to rebuild it as a trace
 * span.
 */
type SpanRow = {
  [attribute: string]: unknown;
  'gen_ai.operation.type': string | null;
  id: string;
  is_transaction: boolean | number;
  parent_span: string | null;
  'precise.finish_ts': number;
  'precise.start_ts': number;
  project: string;
  'project.id': number;
  'sdk.name': string | null;
  'span.description': string | null;
  'span.duration': number;
  'span.name': string | null;
  'span.op': string;
  transaction: string | null;
  'transaction.event_id': string | null;
  'transaction.span_id': string;
};

const SPAN_FIELDS = [
  'id',
  'parent_span',
  'span.op',
  'span.name',
  'span.description',
  'span.duration',
  'precise.start_ts',
  'precise.finish_ts',
  'project',
  'project.id',
  'is_transaction',
  'transaction',
  'transaction.event_id',
  'transaction.span_id',
  'sdk.name',
  'gen_ai.operation.type',
];

// The spans endpoint returns at most 100 rows per request.
const MAX_ROWS = 100;
// Each segment the ancestor walk crosses costs two requests.
const MAX_SEGMENTS = 3;
const DAY_IN_S = 24 * 60 * 60;

interface SpansQuery {
  attributes: string[];
  organizationSlug: string;
  queryClient: QueryClient;
  timestamp: number;
  traceId: string;
}

async function fetchSpans(
  {queryClient, organizationSlug, traceId, timestamp, attributes}: SpansQuery,
  query: string,
  perPage: number
): Promise<SpanRow[]> {
  const options = apiOptions.as<{data: SpanRow[]}>()(
    '/organizations/$organizationIdOrSlug/events/',
    {
      path: {organizationIdOrSlug: organizationSlug},
      query: {
        dataset: DiscoverDatasets.SPANS,
        field: [...SPAN_FIELDS, ...attributes],
        per_page: perPage,
        project: ALL_ACCESS_PROJECTS,
        start: getUtcDateString((timestamp - DAY_IN_S) * 1000),
        end: getUtcDateString((timestamp + DAY_IN_S) * 1000),
        query: `trace:${traceId} ${query}`,
        sort: 'precise.start_ts',
        sampling: SAMPLING_MODE.HIGH_ACCURACY,
        referrer: 'api.issues.agent-run.span-ancestry',
      },
      staleTime: Infinity,
    }
  );
  return (await queryClient.fetchQuery(options)).json.data;
}

function isAgentRow(row: SpanRow) {
  return getIsAiAgentSpan(row['gen_ai.operation.type'] ?? undefined);
}

/**
 * Walks up from `spanId` to the agent span that contains it, returning the spans on
 * the way, starting with `spanId`. Spans in one segment are fetched together: an
 * ancestor starts before and finishes after the span below it.
 */
async function fetchAncestors(spans: SpansQuery, spanId: string): Promise<SpanRow[]> {
  const ancestors: SpanRow[] = [];
  let nextId: string | null = spanId;
  for (let segment = 0; nextId && segment < MAX_SEGMENTS; segment++) {
    const [span] = await fetchSpans(spans, `id:${nextId}`, 1);
    if (!span) {
      break;
    }
    const segmentSpans = await fetchSpans(
      spans,
      [
        `transaction.span_id:${span['transaction.span_id']}`,
        `precise.start_ts:<=${span['precise.start_ts']}`,
        `precise.finish_ts:>=${span['precise.finish_ts']}`,
      ].join(' '),
      MAX_ROWS
    );
    const spansById = new Map(segmentSpans.map(row => [row.id, row]));
    spansById.set(span.id, span);

    let current: SpanRow | undefined = span;
    while (current) {
      ancestors.push(current);
      if (isAgentRow(current)) {
        return ancestors;
      }
      nextId = current.parent_span;
      current = nextId ? spansById.get(nextId) : undefined;
    }
  }
  return ancestors;
}

function toTraceSpan(row: SpanRow, attributes: string[]): TraceTree.EAPSpan {
  const additionalAttributes: Record<string, string | number> = {};
  for (const attribute of attributes) {
    const value = row[attribute];
    if (typeof value === 'string' || typeof value === 'number') {
      additionalAttributes[attribute] = value;
    }
  }
  return {
    event_id: row.id,
    event_type: 'span',
    op: row['span.op'],
    name: row['span.name'] ?? '',
    description: row['span.description'] ?? undefined,
    start_timestamp: row['precise.start_ts'],
    end_timestamp: row['precise.finish_ts'],
    duration: row['span.duration'],
    is_transaction: Boolean(row.is_transaction),
    parent_span_id: row.parent_span,
    project_id: row['project.id'],
    project_slug: row.project,
    sdk_name: row['sdk.name'] ?? '',
    transaction: row.transaction ?? '',
    transaction_id: row['transaction.event_id'] ?? '',
    profile_id: '',
    profiler_id: '',
    children: [],
    errors: [],
    occurrences: [],
    additional_attributes: additionalAttributes,
  };
}

/**
 * Builds a trace of just the agent run that an error was raised in, for traces that
 * are too large for the trace endpoint to return the error's span. The trace holds
 * the spans from the error's span up to its agent span, and the AI spans of that run.
 * Returns `null` when the error's span was not stored or is not inside an agent run.
 */
export async function fetchAgentRunTrace({
  error,
  spanId,
  ...spans
}: SpansQuery & {
  error: Pick<TraceTree.EAPError, 'event_id' | 'issue_id' | 'project_id' | 'description'>;
  spanId: string;
}): Promise<TraceTree.EAPTrace | null> {
  const ancestors = await fetchAncestors(spans, spanId);
  const runRow = ancestors.at(-1);
  if (!runRow || !isAgentRow(runRow)) {
    return null;
  }

  // Spans of the run that are not AI spans, such as the HTTP request inside a tool,
  // are not fetched, so AI spans are matched to the run by time, not by parent.
  const runRows = await fetchSpans(
    spans,
    [
      getHasAiSpansFilter(),
      `precise.start_ts:>=${runRow['precise.start_ts']}`,
      `precise.finish_ts:<=${runRow['precise.finish_ts']}`,
    ].join(' '),
    MAX_ROWS
  );

  const spansById = new Map<string, TraceTree.EAPSpan>();
  for (const row of [...ancestors, ...runRows]) {
    if (!spansById.has(row.id)) {
      spansById.set(row.id, toTraceSpan(row, spans.attributes));
    }
  }
  const runSpan = spansById.get(runRow.id)!;
  for (const span of spansById.values()) {
    if (span === runSpan) {
      continue;
    }
    const parent = (span.parent_span_id && spansById.get(span.parent_span_id)) || runSpan;
    parent.children.push(span);
  }

  spansById.get(spanId)?.errors.push({
    ...error,
    event_type: 'error',
    level: 'error',
    project_slug: runSpan.project_slug,
    start_timestamp: spans.timestamp,
    transaction: runSpan.transaction,
  });

  return [runSpan];
}

/**
 * The trace endpoint puts errors whose span it did not return at the top level of
 * the trace. That happens when a trace has more spans than the endpoint returns.
 */
export function isErrorDetachedFromSpans(trace: TraceTree.EAPTrace, eventId: string) {
  return trace.some(item => item.event_type === 'error' && item.event_id === eventId);
}
