import type {Theme} from '@emotion/react';
import isNumber from 'lodash/isNumber';
import set from 'lodash/set';
import moment from 'moment-timezone';

import {lightenBarColor} from 'sentry/components/performance/waterfall/utils';
import type {
  AggregateEntrySpans,
  AggregateEventTransaction,
  EntrySpans,
  EventTransaction,
} from 'sentry/types/event';
import {EntryType} from 'sentry/types/event';
import {assert} from 'sentry/types/utils';

import type SpanTreeModel from './spanTreeModel';
import type {
  AggregateSpanType,
  GapSpanType,
  OrphanSpanType,
  ParsedTraceType,
  ProcessedSpanType,
  RawSpanType,
  SpanType,
  TraceContextType,
} from './types';

const isValidSpanID = (maybeSpanID: any) =>
  typeof maybeSpanID === 'string' && maybeSpanID.length > 0;

export type SpanBoundsType = {endTimestamp: number; startTimestamp: number};
export type SpanGeneratedBoundsType =
  | {isSpanVisibleInView: boolean; type: 'TRACE_TIMESTAMPS_EQUAL'}
  | {isSpanVisibleInView: boolean; type: 'INVALID_VIEW_WINDOW'}
  | {
      isSpanVisibleInView: boolean;
      start: number;
      type: 'TIMESTAMPS_EQUAL';
      width: number;
    }
  | {
      end: number;
      isSpanVisibleInView: boolean;
      start: number;
      type: 'TIMESTAMPS_REVERSED';
    }
  | {
      end: number;
      isSpanVisibleInView: boolean;
      start: number;
      type: 'TIMESTAMPS_STABLE';
    };

const normalizeTimestamps = (spanBounds: SpanBoundsType): SpanBoundsType => {
  const {startTimestamp, endTimestamp} = spanBounds;

  if (startTimestamp > endTimestamp) {
    return {startTimestamp: endTimestamp, endTimestamp: startTimestamp};
  }

  return spanBounds;
};

enum TimestampStatus {
  STABLE = 0,
  REVERSED = 1,
  EQUAL = 2,
}

export enum SpanSubTimingMark {
  SPAN_START = 0,
  SPAN_END = 1,
  HTTP_REQUEST_START = 'http.request.request_start',
  HTTP_RESPONSE_START = 'http.request.response_start',
}

export enum SpanSubTimingName {
  WAIT_TIME = 'Wait Time',
  REQUEST_TIME = 'Request Time',
  RESPONSE_TIME = 'Response Time',
}

const HTTP_DATA_KEYS = [
  'http.request.redirect_start',
  'http.request.fetch_start',
  'http.request.domain_lookup_start',
  'http.request.domain_lookup_end',
  'http.request.connect_start',
  'http.request.secure_connection_start',
  'http.request.connection_end',
  'http.request.request_start',
  'http.request.response_start',
  'http.request.response_end',
];
const INTERNAL_DATA_KEYS = ['sentry_tags'];
const HIDDEN_DATA_KEYS = [...HTTP_DATA_KEYS, ...INTERNAL_DATA_KEYS];

export const isHiddenDataKey = (key: string) => {
  return HIDDEN_DATA_KEYS.includes(key);
};

const parseSpanTimestamps = (spanBounds: SpanBoundsType): TimestampStatus => {
  const startTimestamp: number = spanBounds.startTimestamp;
  const endTimestamp: number = spanBounds.endTimestamp;

  if (startTimestamp < endTimestamp) {
    return TimestampStatus.STABLE;
  }

  if (startTimestamp === endTimestamp) {
    return TimestampStatus.EQUAL;
  }

  return TimestampStatus.REVERSED;
};

