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

export const Symbol = styled('span')<{isHidden?: boolean}>`
  display: flex;
  width: 38px;
  height: 38px;
  line-height: 16px;
  padding: ${space(0.5)};
  justify-content: center;
  align-items: center;
  flex-shrink: 0;
  border-radius: ${p => p.theme.borderRadius};
  font-weight: 500;
  color: ${p => p.theme.white};
  font-size: 14px;
  background: ${p => p.theme.purple300};

  ${p =>
    p.isHidden &&
    `
  background: ${p.theme.background};
  color: ${p.theme.textColor};
  border: 1px solid ${p.theme.border};
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
