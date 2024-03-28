import {forwardRef} from 'react';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

const indexToChar = 'abcdefghijklmnopqrstuvwxyz';

export const getQuerySymbol = (index: number) => {
  let result = '';
  let i = index;
  do {
    result = indexToChar[i % indexToChar.length] + result;
    i = Math.floor(i / indexToChar.length) - 1;
  } while (i >= 0);
  return result;
};

const Symbol = styled('span')<{isHidden?: boolean; isSelected?: boolean}>`
  display: flex;
  width: 16px;
  height: 16px;
  line-height: 16px;
  padding: ${space(0.5)};
  justify-content: center;
  align-items: center;
  flex-shrink: 0;
  border-radius: 50%;
  font-weight: 500;
  color: ${p => p.theme.black};
  font-size: 11px;
  background: ${p => p.theme.yellow300};

  ${p =>
    p.isSelected &&
    !p.isHidden &&
    `
  background: ${p.theme.purple300};
  color: ${p.theme.white};
  `}

  ${p =>
    p.isHidden &&
    `
  background: ${p.theme.gray300};
  color: ${p.theme.white};
  `}
`;

interface QuerySymbolProps extends React.ComponentProps<typeof Symbol> {
  queryId: number;
}

export const QuerySymbol = forwardRef<HTMLSpanElement, QuerySymbolProps>(
  function QuerySymbol({queryId, ...props}, ref) {
    if (queryId < 0) {
      return null;
    }
    return (
      <Symbol ref={ref} {...props}>
        <span>{getQuerySymbol(queryId)}</span>
      </Symbol>
    );
  }
);
