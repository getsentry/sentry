import {isString, isNumber} from 'lodash';

import {SpanType} from './types';

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
  const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

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

export const rectOfViewport = (): Rect => {
  return {
    x: window.pageXOffset,
    y: window.pageYOffset,
    width: window.document.documentElement.clientWidth,
    height: window.document.documentElement.clientHeight,
  };
};

export const rectRelativeTo = (rect: Rect, pos = {x: 0, y: 0}): Rect => {
  return {
    x: rect.x - pos.x,
    y: rect.y - pos.y,
    width: rect.width,
    height: rect.height,
  };
};

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

export const isValidSpanID = (maybeSpanID: any) => {
  return isString(maybeSpanID) && maybeSpanID.length > 0;
};

export const toPercent = (value: number) => {
  return `${(value * 100).toFixed(3)}%`;
};

export type SpanBoundsType = {startTimestamp: number; endTimestamp: number};
export type SpanGeneratedBoundsType = {start: number; end: number};

const normalizeTimestamps = (spanBounds: SpanBoundsType): SpanBoundsType => {
  const {startTimestamp, endTimestamp} = spanBounds;

  if (startTimestamp > endTimestamp) {
    return {startTimestamp: endTimestamp, endTimestamp: startTimestamp};
  }

  return spanBounds;
};

export const boundsGenerator = (bounds: {
  traceStartTimestamp: number;
  traceEndTimestamp: number;
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
  const viewWindowInvariant = viewStart <= viewEnd;

  // duration of the entire trace in seconds
  const duration = traceEndTimestamp - traceStartTimestamp;

  const viewStartTimestamp = traceStartTimestamp + viewStart * duration;
  const viewEndTimestamp = traceEndTimestamp - (1 - viewEnd) * duration;
  const viewDuration = viewEndTimestamp - viewStartTimestamp;

  return (spanBounds: SpanBoundsType): SpanGeneratedBoundsType => {
    if (!viewWindowInvariant || duration <= 0 || viewDuration <= 0) {
      return {
        start: 0,
        end: 1,
      };
    }

    const {startTimestamp, endTimestamp} = normalizeTimestamps(spanBounds);

    if (endTimestamp - startTimestamp <= 0) {
      return {
        start: 0,
        end: 1,
      };
    }

    const start = (startTimestamp - viewStartTimestamp) / viewDuration;

    if (!isNumber(endTimestamp)) {
      return {
        start,
        end: 1,
      };
    }

    return {
      start,
      end: (endTimestamp - viewStartTimestamp) / viewDuration,
    };
  };
};

export const getHumanDuration = (duration: number): string => {
  // note: duration is assumed to be in seconds

  const durationMS = duration * 1000;
  return `${durationMS.toFixed(3)} ms`;
};

export const generateSpanColourPicker = () => {
  const COLORS = ['#8B7FD7', '#F2BE7C', '#ffe066', '#74c0fc'];
  let current_index = 0;

  const pickSpanBarColour = () => {
    const next_colour = COLORS[current_index];

    current_index++;
    current_index = current_index % COLORS.length;

    return next_colour;
  };

  return pickSpanBarColour;
};

export enum TimestampStatus {
  Stable,
  Reversed,
  Equal,
}

export const parseSpanTimestamps = (span: SpanType): TimestampStatus => {
  const startTimestamp: number = span.start_timestamp;
  const endTimestamp: number = span.timestamp;

  if (startTimestamp < endTimestamp) {
    return TimestampStatus.Stable;
  }

  if (startTimestamp === endTimestamp) {
    return TimestampStatus.Equal;
  }

  return TimestampStatus.Reversed;
};
