import styled from '@emotion/styled';

import {DeprecatedSymbol} from './styles';

// New Symbol styles
const Symbol = styled(DeprecatedSymbol)`
  color: ${p => p.theme.purple300};
  border: 1px solid ${p => p.theme.purple200};
  background: ${p => p.theme.purple100};
  text-transform: uppercase;
  font-weight: 500;
`;

export function QueryInputGroup({children}: React.HTMLAttributes<HTMLDivElement>) {
  return children;
}

QueryInputGroup.Symbol = Symbol;