// given the start and end trace timestamps, and the view window, we want to generate a function
// that'll output the relative %'s for the width and placements relative to the left-hand side.
//
// The view window (viewStart and viewEnd) are percentage values (between 0% and 100%), they correspond to the window placement
// between the start and end trace timestamps.
export const boundsGenerator = (bounds: {
  // unix timestamp
  traceEndTimestamp: number;
  traceStartTimestamp: number;
  // in [0, 1]
  viewEnd: number;
  // unix timestamp
  viewStart: number; // in [0, 1]
}) => {
  const {viewStart, viewEnd} = bounds;

  const {startTimestamp: traceStartTimestamp, endTimestamp: traceEndTimestamp} =
    normalizeTimestamps({
      startTimestamp: bounds.traceStartTimestamp,
      endTimestamp: bounds.traceEndTimestamp,
    });

  // viewStart and viewEnd are percentage values (%) of the view window relative to the left
  // side of the trace view minimap

  // invariant: viewStart <= viewEnd

  // duration of the entire trace in seconds
  const traceDuration = traceEndTimestamp - traceStartTimestamp;

  const viewStartTimestamp = traceStartTimestamp + viewStart * traceDuration;
  const viewEndTimestamp = traceEndTimestamp - (1 - viewEnd) * traceDuration;
  const viewDuration = viewEndTimestamp - viewStartTimestamp;

  return (spanBounds: SpanBoundsType): SpanGeneratedBoundsType => {
    // TODO: alberto.... refactor so this is impossible 😠
    if (traceDuration <= 0) {
      return {
        type: 'TRACE_TIMESTAMPS_EQUAL',
        isSpanVisibleInView: true,
      };
    }

    if (viewDuration <= 0) {
      return {
        type: 'INVALID_VIEW_WINDOW',
        isSpanVisibleInView: true,
      };
    }

    const {startTimestamp, endTimestamp} = normalizeTimestamps(spanBounds);

    const timestampStatus = parseSpanTimestamps(spanBounds);

    const start = (startTimestamp - viewStartTimestamp) / viewDuration;
    const end = (endTimestamp - viewStartTimestamp) / viewDuration;

    const isSpanVisibleInView = end > 0 && start < 1;

    switch (timestampStatus) {
      case TimestampStatus.EQUAL: {
        return {
          type: 'TIMESTAMPS_EQUAL',
          start,
          width: 1,
          // a span bar is visible even if they're at the extreme ends of the view selection.
          // these edge cases are:
          // start == end == 0, and
          // start == end == 1
          isSpanVisibleInView: end >= 0 && start <= 1,
        };
      }
      case TimestampStatus.REVERSED: {
        return {
          type: 'TIMESTAMPS_REVERSED',
          start,
          end,
          isSpanVisibleInView,
        };
      }
      case TimestampStatus.STABLE: {
        return {
          type: 'TIMESTAMPS_STABLE',
          start,
          end,
          isSpanVisibleInView,
        };
      }
      default: {
        const _exhaustiveCheck: never = timestampStatus;
        return _exhaustiveCheck;
      }
    }
  };
};

export function generateRootSpan(
  trace: ParsedTraceType
): RawSpanType | AggregateSpanType {
  const rootSpan = {
    trace_id: trace.traceID,
    span_id: trace.rootSpanID,
    parent_span_id: trace.parentSpanID,
    start_timestamp: trace.traceStartTimestamp,
    timestamp: trace.traceEndTimestamp,
    op: trace.op,
    description: trace.description,
    data: {},
    status: trace.rootSpanStatus,
    hash: trace.hash,
    exclusive_time: trace.exclusiveTime,
    count: trace.count,
    frequency: trace.frequency,
    total: trace.total,
  };

  return rootSpan;
}

// start and end are assumed to be unix timestamps with fractional seconds
export function getTraceDateTimeRange(input: {end: number; start: number}): {
  end: string;
  start: string;
} {
  const start = moment
    .unix(input.start)
    .subtract(12, 'hours')
    .utc()
    .format('YYYY-MM-DDTHH:mm:ss.SSS');

  const end = moment
    .unix(input.end)
    .add(12, 'hours')
    .utc()
    .format('YYYY-MM-DDTHH:mm:ss.SSS');

  return {
    start,
    end,
  };
}

