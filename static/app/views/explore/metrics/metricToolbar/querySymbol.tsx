import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout';

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

function QuerySymbol({index}: {index: number}) {
  return (
    <SymbolContainer justify="center" align="center">
      {getQuerySymbol(index)}
    </SymbolContainer>
  );
}

export default QuerySymbol;

const SymbolContainer = styled(Flex)`
  width: 36px;
  height: 36px;
  line-height: 16px;
  padding: ${p => p.theme.space.xs};
  border-radius: ${p => p.theme.borderRadius};
  font-weight: ${p => p.theme.fontWeight.bold};
  color: ${p => p.theme.white};
  font-size: ${p => p.theme.fontSize.sm};
  background: ${p => p.theme.purple300};
  flex-shrink: 0;
`;
