import {isString, isNumber} from 'lodash';

const Rect = (x: number, y: number, width: number, height: number) => {
  // x and y are left/top coords respectively
  return {x, y, width, height};
};

// get position of element relative to top/left of document
const getOffsetOfElement = (element: HTMLElement) => {
  // left and top are relative to viewport
  const {left, top} = element.getBoundingClientRect();

  // get values that the document is currently scrolled by
  const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

  return {x: left + scrollLeft, y: top + scrollTop};
};

export const rectOfContent = (element: HTMLElement) => {
  const {x, y} = getOffsetOfElement(element);

  // offsets for the border and any scrollbars (clientLeft and clientTop),
  // and if the element was scrolled (scrollLeft and scrollTop)
  //
  // NOTE: clientLeft and clientTop does not account for any margins nor padding
  const contentOffsetLeft = element.clientLeft - element.scrollLeft;
  const contentOffsetTop = element.clientTop - element.scrollTop;

  return Rect(
    x + contentOffsetLeft,
    y + contentOffsetTop,
    element.scrollWidth,
    element.scrollHeight
  );
};

export const rectRelativeTo = (
  rect: {x: number; y: number; width: number; height: number},
  pos = {x: 0, y: 0}
) => {
  return Rect(rect.x - pos.x, rect.y - pos.y, rect.width, rect.height);
};

export const rectOfElement = (element: HTMLElement) => {
  const {x, y} = getOffsetOfElement(element);
  return Rect(x, y, element.offsetWidth, element.offsetHeight);
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

export const boundsGenerator = (bounds: {
  traceStartTimestamp: number;
  traceEndTimestamp: number;
  viewStart: number; // in [0, 1]
  viewEnd: number; // in [0, 1]
}) => {
  const {traceEndTimestamp, traceStartTimestamp, viewStart, viewEnd} = bounds;

  // viewStart and viewEnd are percentage values (%) of the view window relative to the left
  // side of the trace view minimap

  // invariant: viewStart <= viewEnd

  // duration of the entire trace in seconds
  const duration = traceEndTimestamp - traceStartTimestamp;

  const viewStartTimestamp = traceStartTimestamp + viewStart * duration;
  const viewEndTimestamp = traceEndTimestamp - (1 - viewEnd) * duration;
  const viewDuration = viewEndTimestamp - viewStartTimestamp;

  return (spanBounds: SpanBoundsType): SpanGeneratedBoundsType => {
    const {startTimestamp, endTimestamp} = spanBounds;

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