function isGapSpan(span: ProcessedSpanType): span is GapSpanType {
  if ('type' in span) {
    return span.type === 'gap';
  }

  return false;
}

export function isOrphanSpan(span: ProcessedSpanType): span is OrphanSpanType {
  if ('type' in span) {
    if (span.type === 'orphan') {
      return true;
    }

    if (span.type === 'gap') {
      return span.isOrphan;
    }
  }

  return false;
}

export function getSpanID(span: ProcessedSpanType, defaultSpanID = ''): string {
  if (isGapSpan(span)) {
    return defaultSpanID;
  }

  return span.span_id;
}

export function getSpanOperation(span: ProcessedSpanType): string | undefined {
  if (isGapSpan(span)) {
    return undefined;
  }

  return span.op;
}

function getSpanParentSpanID(span: ProcessedSpanType): string | undefined {
  if (isGapSpan(span)) {
    return 'gap-span';
  }

  return span.parent_span_id;
}

interface SubTimingDefinition {
  colorLighten: number;
  endMark: SpanSubTimingMark;
  name: string;
  startMark: SpanSubTimingMark;
}

export interface SubTimingInfo extends SubTimingDefinition {
  color: string;
  duration: number;
  endTimestamp: number;
  startTimestamp: number;
}

const SPAN_SUB_TIMINGS: Record<string, SubTimingDefinition[]> = {
  'http.client': [
    {
      startMark: SpanSubTimingMark.SPAN_START,
      endMark: SpanSubTimingMark.HTTP_REQUEST_START,
      name: SpanSubTimingName.WAIT_TIME,
      colorLighten: 0.5,
    },
    {
      startMark: SpanSubTimingMark.HTTP_REQUEST_START,
      endMark: SpanSubTimingMark.HTTP_RESPONSE_START,
      name: SpanSubTimingName.REQUEST_TIME,
      colorLighten: 0.25,
    },
    {
      startMark: SpanSubTimingMark.HTTP_RESPONSE_START,
      endMark: SpanSubTimingMark.SPAN_END,
      name: SpanSubTimingName.RESPONSE_TIME,
      colorLighten: 0,
    },
  ],
};

export function subTimingMarkToTime(span: RawSpanType, mark: SpanSubTimingMark) {
  if (mark === SpanSubTimingMark.SPAN_START) {
    return span.start_timestamp;
  }
  if (mark === SpanSubTimingMark.SPAN_END) {
    return span.timestamp;
  }

  return (span as any).data?.[mark] as number | undefined;
}

export function getSpanSubTimings(
  span: ProcessedSpanType,
  theme: Theme
): SubTimingInfo[] | null {
  if (span.type) {
    return null; // narrow to RawSpanType
  }
  const op = getSpanOperation(span);
  if (!op) {
    return null;
  }
  const timingDefinitions = SPAN_SUB_TIMINGS[op];
  if (!timingDefinitions) {
    return null;
  }

  const timings: SubTimingInfo[] = [];
  const spanStart = subTimingMarkToTime(span, SpanSubTimingMark.SPAN_START);
  const spanEnd = subTimingMarkToTime(span, SpanSubTimingMark.SPAN_END);

  const TEN_MS = 0.001;

  for (const def of timingDefinitions) {
    const start = subTimingMarkToTime(span, def.startMark);
    const end = subTimingMarkToTime(span, def.endMark);
    if (
      !start ||
      !end ||
      !spanStart ||
      !spanEnd ||
      start < spanStart - TEN_MS ||
      end > spanEnd + TEN_MS
    ) {
      return null;
    }
    timings.push({
      ...def,
      duration: end - start,
      startTimestamp: start,
      endTimestamp: end,
      color: lightenBarColor(getSpanOperation(span), def.colorLighten, theme),
    });
  }

  return timings;
}

