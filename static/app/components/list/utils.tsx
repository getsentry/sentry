import type {DO_NOT_USE_ChonkTheme, Theme} from '@emotion/react';
import {css} from '@emotion/react';

import {space} from 'sentry/styles/space';

const bulletStyle = (theme: Theme) => css`
  padding-left: ${space(3)};
  list-style-type: circle;
  & > li::marker {
    color: ${theme.subText};
  }
`;

type Options = {
  // setting initialCounterValue to 0 means the first visible step is 1
  initialCounterValue?: number;
  isSolid?: boolean;
};

const numericStyle = (
  theme: Theme,
  {isSolid = false, initialCounterValue = 0}: Options
) => css`
  & > li {
    padding-left: ${space(4)};
    :before {
      border-radius: 50%;
      position: absolute;
      counter-increment: numberedList;
      content: counter(numberedList);
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      left: 0;
      line-height: 1;
      ${isSolid
        ? css`
            width: 24px;
            height: 24px;
            font-weight: ${theme.fontWeightNormal};
            font-size: ${theme.fontSizeSmall};
            background-color: ${theme.isChonk
              ? (theme as DO_NOT_USE_ChonkTheme).colors.chonk.yellow400
              : theme.yellow300};
            color: ${theme.black};
          `
        : css`
            top: 3px;
            width: 18px;
            height: 18px;
            font-weight: ${theme.fontWeightBold};
            font-size: 10px;
            border: 1px solid ${theme.border};
          `}
    }
  }
  counter-reset: numberedList ${initialCounterValue};
`;

export const listSymbol = {
  numeric: 'numeric',
  'colored-numeric': 'colored-numeric',
  bullet: 'bullet',
};

export function getListSymbolStyle(
  theme: Theme,
  symbol: keyof typeof listSymbol,
  initialCounterValue?: number
) {
  switch (symbol) {
    case 'numeric':
      return numericStyle(theme, {initialCounterValue});
    case 'colored-numeric':
      return numericStyle(theme, {isSolid: true, initialCounterValue});
    default:
      return bulletStyle(theme);
  }
}
