import isPropValid from '@emotion/is-prop-valid';
import {css, type Theme} from '@emotion/react';
import styled from '@emotion/styled';

export const TABLE_HEAD_ROW_HEIGHT = 45;

const Z_INDEX_RESIZER = 1;

const Z_INDEX_STICKY_HEAD = 2;

export const TableGrid = styled('table')`
  position: inherit;
  display: grid;

  box-sizing: border-box;
  border-collapse: collapse;
  margin: 0;
`;

const subgrid = css`
  display: grid;
  grid-template-columns: subgrid;
  grid-column: 1 / -1;
`;

export const TableHead = styled('thead')<{sticky?: boolean}>`
  ${subgrid}

  ${p =>
    p.sticky &&
    css`
      position: sticky;
      top: 0;
      z-index: ${Z_INDEX_STICKY_HEAD};
    `}
`;

export const TableBody = styled('tbody')`
  ${subgrid}
`;

export const TableRow = styled('tr', {
  shouldForwardProp: prop => prop !== 'divider' && isPropValid(prop),
})<{divider?: boolean}>`
  ${subgrid}
  position: relative;

  ${p =>
    p.divider &&
    css`
      &:not(:last-child) {
        border-bottom: 1px solid ${p.theme.tokens.border.secondary};
      }
    `}
`;

export const TableHeadCell = styled('th')`
  position: relative;
  min-width: 0;
`;

export const TableCell = styled('td')`
  min-width: 0;
`;

export const TableStatusCell = styled('td')`
  grid-column: 1 / -1;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
`;

export const fullWidthCellStyle = css`
  align-items: stretch;
  flex-direction: column;
  padding: 0;
`;

export const statusCellStyle = (p: {theme: Theme}) => css`
  min-height: 200px;
  padding: ${p.theme.space.xl};
`;

export const emptyCellStyle = (p: {theme: Theme}) => css`
  ${statusCellStyle(p)}
  color: ${p.theme.tokens.content.secondary};
  font-size: ${p.theme.font.size.md};
`;

export const TableResizer = styled('div')`
  position: absolute;
  top: 0;
  right: 0;
  display: flex;
  height: var(--column-resizer-height, ${TABLE_HEAD_ROW_HEIGHT}px);
  pointer-events: none;
  z-index: ${Z_INDEX_RESIZER};
`;
