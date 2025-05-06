import styled from '@emotion/styled';

export const GridCell = styled('div')`
  font-size: 14px;
`;

export const GridCellNumber = styled(GridCell)`
  text-align: right;
  font-variant-numeric: tabular-nums;
  flex-grow: 1;
`;
