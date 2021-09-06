import styled from '@emotion/styled';

import space from 'app/styles/space';

type TableCellProps = {
  align: 'left' | 'right' | 'center';
  tabularFigures: boolean;
};

const TableOuter = styled('div')`
  width: 100%;
  border-radius: ${p => p.theme.borderRadius};
  border: solid 1px ${p => p.theme.gray100};
  margin: ${space(2)} 0;
  overflow: hidden;
`;

const TableInner = styled('table')`
  width: 100%;
  margin: 0;
`;

export const Table = ({children}) => (
  <TableOuter>
    <TableInner>{children}</TableInner>
  </TableOuter>
);

export const TableHead = styled('thead')`
  background: ${p => p.theme.bodyBackground};
  border-bottom: solid 1px ${p => p.theme.gray100};
`;

export const TableHeadCell = styled('th')<TableCellProps>`
  font-size: 0.875em;
  color: ${p => p.theme.gray300};
  padding: ${space(1)} ${space(2)};
  text-transform: uppercase;

  ${p => p.align && `text-align: ${p.align};`}
  ${p => p.tabularFigures && `font-variant-numeric: tabular-nums;`}

  & * {
    margin: 0;
  }
`;

export const TableBody = styled('tbody')``;

export const TableRow = styled('tr')`
  &:nth-of-type(2n) {
    background: ${p => p.theme.bodyBackground};
  }
`;

export const TableCell = styled('td')<TableCellProps>`
  padding: ${space(1)} ${space(2)};
  vertical-align: bottom;

  ${p => p.align && `text-align: ${p.align};`}
  ${p => p.tabularFigures && `font-variant-numeric: tabular-nums;`}

  & * {
    margin: 0;
  }
`;
