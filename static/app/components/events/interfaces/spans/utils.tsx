import {browserHistory} from 'react-router';
import {Location} from 'history';
import isNumber from 'lodash/isNumber';
import isString from 'lodash/isString';
import set from 'lodash/set';
import moment from 'moment';

import {
  TOGGLE_BORDER_BOX,
  TOGGLE_BUTTON_MAX_WIDTH,
} from 'sentry/components/performance/waterfall/treeConnector';
import {EntryType, EventTransaction} from 'sentry/types/event';
import {assert} from 'sentry/types/utils';
import {WEB_VITAL_DETAILS} from 'sentry/utils/performance/vitals/constants';
import {getPerformanceTransaction} from 'sentry/utils/performanceForSentry';

import {MERGE_LABELS_THRESHOLD_PERCENT} from './constants';
import {
  EnhancedSpan,
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

export const setSpansOnTransaction = (spanCount: number) => {
  const transaction = getPerformanceTransaction();

  if (!transaction || spanCount === 0) {
    return;
  }

  const spanCountGroups = [10, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1001];
  const spanGroup = spanCountGroups.find(g => spanCount <= g) || -1;

  transaction.setTag('ui.spanCount', spanCount);
  transaction.setTag('ui.spanCount.grouped', `<=${spanGroup}`);
};

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
    'sentry.javascript.electron',
  ].includes(sdkName.toLowerCase());
}

// Durationless ops from: https://github.com/getsentry/sentry-javascript/blob/0defcdcc2dfe719343efc359d58c3f90743da2cd/packages/apm/src/integrations/tracing.ts#L629-L688
// PerformanceMark: Duration is 0 as per https://developer.mozilla.org/en-US/docs/Web/API/PerformanceMark
// PerformancePaintTiming: Duration is 0 as per https://developer.mozilla.org/en-US/docs/Web/API/PerformancePaintTiming
export const durationlessBrowserOps = ['mark', 'paint'];

type Measurements = {
  [name: string]: {
    timestamp: number;
    value: number | undefined;
  };
};

type VerticalMark = {
  failedThreshold: boolean;
  marks: Measurements;
};

function hasFailedThreshold(marks: Measurements): boolean {
  const names = Object.keys(marks);
  const records = Object.values(WEB_VITAL_DETAILS).filter(vital =>
    names.includes(vital.slug)
  );

  return records.some(record => {
    const {value} = marks[record.slug];
    if (typeof value === 'number' && typeof record.poorThreshold === 'number') {
      return value >= record.poorThreshold;
    }
    return false;
  });
}

export function getMeasurements(
  event: EventTransaction,
  generateBounds: (bounds: SpanBoundsType) => SpanGeneratedBoundsType
): Map<number, VerticalMark> {
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

        verticalMark.marks = {
          ...verticalMark.marks,
          [name]: {
            value,
            timestamp: measurement.timestamp,
          },
        };

        if (!verticalMark.failedThreshold) {
          verticalMark.failedThreshold = hasFailedThreshold(verticalMark.marks);
        }

        mergedMeasurements.set(otherPos, verticalMark);
        return;
      }
    }

    const marks = {
      [name]: {value, timestamp: measurement.timestamp},
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
  location: Location
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
  };
}

export function spanTargetHash(spanId: string): string {
  return `#span-${spanId}`;
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
      startTimestamp: spanGroup[0].span.start_timestamp,
      endTimestamp: spanGroup[0].span.timestamp,
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

export class SpansInViewMap {
  spanDepthsInView: Map<string, number>;
  treeDepthSum: number;
  length: number;
  isRootSpanInView: boolean;

  constructor() {
    this.spanDepthsInView = new Map();
    this.treeDepthSum = 0;
    this.length = 0;
    this.isRootSpanInView = true;
  }

  /**
   *
   * @param spanId
   * @param treeDepth
   * @returns false if the span is already stored, true otherwise
   */
  addSpan(spanId: string, treeDepth: number): boolean {
    if (this.spanDepthsInView.has(spanId)) {
      return false;
    }

    this.spanDepthsInView.set(spanId, treeDepth);
    this.length += 1;
    this.treeDepthSum += treeDepth;

    if (treeDepth === 0) {
      this.isRootSpanInView = true;
    }

    return true;
  }

  /**
   *
   * @param spanId
   * @returns false if the span does not exist within the span, true otherwise
   */
  removeSpan(spanId: string): boolean {
    if (!this.spanDepthsInView.has(spanId)) {
      return false;
    }

    const treeDepth = this.spanDepthsInView.get(spanId);
    this.spanDepthsInView.delete(spanId);
    this.length -= 1;
    this.treeDepthSum -= treeDepth!;

    if (treeDepth === 0) {
      this.isRootSpanInView = false;
    }

    return true;
  }

  getScrollVal() {
    if (this.isRootSpanInView) {
      return 0;
    }

    const avgDepth = Math.round(this.treeDepthSum / this.length);
    return avgDepth * (TOGGLE_BORDER_BOX / 2) - TOGGLE_BUTTON_MAX_WIDTH / 2;
  }
}
