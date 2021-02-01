import {css} from '@emotion/core';

import {Theme} from 'app/utils/theme';

const commonSymbolStyle = css`
  & > li {
    padding-left: 34px;
    :before {
      border-radius: 50%;
      position: absolute;
    }
  }
`;

const bulletStyle = (theme: Theme) => css`
  ${commonSymbolStyle}
  & > li:before {
    content: '';
    width: 6px;
    height: 6px;
    left: 5px;
    top: 10px;
    border: 1px solid ${theme.gray500};
  }
`;

type Options = {
  isSolid?: boolean;
  //setting initialCounterValue to 0 means the first visible step is 1
  initialCounterValue?: number;
};

const numericStyle = (
  theme: Theme,
  {isSolid = false, initialCounterValue = 0}: Options
) => css`
  ${commonSymbolStyle}
  & > li:before {
    counter-increment: numberedList;
    content: counter(numberedList);
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    left: 0;
    ${isSolid
      ? css`
          width: 24px;
          height: 24px;
          font-weight: 500;
          font-size: ${theme.fontSizeSmall};
          background-color: ${theme.yellow300};
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
