import styled from '@emotion/styled';

import space from 'sentry/styles/space';

type TableCellProps = {
  align: 'left' | 'right' | 'center';
  tabularFigures: boolean;
  morePadding?: boolean;
};

const TableOuter = styled('div')`
  width: 100%;
  margin: ${space(2)} 0;
  overflow: hidden;
  border: solid 1px ${p => p.theme.border};
  border-radius: 4px;
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
  border-bottom: solid 1px ${p => p.theme.border};
`;

export const TableHeadCell = styled('th')<TableCellProps>`
  font-size: 0.875em;
  color: ${p => p.theme.subText};
  padding: ${space(1)} 0;
  text-transform: uppercase;

  ${p => p.align && `text-align: ${p.align};`}
  ${p => p.tabularFigures && `font-variant-numeric: tabular-nums;`}

  &:first-of-type {
    padding-left: ${space(2)};
  }
  &:last-of-type {
    padding-right: ${space(2)};
  }

  & * {
    margin: 0;
  }
`;

export const TableBody = styled('tbody')``;

export const TableRow = styled('tr')`
  &:not(:last-child) {
    border-bottom: solid 1px ${p => p.theme.innerBorder};
  }
`;

export const TableCell = styled('td')<TableCellProps>`
  padding: ${p => (p.morePadding ? space(2) : space(1))} 0;
  vertical-align: center;

  ${p => p.align && `text-align: ${p.align};`}
  ${p => p.tabularFigures && `font-variant-numeric: tabular-nums;`}

  &:first-of-type {
    padding-left: ${space(2)};
  }
  &:last-of-type {
    padding-right: ${space(2)};
  }

  & * {
    margin: 0;
  }
`;
