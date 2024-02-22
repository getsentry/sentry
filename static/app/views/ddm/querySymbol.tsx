import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import {useDDMContext} from 'sentry/views/ddm/context';

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

const Symbol = styled('div')<{isSelected: boolean}>`
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
    `
  background: ${p.theme.purple300};
  color: ${p.theme.white};
  `}
`;

export function QuerySymbol({
  queryId,
  isSelected,
  ...props
}: React.ComponentProps<typeof Symbol> & {isSelected: boolean; queryId: number}) {
  const {showQuerySymbols, isMultiChartMode} = useDDMContext();
  if (!showQuerySymbols || queryId < 0) {
    return null;
  }
  return (
    <Symbol isSelected={isMultiChartMode && isSelected} {...props}>
      <span>{getQuerySymbol(queryId)}</span>
    </Symbol>
  );
}
