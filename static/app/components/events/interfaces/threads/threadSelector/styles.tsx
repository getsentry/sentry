import styled from '@emotion/styled';

import overflowEllipsis from 'sentry/styles/overflowEllipsis';
import space from 'sentry/styles/space';

const Grid = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  display: grid;
  gap: ${space(1)};
  align-items: center;
  grid-template-columns: 16px repeat(2, 1fr) 3fr;
`;

const GridCell = styled('div')`
  ${overflowEllipsis};
`;

export {Grid, GridCell};
