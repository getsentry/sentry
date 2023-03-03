import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

const Grid = styled('div')<{hasThreadStates: boolean}>`
  font-size: ${p => p.theme.fontSizeSmall};
  display: grid;
  gap: ${space(1)};
  align-items: center;
  grid-template-columns: 16px repeat(${p => (p.hasThreadStates ? '3' : '2')}, 1fr) 1fr;
`;

const GridCell = styled('div')`
  ${p => p.theme.overflowEllipsis};
`;

export {Grid, GridCell};
