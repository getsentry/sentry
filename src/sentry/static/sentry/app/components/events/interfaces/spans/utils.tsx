import isString from 'lodash/isString';
import moment from 'moment';
import set from 'lodash/set';
import isNumber from 'lodash/isNumber';

import {SentryTransactionEvent} from 'app/types';
import {assert} from 'app/types/utils';
import CHART_PALETTE from 'app/constants/chartPalette';

import {
  ParsedTraceType,
  ProcessedSpanType,
  GapSpanType,
  RawSpanType,
  OrphanSpanType,
  SpanType,
  SpanEntry,
  TraceContextType,
  TreeDepthType,
  OrphanTreeDepth,
} from './types';

type Rect = {
  // x and y are left/top coords respectively
  x: number;
  y: number;
  width: number;
  height: number;
};

// get position of element relative to top/left of document
const getOffsetOfElement = (element: Element) => {
  // left and top are relative to viewport
  const {left, top} = element.getBoundingClientRect();

  // get values that the document is currently scrolled by
  const scrollLeft = window.pageXOffset;
  const scrollTop = window.pageYOffset;

  return {x: left + scrollLeft, y: top + scrollTop};
};

export const rectOfContent = (element: Element): Rect => {
  const {x, y} = getOffsetOfElement(element);

  // offsets for the border and any scrollbars (clientLeft and clientTop),
  // and if the element was scrolled (scrollLeft and scrollTop)
  //
  // NOTE: clientLeft and clientTop does not account for any margins nor padding
  const contentOffsetLeft = element.clientLeft - element.scrollLeft;
  const contentOffsetTop = element.clientTop - element.scrollTop;

  return {
    x: x + contentOffsetLeft,
    y: y + contentOffsetTop,
    width: element.scrollWidth,
    height: element.scrollHeight,
  };
};

export const rectOfViewport = (): Rect => ({
  x: window.pageXOffset,
  y: window.pageYOffset,
  width: window.document.documentElement.clientWidth,
  height: window.document.documentElement.clientHeight,
});

export const rectRelativeTo = (rect: Rect, pos = {x: 0, y: 0}): Rect => ({
  x: rect.x - pos.x,
  y: rect.y - pos.y,
  width: rect.width,
  height: rect.height,
});

export const rectOfElement = (element: HTMLElement): Rect => {
  const {x, y} = getOffsetOfElement(element);
  return {
    x,
    y,
    width: element.offsetWidth,
    height: element.offsetHeight,
  };
};

export const clamp = (value: number, min: number, max: number): number => {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
};

export const isValidSpanID = (maybeSpanID: any) =>
  isString(maybeSpanID) && maybeSpanID.length > 0;

