import {css, type Theme} from '@emotion/react';
// eslint-disable-next-line no-restricted-imports
import color from 'color';

import type {SpanBarType} from './constants';
import {getSpanBarColors} from './constants';

export function getHatchPattern(spanBarType: SpanBarType | undefined, theme: Theme) {
  if (spanBarType) {
    const {primary, alternate} = getSpanBarColors(spanBarType, theme);

    return css`
      background-image: linear-gradient(
        135deg,
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

// get position of element relative to top/left of document
export const getOffsetOfElement = (element: Element) => {
  // left and top are relative to viewport
  const {left, top} = element.getBoundingClientRect();

  // get values that the document is currently scrolled by
  const scrollLeft = window.pageXOffset;
  const scrollTop = window.pageYOffset;

  return {x: left + scrollLeft, y: top + scrollTop};
};

const getLetterIndex = (letter: string): number => {
  const index = 'abcdefghijklmnopqrstuvwxyz'.indexOf(letter) || 0;
  return index === -1 ? 0 : index;
};

export const pickBarColor = (input: string | undefined, theme: Theme): string => {
  const palette = theme.chart.getColorPalette(17);

  if (!input || input.length < 3) {
    return palette[4];
  }
  const barColors = {
    default: palette[4],
    transaction: palette[8],
    http: palette[10],
    db: palette[17],
  };
  if (input in barColors) {
    return barColors[input as keyof typeof barColors];
  }

  const colorsAsArray = Object.values(palette);
  // We pick the color for span bars using the first three letters of the op name.
  // That way colors stay consistent between transactions.
  const letterIndex1 = getLetterIndex(input[0]!);
  const letterIndex2 = getLetterIndex(input[1]!);
  const letterIndex3 = getLetterIndex(input[2]!);
  const letterIndex4 = getLetterIndex(input[3]!);

  return colorsAsArray[
    (letterIndex1 + letterIndex2 + letterIndex3 + letterIndex4) % colorsAsArray.length
  ]!;
};

export const lightenBarColor = (
  input: string | undefined,
  lightenRatio: number,
  theme: Theme
): string => {
  const barColor = pickBarColor(input, theme);
  return color(barColor).lighten(lightenRatio).string();
};
