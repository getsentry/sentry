import type {CSSProperties} from 'react';
import isPropValid from '@emotion/is-prop-valid';
import {css, type Theme} from '@emotion/react';
import styled from '@emotion/styled';

const TABLE_HEAD_ROW_HEIGHT = 45;

const Z_INDEX_RESIZER = 1;

const Z_INDEX_STICKY_HEAD = 2;

export const TableGrid = styled('table')<{
  definiteHeadRow?: boolean;
  fit?: 'max-content';
  height?: CSSProperties['height'];
  scrollable?: boolean;
}>`
  position: inherit;
  display: grid;

  box-sizing: border-box;
  border-collapse: collapse;
  margin: 0;

  ${p =>
    p.scrollable &&
    css`
      overflow-x: auto;
      overflow-y: scroll;
    `}

  ${p =>
    p.height &&
    css`
      height: 100%;
      max-height: ${typeof p.height === 'number' ? p.height + 'px' : p.height};
      flex: 1;
      min-height: 0;
    `}

  /* Pin the header to a definite track height; a content-based header track lets
     Safari mis-size the <thead> on back/forward navigation. */
  ${p =>
    p.definiteHeadRow &&
    css`
      &:has(> thead + tbody) {
        grid-template-rows: ${TABLE_HEAD_ROW_HEIGHT}px ${p.height ? '1fr' : 'auto'};
      }

      &:has(> thead + tbody + tbody) {
        grid-template-rows: ${TABLE_HEAD_ROW_HEIGHT}px fit-content(100%) ${p.height
            ? '1fr'
            : 'auto'};
      }
    `}

  min-width: ${p => p.fit};
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
  top: 0px;
  right: -6px;
  width: 11px;

  height: var(--table-resizer-height, ${TABLE_HEAD_ROW_HEIGHT}px);

  padding-left: 5px;
  padding-right: 5px;

  cursor: col-resize;
  z-index: ${Z_INDEX_RESIZER};

  &::after {
    content: ' ';
    display: block;
    width: 100%; /* Equivalent to 1px */
    height: 100%;
  }

  &:hover::after {
    background-color: ${p => p.theme.colors.gray200};
  }

  &:active::after,
  &:focus::after {
    background-color: ${p => p.theme.tokens.focus.default};
  }

  &:hover::before {
    position: absolute;
    top: 0;
    left: 2px;
    content: ' ';
    display: block;
    width: 7px;
    height: ${TABLE_HEAD_ROW_HEIGHT}px;
    background-color: ${p => p.theme.tokens.graphics.accent.vibrant};
    opacity: 0.4;
  }
`;
