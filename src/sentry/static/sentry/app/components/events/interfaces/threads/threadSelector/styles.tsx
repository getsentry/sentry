import styled from '@emotion/styled';

import space from 'app/styles/space';
import overflowEllipsis from 'app/styles/overflowEllipsis';

const Grid = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  display: grid;
  grid-gap: ${space(1)};
  align-items: center;
  grid-template-columns: 40px minmax(100px, 2fr) minmax(70px, 1fr) 0fr 40px;
  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    grid-template-columns: 50px minmax(170px, 2fr) minmax(100px, 1fr) minmax(100px, 2fr) 40px;
  }
`;

const GridCell = styled('div')`
  height: 100%;
  ${overflowEllipsis};
`;

export {Grid, GridCell};