function getTraceContext(
  event: Readonly<EventTransaction | AggregateEventTransaction>
): TraceContextType | undefined {
  return event?.contexts?.trace;
}

export function parseTrace(
  event: Readonly<EventTransaction | AggregateEventTransaction>
): ParsedTraceType {
  const spanEntry = event.entries.find(
    (entry: EntrySpans | AggregateEntrySpans | any): entry is EntrySpans => {
      return entry.type === EntryType.SPANS;
    }
  );

  const spans: Array<RawSpanType | AggregateSpanType> = spanEntry?.data ?? [];

  const traceContext = getTraceContext(event);
  const traceID = traceContext?.trace_id || '';
  const rootSpanID = traceContext?.span_id || '';
  const rootSpanOpName = traceContext?.op || 'transaction';
  const description = traceContext?.description;
  const parentSpanID = traceContext?.parent_span_id;
  const rootSpanStatus = traceContext?.status;
  const hash = traceContext?.hash;
  const exclusiveTime = traceContext?.exclusive_time;
  const count = traceContext?.count;
  const frequency = traceContext?.frequency;
  const total = traceContext?.total;

  if (!spanEntry || spans.length <= 0) {
    return {
      op: rootSpanOpName,
      childSpans: {},
      traceStartTimestamp: event.startTimestamp,
      traceEndTimestamp: event.endTimestamp,
      traceID,
      rootSpanID,
      rootSpanStatus,
      parentSpanID,
      spans: [],
      description,
      hash,
      exclusiveTime,
      count,
      frequency,
      total,
    };
  }

  // any span may be a parent of another span
  const potentialParents = new Set(
    spans.map(span => {
      return span.span_id;
    })
  );

  // the root transaction span is a parent of all other spans
  potentialParents.add(rootSpanID);

  // we reduce spans to become an object mapping span ids to their children

  const init: ParsedTraceType = {
    op: rootSpanOpName,
    childSpans: {},
    traceStartTimestamp: event.startTimestamp,
    traceEndTimestamp: event.endTimestamp,
    traceID,
    rootSpanID,
    rootSpanStatus,
    parentSpanID,
    spans,
    description,
    hash,
    exclusiveTime,
    count,
    frequency,
    total,
  };

  const reduced: ParsedTraceType = spans.reduce((acc, inputSpan) => {
    let span: SpanType = inputSpan;

    const parentSpanId = getSpanParentSpanID(span);

    const hasParent = parentSpanId && potentialParents.has(parentSpanId);

    if (!isValidSpanID(parentSpanId) || !hasParent) {
      // this span is considered an orphan with respect to the spans within this transaction.
      // although the span is an orphan, it's still a descendant of this transaction,
      // so we set its parent span id to be the root transaction span's id
      span.parent_span_id = rootSpanID;

      span = {
        type: 'orphan',
        ...span,
      } as OrphanSpanType;
    }

    assert(span.parent_span_id);

    // get any span children whose parent_span_id is equal to span.parent_span_id,
    // otherwise start with an empty array
    const spanChildren: SpanType[] = acc.childSpans[span.parent_span_id] ?? [];

    spanChildren.push(span);

    set(acc.childSpans, span.parent_span_id, spanChildren);

    // set trace start & end timestamps based on given span's start and end timestamps

    if (!acc.traceStartTimestamp || span.start_timestamp < acc.traceStartTimestamp) {
      acc.traceStartTimestamp = span.start_timestamp;
    }

    // establish trace end timestamp

    const hasEndTimestamp = isNumber(span.timestamp);

    if (!acc.traceEndTimestamp) {
      if (hasEndTimestamp) {
        acc.traceEndTimestamp = span.timestamp;
        return acc;
      }

      acc.traceEndTimestamp = span.start_timestamp;
      return acc;
    }

    if (hasEndTimestamp && span.timestamp > acc.traceEndTimestamp) {
      acc.traceEndTimestamp = span.timestamp;
      return acc;
    }

    if (span.start_timestamp > acc.traceEndTimestamp) {
      acc.traceEndTimestamp = span.start_timestamp;
    }

    return acc;
  }, init);

  // sort span children

  Object.values(reduced.childSpans).forEach(spanChildren => {
    spanChildren.sort(sortSpans);
  });

  return reduced;
}

