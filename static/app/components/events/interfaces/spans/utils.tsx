import {MouseEvent} from 'react';
import {browserHistory} from 'react-router';
import {Location} from 'history';
import isNumber from 'lodash/isNumber';
import isString from 'lodash/isString';
import set from 'lodash/set';
import moment from 'moment';

import {EntryType, EventTransaction} from 'app/types/event';
import {assert} from 'app/types/utils';
import {WEB_VITAL_DETAILS} from 'app/utils/performance/vitals/constants';

import {
  GapSpanType,
  OrphanSpanType,
  OrphanTreeDepth,
  ParsedTraceType,
  ProcessedSpanType,
  RawSpanType,
  SpanEntry,
  SpanType,
  TraceContextType,
  TreeDepthType,
} from './types';

export const isValidSpanID = (maybeSpanID: any) =>
  isString(maybeSpanID) && maybeSpanID.length > 0;

export type SpanBoundsType = {startTimestamp: number; endTimestamp: number};
export type SpanGeneratedBoundsType =
  | {type: 'TRACE_TIMESTAMPS_EQUAL'; isSpanVisibleInView: boolean}
  | {type: 'INVALID_VIEW_WINDOW'; isSpanVisibleInView: boolean}
  | {
      type: 'TIMESTAMPS_EQUAL';
      start: number;
      width: number;
      isSpanVisibleInView: boolean;
    }
  | {
      type: 'TIMESTAMPS_REVERSED';
      start: number;
      end: number;
      isSpanVisibleInView: boolean;
    }
  | {
      type: 'TIMESTAMPS_STABLE';
      start: number;
      end: number;
      isSpanVisibleInView: boolean;
    };

export type SpanViewBoundsType = {
  warning: undefined | string;
  left: undefined | number;
  width: undefined | number;
  isSpanVisibleInView: boolean;
};

const normalizeTimestamps = (spanBounds: SpanBoundsType): SpanBoundsType => {
  const {startTimestamp, endTimestamp} = spanBounds;

  if (startTimestamp > endTimestamp) {
    return {startTimestamp: endTimestamp, endTimestamp: startTimestamp};
  }

  return spanBounds;
};

export enum TimestampStatus {
  Stable,
  Reversed,
  Equal,
}

export const parseSpanTimestamps = (spanBounds: SpanBoundsType): TimestampStatus => {
  const startTimestamp: number = spanBounds.startTimestamp;
  const endTimestamp: number = spanBounds.endTimestamp;

  if (startTimestamp < endTimestamp) {
    return TimestampStatus.Stable;
  }

  if (startTimestamp === endTimestamp) {
    return TimestampStatus.Equal;
  }

  return TimestampStatus.Reversed;
};

