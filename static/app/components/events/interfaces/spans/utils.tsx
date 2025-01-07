import type {Theme} from '@emotion/react';
import type {Location} from 'history';
import isNumber from 'lodash/isNumber';
import maxBy from 'lodash/maxBy';
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
import type {Organization} from 'sentry/types/organization';
import {assert} from 'sentry/types/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {browserHistory} from 'sentry/utils/browserHistory';
import {MobileVital, WebVital} from 'sentry/utils/fields';
import type {
  TraceError,
  TraceFullDetailed,
} from 'sentry/utils/performance/quickTrace/types';
import {VITAL_DETAILS} from 'sentry/utils/performance/vitals/constants';

import {MERGE_LABELS_THRESHOLD_PERCENT} from './constants';
import type SpanTreeModel from './spanTreeModel';
import type {
  AggregateSpanType,
  EnhancedSpan,
  GapSpanType,
  OrphanSpanType,
  OrphanTreeDepth,
  ParsedTraceType,
  ProcessedSpanType,
  RawSpanType,
  SpanType,
  TraceContextType,
  TreeDepthType,
} from './types';

export const isValidSpanID = (maybeSpanID: any) =>
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

export type SpanViewBoundsType = {
  isSpanVisibleInView: boolean;
  left: undefined | number;
  warning: undefined | string;
  width: undefined | number;
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

const TIMING_DATA_KEYS = [
  SpanSubTimingMark.HTTP_REQUEST_START,
  SpanSubTimingMark.HTTP_RESPONSE_START,
];
export const isSpanDataKeyTiming = (key: string) => {
  return TIMING_DATA_KEYS.includes(key as SpanSubTimingMark);
};
export const isHiddenDataKey = (key: string) => {
  return HIDDEN_DATA_KEYS.includes(key);
};

/**
 * Affected spans (hatching when spans have errors) may only apply to a sub timing,
 * as is the case for http overhead issues (only time before the request start matters)..
 */
export const shouldLimitAffectedToTiming = (timing: SubTimingInfo) => {
  return timing.endMark === SpanSubTimingMark.HTTP_REQUEST_START; // Sub timing spanning between start and request start.
};

export const parseSpanTimestamps = (spanBounds: SpanBoundsType): TimestampStatus => {
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

export function isGapSpan(span: ProcessedSpanType): span is GapSpanType {
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

export function getSpanID(span: ProcessedSpanType, defaultSpanID: string = ''): string {
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

export function getSpanTraceID(span: ProcessedSpanType): string {
  if (isGapSpan(span)) {
    return 'gap-span';
  }

  return span.trace_id;
}

export function getSpanParentSpanID(span: ProcessedSpanType): string | undefined {
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

export function getSpanSubTimings(span: ProcessedSpanType): SubTimingInfo[] | null {
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
      color: lightenBarColor(getSpanOperation(span), def.colorLighten),
    });
  }

  return timings;
}

export function formatSpanTreeLabel(span: ProcessedSpanType): string | undefined {
  const label = span?.description ?? getSpanID(span);

  if (!isGapSpan(span)) {
    if (span.op === 'http.client') {
      try {
        return decodeURIComponent(label);
      } catch {
        // Do nothing
      }
    }
  }

  return label;
}

export function getTraceContext(
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
    const spanChildren: Array<SpanType> = acc.childSpans[span.parent_span_id] ?? [];

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

    if (hasEndTimestamp && span.timestamp! > acc.traceEndTimestamp) {
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

export function isOrphanTreeDepth(
  treeDepth: TreeDepthType
): treeDepth is OrphanTreeDepth {
  if (typeof treeDepth === 'number') {
    return false;
  }
  return treeDepth?.type === 'orphan';
}

export function unwrapTreeDepth(treeDepth: TreeDepthType): number {
  if (isOrphanTreeDepth(treeDepth)) {
    return treeDepth.depth;
  }

  return treeDepth;
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

// Durationless ops from: https://github.com/getsentry/sentry-javascript/blob/0defcdcc2dfe719343efc359d58c3f90743da2cd/packages/apm/src/integrations/tracing.ts#L629-L688
// PerformanceMark: Duration is 0 as per https://developer.mozilla.org/en-US/docs/Web/API/PerformanceMark
// PerformancePaintTiming: Duration is 0 as per https://developer.mozilla.org/en-US/docs/Web/API/PerformancePaintTiming
export const durationlessBrowserOps = ['mark', 'paint'];

type Measurements = {
  [name: string]: {
    failedThreshold: boolean;
    timestamp: number;
    value: number | undefined;
  };
};

export type VerticalMark = {
  failedThreshold: boolean;
  marks: Measurements;
};

function hasFailedThreshold(marks: Measurements): boolean {
  const names = Object.keys(marks);
  const records = Object.values(VITAL_DETAILS).filter(vital =>
    names.includes(vital.slug)
  );

  return records.some(record => {
    const {value} = marks[record.slug]!;
    if (typeof value === 'number' && typeof record.poorThreshold === 'number') {
      return value >= record.poorThreshold;
    }
    return false;
  });
}

export function getMeasurements(
  event: EventTransaction | TraceFullDetailed | AggregateEventTransaction,
  generateBounds: (bounds: SpanBoundsType) => SpanGeneratedBoundsType
): Map<number, VerticalMark> {
  const startTimestamp =
    (event as EventTransaction).startTimestamp ||
    (event as TraceFullDetailed).start_timestamp;
  if (!event.measurements || !startTimestamp) {
    return new Map();
  }

  // Note: CLS and INP should not be included here, since they are not timeline-based measurements.
  const allowedVitals = new Set<string>([
    WebVital.FCP,
    WebVital.FP,
    WebVital.FID,
    WebVital.LCP,
    WebVital.TTFB,
    MobileVital.TIME_TO_FULL_DISPLAY,
    MobileVital.TIME_TO_INITIAL_DISPLAY,
  ]);

  const measurements = Object.keys(event.measurements)
    .filter(name => allowedVitals.has(`measurements.${name}`))
    .map(name => {
      const associatedMeasurement = event.measurements![name]!;
      return {
        name,
        // Time timestamp is in seconds, but the measurement value is given in ms so convert it here
        timestamp: startTimestamp + associatedMeasurement.value / 1000,
        value: associatedMeasurement ? associatedMeasurement.value : undefined,
      };
    });

  const mergedMeasurements = new Map<number, VerticalMark>();

  measurements.forEach(measurement => {
    const name = measurement.name;
    const value = measurement.value;

    const bounds = generateBounds({
      startTimestamp: measurement.timestamp,
      endTimestamp: measurement.timestamp,
    });

    // This condition will never be hit, since we're using the same value for start and end in generateBounds
    // I've put this condition here to prevent the TS linter from complaining
    if (bounds.type !== 'TIMESTAMPS_EQUAL') {
      return;
    }

    const roundedPos = Math.round(bounds.start * 100);

    // Compare this position with the position of the other measurements, to determine if
    // they are close enough to be bucketed together

    for (const [otherPos] of mergedMeasurements) {
      const positionDelta = Math.abs(otherPos - roundedPos);
      if (positionDelta <= MERGE_LABELS_THRESHOLD_PERCENT) {
        const verticalMark = mergedMeasurements.get(otherPos)!;

        const {poorThreshold} = VITAL_DETAILS[`measurements.${name}`];

        verticalMark.marks = {
          ...verticalMark.marks,
          [name]: {
            value,
            timestamp: measurement.timestamp,
            failedThreshold: value ? value >= poorThreshold : false,
          },
        };

        if (!verticalMark.failedThreshold) {
          verticalMark.failedThreshold = hasFailedThreshold(verticalMark.marks);
        }

        mergedMeasurements.set(otherPos, verticalMark);
        return;
      }
    }

    const {poorThreshold} = VITAL_DETAILS[`measurements.${name}`];

    const marks = {
      [name]: {
        value,
        timestamp: measurement.timestamp,
        failedThreshold: value ? value >= poorThreshold : false,
      },
    };

    mergedMeasurements.set(roundedPos, {
      marks,
      failedThreshold: hasFailedThreshold(marks),
    });
  });

  return mergedMeasurements;
}

export function getMeasurementBounds(
  timestamp: number,
  generateBounds: (bounds: SpanBoundsType) => SpanGeneratedBoundsType
): SpanViewBoundsType {
  const bounds = generateBounds({
    startTimestamp: timestamp,
    endTimestamp: timestamp,
  });

  switch (bounds.type) {
    case 'TRACE_TIMESTAMPS_EQUAL':
    case 'INVALID_VIEW_WINDOW': {
      return {
        warning: undefined,
        left: undefined,
        width: undefined,
        isSpanVisibleInView: bounds.isSpanVisibleInView,
      };
    }
    case 'TIMESTAMPS_EQUAL': {
      return {
        warning: undefined,
        left: bounds.start,
        width: 0.00001,
        isSpanVisibleInView: bounds.isSpanVisibleInView,
      };
    }
    case 'TIMESTAMPS_REVERSED': {
      return {
        warning: undefined,
        left: bounds.start,
        width: bounds.end - bounds.start,
        isSpanVisibleInView: bounds.isSpanVisibleInView,
      };
    }
    case 'TIMESTAMPS_STABLE': {
      return {
        warning: void 0,
        left: bounds.start,
        width: bounds.end - bounds.start,
        isSpanVisibleInView: bounds.isSpanVisibleInView,
      };
    }
    default: {
      const _exhaustiveCheck: never = bounds;
      return _exhaustiveCheck;
    }
  }
}

export function scrollToSpan(
  spanId: string,
  scrollToHash: (hash: string) => void,
  location: Location,
  organization: Organization
) {
  return (e: React.MouseEvent<Element>) => {
    // do not use the default anchor behaviour
    // because it will be hidden behind the minimap
    e.preventDefault();

    const hash = spanTargetHash(spanId);

    scrollToHash(hash);

    // TODO(txiao): This is causing a rerender of the whole page,
    // which can be slow.
    //
    // make sure to update the location
    browserHistory.push({
      ...location,
      hash,
    });

    trackAnalytics('performance_views.event_details.anchor_span', {
      organization,
      span_id: spanId,
    });
  };
}

type TraceDetailsHashIds = {
  eventId: string | undefined;
  spanId: string | undefined;
};

export function parseTraceDetailsURLHash(hash: string): TraceDetailsHashIds | null {
  if (!hash) {
    return null;
  }

  const values = hash.split('#').slice(1);
  const eventId = values.find(value => value.includes('txn'))?.split('-')[1];
  const spanId = values.find(value => value.includes('span'))?.split('-')[1];

  return {
    eventId,
    spanId,
  };
}

export function spanTargetHash(spanId: string): string {
  return `#span-${spanId}`;
}

export function transactionTargetHash(spanId: string): string {
  return `#txn-${spanId}`;
}

export function getSiblingGroupKey(span: SpanType, occurrence?: number): string {
  if (occurrence !== undefined) {
    return `${span.op}.${span.description}.${occurrence}`;
  }

  return `${span.op}.${span.description}`;
}

export function getSpanGroupTimestamps(spanGroup: EnhancedSpan[]) {
  return spanGroup.reduce(
    (acc, spanGroupItem) => {
      const {start_timestamp, timestamp} = spanGroupItem.span;

      let newStartTimestamp = acc.startTimestamp;
      let newEndTimestamp = acc.endTimestamp;

      if (start_timestamp < newStartTimestamp) {
        newStartTimestamp = start_timestamp;
      }

      if (newEndTimestamp < timestamp) {
        newEndTimestamp = timestamp;
      }

      return {
        startTimestamp: newStartTimestamp,
        endTimestamp: newEndTimestamp,
      };
    },
    {
      startTimestamp: spanGroup[0]!.span.start_timestamp,
      endTimestamp: spanGroup[0]!.span.timestamp,
    }
  );
}

export function getSpanGroupBounds(
  spanGroup: EnhancedSpan[],
  generateBounds: (bounds: SpanBoundsType) => SpanGeneratedBoundsType
): SpanViewBoundsType {
  const {startTimestamp, endTimestamp} = getSpanGroupTimestamps(spanGroup);

  const bounds = generateBounds({
    startTimestamp,
    endTimestamp,
  });

  switch (bounds.type) {
    case 'TRACE_TIMESTAMPS_EQUAL':
    case 'INVALID_VIEW_WINDOW': {
      return {
        warning: void 0,
        left: void 0,
        width: void 0,
        isSpanVisibleInView: bounds.isSpanVisibleInView,
      };
    }
    case 'TIMESTAMPS_EQUAL': {
      return {
        warning: void 0,
        left: bounds.start,
        width: 0.00001,
        isSpanVisibleInView: bounds.isSpanVisibleInView,
      };
    }
    case 'TIMESTAMPS_REVERSED':
    case 'TIMESTAMPS_STABLE': {
      return {
        warning: void 0,
        left: bounds.start,
        width: bounds.end - bounds.start,
        isSpanVisibleInView: bounds.isSpanVisibleInView,
      };
    }
    default: {
      const _exhaustiveCheck: never = bounds;
      return _exhaustiveCheck;
    }
  }
}

export function getCumulativeAlertLevelFromErrors(
  errors?: Pick<TraceError, 'level' | 'type'>[]
): keyof Theme['alert'] | undefined {
  const highestErrorLevel = maxBy(
    errors || [],
    error => ERROR_LEVEL_WEIGHTS[error.level]
  )?.level;

  if (errors?.some(isErrorPerformanceError)) {
    return 'error';
  }

  if (!highestErrorLevel) {
    return undefined;
  }

  return ERROR_LEVEL_TO_ALERT_TYPE[highestErrorLevel];
}

export function isErrorPerformanceError(error: {type?: number}): boolean {
  return !!error.type && error.type >= 1000 && error.type < 2000;
}

// Maps the known error levels to an Alert component types
const ERROR_LEVEL_TO_ALERT_TYPE: Record<TraceError['level'], keyof Theme['alert']> = {
  fatal: 'error',
  error: 'error',
  default: 'error',
  warning: 'warning',
  sample: 'info',
  info: 'info',
  unknown: 'muted',
};

// Allows sorting errors according to their level of severity
const ERROR_LEVEL_WEIGHTS: Record<TraceError['level'], number> = {
  fatal: 5,
  error: 4,
  default: 4,
  warning: 3,
  sample: 2,
  info: 1,
  unknown: 0,
};

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
