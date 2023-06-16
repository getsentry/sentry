import {css, Theme} from '@emotion/react';

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
            font-weight: 500;
            font-size: ${theme.fontSizeSmall};
            background-color: ${theme.yellow300};
            color: ${theme.black};
          `
        : css`
            top: 3px;
            width: 18px;
            height: 18px;
            font-weight: 600;
            font-size: 10px;
            border: 1px solid ${theme.gray500};
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
