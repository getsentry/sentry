import {isString} from 'lodash';

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

// given the start and end trace timstamps, and the view window, we want to generate a function
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
          isSpanVisibleInView,
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
  return `${durationMS.toFixed(3)} ms`;
};

const COLORS = [
  // row 1

  // '#1E1F33',
  // '#382947',
  // '#522E4B',
  // '#833054',
  // '#AF2C41',
  // '#98361B',
  // '#C36609',
  // '#967108',

  // row 2

  // '#444674',
  // '#694E86',
  // '#955389',
  // '#C15584',
  // '#E65D73',
  // '#F27A58',
  // '#F6983B',
  // '#F2B712',

  // row 3

  '#7274AC',
  '#9D85B8',
  '#BF8CB6',
  '#CF7CA0',
  '#ED8898',
  '#F6A189',
  '#F8B26D',
  '#F7D36E',

  // reverse fade of row 3

  '#F8B26D',
  '#F6A189',
  '#ED8898',
  '#CF7CA0',
  '#BF8CB6',
  '#9D85B8',
];
export const pickSpanBarColour = (input: number): string => {
  // TODO: idea: map parts of the string (which is already random) to colours
  // const firstThreeChars = input.substring(0, 3);
  // const lastThreeChars = input.substring(input.length - 3);

  // const num = (firstThreeChars + lastThreeChars).split('').reduce((sum, char) => {
  //   const charCode = char.charCodeAt(0);
  //   return sum + (isFinite(charCode) ? charCode : 0);
  // }, 0);

  const index = input % COLORS.length;

  return COLORS[index];
};

export type UserSelectValues = {
  userSelect: string | null;
  MozUserSelect: string | null;
  msUserSelect: string | null;
};

export const setBodyUserSelect = (nextValues: UserSelectValues): UserSelectValues => {
  // NOTE: Vendor prefixes other than `ms` should begin with a capital letter.
  // ref: https://reactjs.org/docs/dom-elements.html#style

  const previousValues = {
    userSelect: document.body.style.userSelect,
    // MozUserSelect is not typed in TS
    // @ts-ignore
    MozUserSelect: document.body.style.MozUserSelect,
    msUserSelect: document.body.style.msUserSelect,
  };

  document.body.style.userSelect = nextValues.userSelect;
  // MozUserSelect is not typed in TS
  // @ts-ignore
  document.body.style.MozUserSelect = nextValues.MozUserSelect;
  document.body.style.msUserSelect = nextValues.msUserSelect;

  return previousValues;
};
