import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

export const ThreadSelectorGrid = styled('div')<{hasThreadStates: boolean}>`
  font-size: ${p => p.theme.fontSizeSmall};
  display: grid;
  gap: ${space(0.5)};
  align-items: center;
  grid-template-columns: 16px 0.5fr repeat(${p => (p.hasThreadStates ? '2' : '1')}, 1fr) 1fr;
  min-height: 18px;
`;

export const ThreadSelectorGridCell = styled('div')`
  ${p => p.theme.overflowEllipsis};
`;