// given the start and end trace timestamps, and the view window, we want to generate a function
// that'll output the relative %'s for the width and placements relative to the left-hand side.
//
// The view window (viewStart and viewEnd) are percentage values (between 0% and 100%), they correspond to the window placement
// between the start and end trace timestamps.
export const boundsGenerator = (bounds: {
  traceStartTimestamp: number; // unix timestamp
  traceEndTimestamp: number; // unix timestamp
  viewStart: number; // in [0, 1]
  viewEnd: number; // in [0, 1]
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
      case TimestampStatus.Equal: {
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
      case TimestampStatus.Reversed: {
        return {
          type: 'TIMESTAMPS_REVERSED',
          start,
          end,
          isSpanVisibleInView,
        };
      }
      case TimestampStatus.Stable: {
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

export function generateRootSpan(trace: ParsedTraceType): RawSpanType {
  const rootSpan: RawSpanType = {
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
  };

  return rootSpan;
}

// start and end are assumed to be unix timestamps with fractional seconds
export function getTraceDateTimeRange(input: {start: number; end: number}): {
  start: string;
  end: string;
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

export function getTraceContext(
  event: Readonly<EventTransaction>
): TraceContextType | undefined {
  return event?.contexts?.trace;
}

export function parseTrace(event: Readonly<EventTransaction>): ParsedTraceType {
  const spanEntry = event.entries.find((entry: SpanEntry | any): entry is SpanEntry => {
    return entry.type === EntryType.SPANS;
  });

  const spans: Array<RawSpanType> = spanEntry?.data ?? [];

  const traceContext = getTraceContext(event);
  const traceID = (traceContext && traceContext.trace_id) || '';
  const rootSpanID = (traceContext && traceContext.span_id) || '';
  const rootSpanOpName = (traceContext && traceContext.op) || 'transaction';
  const description = traceContext && traceContext.description;
  const parentSpanID = traceContext && traceContext.parent_span_id;
  const rootSpanStatus = traceContext && traceContext.status;
  const hash = traceContext && traceContext.hash;
  const exclusiveTime = traceContext && traceContext.exclusive_time;

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

export function isEventFromBrowserJavaScriptSDK(event: EventTransaction): boolean {
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
    'sentry.javascript.nextjs',
  ].includes(sdkName.toLowerCase());
}

// Durationless ops from: https://github.com/getsentry/sentry-javascript/blob/0defcdcc2dfe719343efc359d58c3f90743da2cd/packages/apm/src/integrations/tracing.ts#L629-L688
// PerformanceMark: Duration is 0 as per https://developer.mozilla.org/en-US/docs/Web/API/PerformanceMark
// PerformancePaintTiming: Duration is 0 as per https://developer.mozilla.org/en-US/docs/Web/API/PerformancePaintTiming
export const durationlessBrowserOps = ['mark', 'paint'];

type Measurements = {
  [name: string]: number | undefined;
};

type VerticalMark = {
  marks: Measurements;
  failedThreshold: boolean;
};

function hasFailedThreshold(marks: Measurements): boolean {
  const names = Object.keys(marks);
  const records = Object.values(WEB_VITAL_DETAILS).filter(vital =>
    names.includes(vital.slug)
  );

  return records.some(record => {
    const value = marks[record.slug];
    if (typeof value === 'number' && typeof record.poorThreshold === 'number') {
      return value >= record.poorThreshold;
    }
    return false;
  });
}

export function getMeasurements(event: EventTransaction): Map<number, VerticalMark> {
  if (!event.measurements) {
    return new Map();
  }

  const measurements = Object.keys(event.measurements)
    .filter(name => name.startsWith('mark.'))
    .map(name => {
      const slug = name.slice('mark.'.length);
      const associatedMeasurement = event.measurements![slug];
      return {
        name,
        timestamp: event.measurements![name].value,
        value: associatedMeasurement ? associatedMeasurement.value : undefined,
      };
    });

  const mergedMeasurements = new Map<number, VerticalMark>();

  measurements.forEach(measurement => {
    const name = measurement.name.slice('mark.'.length);
    const value = measurement.value;

    if (mergedMeasurements.has(measurement.timestamp)) {
      const verticalMark = mergedMeasurements.get(measurement.timestamp) as VerticalMark;

      verticalMark.marks = {
        ...verticalMark.marks,
        [name]: value,
      };

      if (!verticalMark.failedThreshold) {
        verticalMark.failedThreshold = hasFailedThreshold(verticalMark.marks);
      }

      mergedMeasurements.set(measurement.timestamp, verticalMark);
      return;
    }

    const marks = {
      [name]: value,
    };

    mergedMeasurements.set(measurement.timestamp, {
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
  location: Location
) {
  return (e: MouseEvent<Element>) => {
    // do not use the default anchor behaviour
    // because it will be hidden behind the minimap
    e.preventDefault();

    const hash = `#span-${spanId}`;

    scrollToHash(hash);

    // TODO(txiao): This is causing a rerender of the whole page,
    // which can be slow.
    //
    // make sure to update the location
    browserHistory.push({
      ...location,
      hash,
    });
  };
}
