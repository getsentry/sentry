import styled from '@emotion/styled';

import space from 'app/styles/space';

const BREAKPOINT_TO_HIDE_COLUMNS = '600px';

const Layout = styled('div')`
  display: grid;
  grid-template-columns: 24px 3fr 1.7fr 2fr 1.2fr 2fr 1fr 1fr 1fr;
  grid-column-gap: ${space(1.5)};
  width: 100%;
  align-items: center;
  @media (max-width: ${p => p.theme.breakpoints[2]}) {
    grid-template-columns: 24px 3fr 1fr 1fr 1fr 1fr 1fr;
  }
  @media (max-width: ${BREAKPOINT_TO_HIDE_COLUMNS}) {
    grid-template-columns: 24px 3fr 1fr 1fr;
  }
`;

const Column = styled('div')`
  overflow: hidden;
`;

const CenterAlignedColumn = styled('div')`
  text-align: center;
`;

const RightAlignedColumn = styled('div')`
  text-align: right;
  @media (max-width: ${BREAKPOINT_TO_HIDE_COLUMNS}) {
    display: none;
  }
`;

const ChartColumn = styled('div')`
  margin-left: ${space(2)};
  margin-right: ${space(2)};
  @media (max-width: ${p => p.theme.breakpoints[2]}) {
    display: none;
  }
`;

export {Layout, Column, CenterAlignedColumn, RightAlignedColumn, ChartColumn};
