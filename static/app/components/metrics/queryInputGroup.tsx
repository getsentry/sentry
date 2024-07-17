import type {CSSProperties} from 'react';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

// Old Symbol styles
export const _Symbol = styled('span')<{
  cursor?: CSSProperties['cursor'];
  isHidden?: boolean;
}>`
  display: flex;
  width: 38px;
  height: 38px;
  line-height: 16px;
  padding: ${space(0.5)};
  justify-content: center;
  align-items: center;
  flex-shrink: 0;
  border-radius: ${p => p.theme.borderRadius};
  ${p => p.theme.fontWeightNormal};
  color: ${p => p.theme.white};
  font-size: 14px;
  background: ${p => p.theme.purple300};
  cursor: ${props => props.cursor ?? 'default'};
  ${p =>
    p.isHidden &&
    `
  background: ${p.theme.background};
  color: ${p.theme.textColor};
  border: 1px solid ${p.theme.border};
  `}
`;

// New Symbol styles
const Symbol = styled(_Symbol)`
  color: ${p => p.theme.purple300};
  border: 1px solid #d6d2f0;
  background: ${p => p.theme.purple100};
  text-transform: uppercase;
  font-weight: 500;
`;

export function QueryInputGroup({children}: React.HTMLAttributes<HTMLDivElement>) {
  return children;
}

QueryInputGroup.Symbol = Symbol;
