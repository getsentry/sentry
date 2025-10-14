import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

function QuerySymbol({id}: {id: string}) {
  return <Symbol>{id}</Symbol>;
}

export default QuerySymbol;

export const Symbol = styled('span')`
  display: flex;
  width: 36px;
  height: 36px;
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
`;
