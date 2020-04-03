import styled from '@emotion/styled';

import space from 'app/styles/space';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import {IconQuestion} from 'app/icons';

export const TableGrid = styled('table')`
  margin: 0;
  width: 100%;
`;

export const GridHead = styled('thead')`
  color: ${p => p.theme.gray3};
  text-transform: uppercase;
  font-size: 12px;
  line-height: 1;
`;

export const GridHeadCell = styled('th')`
  padding: ${space(2)};
  background: ${p => p.theme.offWhite};
  ${overflowEllipsis};

  &:first-child {
    border-top-left-radius: ${p => p.theme.borderRadius};
  }

  &:last-child {
    border-top-right-radius: ${p => p.theme.borderRadius};
  }
`;

export const GridBody = styled('tbody')`
  font-size: 14px;
`;

export const GridBodyCell = styled('td')`
  border-top: 1px solid ${p => p.theme.borderDark};
  padding: ${space(1)} ${space(2)};
  ${overflowEllipsis};
`;

export const GridBodyCellNumber = styled(GridBodyCell)`
  text-align: right;
`;

export const GridRow = styled('tr')<{numOfColumns: number}>`
  display: grid;
  grid-template-columns: ${props => {
    const {numOfColumns} = props;

    const numOfExtraColumns = numOfColumns - 2;

    if (numOfExtraColumns > 0) {
      return `auto 120px repeat(${numOfExtraColumns}, minmax(70px, 100px))`;
    }

    return 'auto 120px';
  }};
`;

export const SummaryGridRow = styled('tr')`
  display: grid;
  grid-template-columns: auto minmax(70px, 170px) minmax(70px, 230px);
`;

export const HeaderTitle = styled('div')`
  font-size: ${p => p.theme.fontSizeLarge};
  color: ${p => p.theme.gray4};
  padding: 0 ${space(1)};

  span {
    vertical-align: middle;
  }
`;

export const ChartsContainer = styled('div')`
  padding: ${space(2)} ${space(1.5)};
`;

export const ChartsGrid = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-column-gap: ${space(1)};
`;

export const ChartContainer = styled('div')`
  flex-grow: 1;
`;

export const StyledIconQuestion = styled(IconQuestion)`
  color: ${p => p.theme.gray1};
  margin-left: ${space(0.5)};
`;