export const toPercent = (value: number) => `${(value * 100).toFixed(3)}%`;

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

  const {
    startTimestamp: traceStartTimestamp,
    endTimestamp: traceEndTimestamp,
  } = normalizeTimestamps({
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

export const getHumanDuration = (duration: number): string => {
  // note: duration is assumed to be in seconds

  const durationMS = duration * 1000;
  return `${durationMS.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}ms`;
};

const getLetterIndex = (letter: string): number => {
  const index = 'abcdefghijklmnopqrstuvwxyz'.indexOf(letter) || 0;
  return index === -1 ? 0 : index;
};

const colorsAsArray = Object.keys(CHART_PALETTE).map(key => CHART_PALETTE[17][key]);

export const spanColors = {
  default: CHART_PALETTE[17][4],
  transaction: CHART_PALETTE[17][8],
  http: CHART_PALETTE[17][10],
  db: CHART_PALETTE[17][17],
};

export const pickSpanBarColour = (input: string | undefined): string => {
  // We pick the color for span bars using the first three letters of the op name.
  // That way colors stay consistent between transactions.

  if (!input || input.length < 3) {
    return CHART_PALETTE[17][4];
  }

  if (spanColors[input]) {
    return spanColors[input];
  }

  const letterIndex1 = getLetterIndex(input.slice(0, 1));
  const letterIndex2 = getLetterIndex(input.slice(1, 2));
  const letterIndex3 = getLetterIndex(input.slice(2, 3));

  return colorsAsArray[
    (letterIndex1 + letterIndex2 + letterIndex3) % colorsAsArray.length
  ];
};

export type UserSelectValues = {
  userSelect: string | null;
  MozUserSelect: string | null;
  msUserSelect: string | null;
  webkitUserSelect: string | null;
};

export const setBodyUserSelect = (nextValues: UserSelectValues): UserSelectValues => {
  // NOTE: Vendor prefixes other than `ms` should begin with a capital letter.
  // ref: https://reactjs.org/docs/dom-elements.html#style

  const previousValues = {
    userSelect: document.body.style.userSelect,
    // MozUserSelect is not typed in TS
    // @ts-ignore
    MozUserSelect: document.body.style.MozUserSelect,
    // msUserSelect is not typed in TS
    // @ts-ignore
    msUserSelect: document.body.style.msUserSelect,
    webkitUserSelect: document.body.style.webkitUserSelect,
  };

  document.body.style.userSelect = nextValues.userSelect || '';
  // MozUserSelect is not typed in TS
  // @ts-ignore
  document.body.style.MozUserSelect = nextValues.MozUserSelect || '';
  // msUserSelect is not typed in TS
  // @ts-ignore
  document.body.style.msUserSelect = nextValues.msUserSelect || '';
  document.body.style.webkitUserSelect = nextValues.webkitUserSelect || '';

  return previousValues;
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
  };

  return rootSpan;
}

// start and end are assumed to be unix timestamps with fractional seconds
export function getTraceDateTimeRange(input: {
  start: number;
  end: number;
}): {start: string; end: string} {
  const start = moment
    .unix(input.start)
    .subtract(12, 'hours')
    .format('YYYY-MM-DDTHH:mm:ss.SSS');

  const end = moment
    .unix(input.end)
    .add(12, 'hours')
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
  event: Readonly<SentryTransactionEvent>
): TraceContextType | undefined {
  return event?.contexts?.trace;
}

export function parseTrace(event: Readonly<SentryTransactionEvent>): ParsedTraceType {
  const spanEntry: SpanEntry | undefined = event.entries.find(
    (entry: {type: string}) => entry.type === 'spans'
  );

  const spans: Array<RawSpanType> = spanEntry?.data ?? [];

  const traceContext = getTraceContext(event);
  const traceID = (traceContext && traceContext.trace_id) || '';
  const rootSpanID = (traceContext && traceContext.span_id) || '';
  const rootSpanOpName = (traceContext && traceContext.op) || 'transaction';
  const description = traceContext && traceContext.description;
  const parentSpanID = traceContext && traceContext.parent_span_id;
  const rootSpanStatus = traceContext && traceContext.status;

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
      numOfSpans: 0,
      spans: [],
      description,
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
    numOfSpans: spans.length,
    spans,
    description,
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
  // orphan spans come after non-ophan spans.

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

export function isEventFromBrowserJavaScriptSDK(event: SentryTransactionEvent): boolean {
  const sdkName = event.sdk?.name;
  if (!sdkName) {
    return false;
  }
  // based on https://github.com/getsentry/sentry-javascript/blob/master/packages/browser/src/version.ts
  return [
    'sentry.javascript.browser',
    'sentry.javascript.react',
    'sentry.javascript.gatsby',
  ].includes(sdkName.toLowerCase());
}

// Durationless ops from: https://github.com/getsentry/sentry-javascript/blob/0defcdcc2dfe719343efc359d58c3f90743da2cd/packages/apm/src/integrations/tracing.ts#L629-L688
// PerformanceMark: Duration is 0 as per https://developer.mozilla.org/en-US/docs/Web/API/PerformanceMark
// PerformancePaintTiming: Duration is 0 as per https://developer.mozilla.org/en-US/docs/Web/API/PerformancePaintTiming
export const durationlessBrowserOps = ['mark', 'paint'];
