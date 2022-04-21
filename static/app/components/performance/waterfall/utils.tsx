import {DurationDisplay} from 'sentry/components/performance/waterfall/types';
import CHART_PALETTE from 'sentry/constants/chartPalette';
import space from 'sentry/styles/space';
import {Theme} from 'sentry/utils/theme';

export const getBackgroundColor = ({
  showStriping,
  showDetail,
  theme,
}: {
  theme: Theme;
  showDetail?: boolean;
  showStriping?: boolean;
}) => {
  if (showDetail) {
    return theme.textColor;
  }

  if (showStriping) {
    return theme.backgroundSecondary;
  }

  return theme.background;
};

type HatchProps = {
  spanBarHatch: boolean;
};

export function getHatchPattern(
  {spanBarHatch}: HatchProps,
  primary: string,
  alternate: string
) {
  if (spanBarHatch === true) {
    return `
      background-image: linear-gradient(135deg,
        ${alternate},
        ${alternate} 2.5px,
        ${primary} 2.5px,
        ${primary} 5px,
        ${alternate} 6px,
        ${alternate} 8px,
        ${primary} 8px,
        ${primary} 11px,
        ${alternate} 11px,
        ${alternate} 14px,
        ${primary} 14px,
        ${primary} 16.5px,
        ${alternate} 16.5px,
        ${alternate} 19px,
        ${primary} 20px
      );
      background-size: 16px 16px;
    `;
  }

  return null;
}

export const getDurationPillAlignment = ({
  durationDisplay,
  theme,
  spanBarHatch,
}: {
  durationDisplay: DurationDisplay;
  spanBarHatch: boolean;
  theme: Theme;
}) => {
  switch (durationDisplay) {
    case 'left':
      return `right: calc(100% + ${space(0.5)});`;
    case 'right':
      return `left: calc(100% + ${space(0.75)});`;
    default:
      return `
        right: ${space(0.75)};
        color: ${spanBarHatch === true ? theme.gray300 : theme.white};
      `;
  }
};

export const getToggleTheme = ({
  theme,
  isExpanded,
  disabled,
  errored,
  isSpanGroupToggler,
}: {
  disabled: boolean;
  errored: boolean;
  isExpanded: boolean;
  theme: Theme;
  isSpanGroupToggler?: boolean;
}) => {
  const buttonTheme = isExpanded ? theme.button.default : theme.button.primary;
  const errorTheme = theme.button.danger;

  const background = errored
    ? isExpanded
      ? buttonTheme.background
      : errorTheme.background
    : buttonTheme.background;
  const border = errored ? errorTheme.background : buttonTheme.border;
  const color = errored
    ? isExpanded
      ? errorTheme.background
      : buttonTheme.color
    : buttonTheme.color;

  if (isSpanGroupToggler) {
    return `
    background: ${theme.blue300};
    border: 1px solid ${theme.button.default.border};
    color: ${color};
    cursor: pointer;
  `;
  }

  if (disabled) {
    return `
    background: ${background};
    border: 1px solid ${border};
    color: ${color};
    cursor: default;
  `;
  }

  return `
    background: ${background};
    border: 1px solid ${border};
    color: ${color};
  `;
};

export const getDurationDisplay = ({
  width,
  left,
}: {
  left: undefined | number;
  width: undefined | number;
}): DurationDisplay => {
  const spaceNeeded = 0.3;

  if (left === undefined || width === undefined) {
    return 'inset';
  }
  if (left + width < 1 - spaceNeeded) {
    return 'right';
  }
  if (left > spaceNeeded) {
    return 'left';
  }
  return 'inset';
};

export const getHumanDuration = (duration: number): string => {
  // note: duration is assumed to be in seconds
  const durationMS = duration * 1000;
  return `${durationMS.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}ms`;
};

export const toPercent = (value: number) => `${(value * 100).toFixed(3)}%`;

type Rect = {
  height: number;
  width: number;
  // x and y are left/top coords respectively
  x: number;
  y: number;
};

// get position of element relative to top/left of document
export const getOffsetOfElement = (element: Element) => {
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

export const clamp = (value: number, min: number, max: number): number => {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
};

const getLetterIndex = (letter: string): number => {
  const index = 'abcdefghijklmnopqrstuvwxyz'.indexOf(letter) || 0;
  return index === -1 ? 0 : index;
};

const colorsAsArray = Object.keys(CHART_PALETTE).map(key => CHART_PALETTE[17][key]);

export const barColors = {
  default: CHART_PALETTE[17][4],
  transaction: CHART_PALETTE[17][8],
  http: CHART_PALETTE[17][10],
  db: CHART_PALETTE[17][17],
};

export const pickBarColor = (input: string | undefined): string => {
  // We pick the color for span bars using the first three letters of the op name.
  // That way colors stay consistent between transactions.

  if (!input || input.length < 3) {
    return CHART_PALETTE[17][4];
  }

  if (barColors[input]) {
    return barColors[input];
  }

  const letterIndex1 = getLetterIndex(input.slice(0, 1));
  const letterIndex2 = getLetterIndex(input.slice(1, 2));
  const letterIndex3 = getLetterIndex(input.slice(2, 3));
  const letterIndex4 = getLetterIndex(input.slice(3, 4));

  return colorsAsArray[
    (letterIndex1 + letterIndex2 + letterIndex3 + letterIndex4) % colorsAsArray.length
  ];
};
