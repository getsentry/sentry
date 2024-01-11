import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

const indexToChar = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export const getQuerySymbol = (index: number) => {
  let result = '';
  let i = index;
  do {
    result = indexToChar[i % indexToChar.length] + result;
    i = Math.floor(i / indexToChar.length) - 1;
  } while (i >= 0);
  return result;
};

const Symbol = styled('div')`
  display: flex;
  width: 16px;
  height: 16px;
  padding: ${space(0.5)};
  justify-content: center;
  align-items: center;
  flex-shrink: 0;
  border-radius: 50%;
  font-weight: 500;
  color: ${p => p.theme.black};
  font-size: 10px;
  background: ${p => p.theme.yellow300};
`;

export function QuerySymbol({
  index,
  ...props
}: React.ComponentProps<typeof Symbol> & {index: number}) {
  return (
    <Symbol {...props}>
      <span>{getQuerySymbol(index)}</span>
    </Symbol>
  );
}
