import styled from '@emotion/styled';

import space from 'app/styles/space';

const StyledLayout = styled('div')`
  display: grid;
  grid-template-columns: 24px 3fr 1.7fr 2fr 1.2fr 2fr 1fr 1fr 1fr;
  grid-column-gap: ${space(1.5)};
  width: 100%;
  align-items: center;
  @media (max-width: ${p => p.theme.breakpoints[2]}) {
    grid-template-columns: 24px 3fr 1fr 1fr 1fr 1fr 1fr;
  }
  @media (max-width: 600px) {
    grid-template-columns: 24px 3fr 1fr 1fr;
  }
`;

const StyledColumn = styled('div')`
  overflow: hidden;
`;

const StyledCenterAlignedColumn = styled('div')`
  text-align: center;
`;

const StyledRightAlignedColumn = styled('div')`
  text-align: right;
  @media (max-width: 600px) {
    display: none;
  }
`;

const StyledChartColumn = styled('div')`
  margin-left: ${space(2)};
  margin-right: ${space(2)};
  @media (max-width: ${p => p.theme.breakpoints[2]}) {
    display: none;
  }
`;

export {
  StyledLayout,
  StyledColumn,
  StyledCenterAlignedColumn,
  StyledRightAlignedColumn,
  StyledChartColumn,
};
