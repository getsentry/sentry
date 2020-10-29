import styled from '@emotion/styled';

import space from 'app/styles/space';

export const GridCell = styled('div')`
  font-size: 14px;
`;

export const GridCellNumber = styled(GridCell)`
  text-align: right;
`;

export const SummaryGridRow = styled('tr')`
  display: grid;
  grid-template-columns: auto minmax(70px, 170px) minmax(70px, 230px);
`;

export const HeaderContainer = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  padding: ${space(2)} ${space(1.5)};
`;

export const HeaderTitle = styled('h3')`
  display: inline-grid;
  grid-auto-flow: column;
  grid-gap: ${space(1)};
  font-size: ${p => p.theme.fontSizeLarge};
  font-weight: normal;
  color: ${p => p.theme.gray700};
  padding-left: ${space(1)};
  line-height: 1.1;
  margin-bottom: 0;
`;

export const HeaderTitleLegend = styled(HeaderTitle)`
  background-color: ${p => p.theme.white};
  position: absolute;
  z-index: 1;
`;

export const ChartContainer = styled('div')`
  padding: ${space(2)} ${space(1.5)};
`;

export const ChartsGrid = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-column-gap: ${space(1)};
`;

export const ErrorPanel = styled('div')`
  display: flex;
  justify-content: center;
  align-items: center;

  flex: 1;
  flex-shrink: 0;
  overflow: hidden;
  height: 200px;
  position: relative;
  border-color: transparent;
  margin-bottom: 0;
`;