function sortSpans(firstSpan: SpanType, secondSpan: SpanType) {
  // orphan spans come after non-orphan spans.

  if (isOrphanSpan(firstSpan) && !isOrphanSpan(secondSpan)) {
    // sort secondSpan before firstSpan
    return 1;
  }

  if (!isOrphanSpan(firstSpan) && isOrphanSpan(secondSpan)) {
    // sort firstSpan before secondSpan
    return -1;
  }

  // sort spans by their start timestamp in ascending order

  if (firstSpan.start_timestamp < secondSpan.start_timestamp) {
    // sort firstSpan before secondSpan
    return -1;
  }

  if (firstSpan.start_timestamp === secondSpan.start_timestamp) {
    return 0;
  }

  // sort secondSpan before firstSpan
  return 1;
}

export function isEventFromBrowserJavaScriptSDK(
  event: EventTransaction | AggregateEventTransaction
): boolean {
  const sdkName = event.sdk?.name;
  if (!sdkName) {
    return false;
  }
  // based on https://github.com/getsentry/sentry-javascript/blob/master/packages/browser/src/version.ts
  return [
    'sentry.javascript.browser',
    'sentry.javascript.react',
    'sentry.javascript.gatsby',
    'sentry.javascript.ember',
    'sentry.javascript.vue',
    'sentry.javascript.angular',
    'sentry.javascript.angular-ivy',
    'sentry.javascript.nextjs',
    'sentry.javascript.electron',
    'sentry.javascript.remix',
    'sentry.javascript.svelte',
    'sentry.javascript.sveltekit',
    'sentry.javascript.astro',
  ].includes(sdkName.toLowerCase());
}

export function getSiblingGroupKey(span: SpanType, occurrence?: number): string {
  if (occurrence !== undefined) {
    return `${span.op}.${span.description}.${occurrence}`;
  }

  return `${span.op}.${span.description}`;
}

/**
 * Formats start and end unix timestamps by inserting a leading and trailing zero if needed, so they can have the same length
 */
export function getFormattedTimeRangeWithLeadingAndTrailingZero(
  start: number,
  end: number
) {
  const startStrings = String(start).split('.');
  const endStrings = String(end).split('.');

  if (startStrings.length !== 2 || endStrings.length !== 2) {
    return {
      start: String(start),
      end: String(end),
    };
  }

  const newTimestamps = startStrings.reduce<{
    end: string[];
    start: string[];
  }>(
    (acc, startString, index) => {
      if (startString.length > endStrings[index]!.length) {
        acc.start.push(startString);
        acc.end.push(
          index === 0
            ? endStrings[index]!.padStart(startString.length, '0')
            : endStrings[index]!.padEnd(startString.length, '0')
        );
        return acc;
      }

      acc.start.push(
        index === 0
          ? startString.padStart(endStrings[index]!.length, '0')
          : startString.padEnd(endStrings[index]!.length, '0')
      );
      acc.end.push(endStrings[index]!);
      return acc;
    },
    {start: [], end: []}
  );

  return {
    start: newTimestamps.start.join('.'),
    end: newTimestamps.end.join('.'),
  };
}

export function groupShouldBeHidden(
  group: SpanTreeModel[],
  focusedSpanIDs: Set<string> | undefined
) {
  if (!focusedSpanIDs) {
    return false;
  }

  // If none of the spans in this group are focused, the group should be hidden
  return !group.some(spanModel => focusedSpanIDs.has(spanModel.span.span_id));
}
