import type {CSSProperties} from 'react';
import isPropValid from '@emotion/is-prop-valid';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

export const TABLE_HEAD_ROW_HEIGHT = 45;

const Z_INDEX_RESIZER = 1;

export const TableGrid = styled('table')<{
  fit?: 'max-content';
  headRowHeight?: number;
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
    p.headRowHeight &&
    css`
      &:has(> thead + tbody) {
        grid-template-rows: ${p.headRowHeight}px ${p.height ? '1fr' : 'auto'};
      }

      &:has(> thead + tbody + tbody) {
        grid-template-rows: ${p.headRowHeight}px fit-content(100%) ${p.height
            ? '1fr'
            : 'auto'};
      }
    `}

  min-width: ${p => p.fit};
`;

export const TableHead = styled('thead')<{sticky?: boolean; stickyZIndex?: number}>`
  display: grid;
  grid-template-columns: subgrid;
  grid-column: 1 / -1;

  ${p =>
    p.sticky &&
    css`
      position: sticky;
      top: 0;
      z-index: ${p.stickyZIndex ?? 2};
    `}
`;

export const TableBody = styled('tbody')`
  display: grid;
  grid-template-columns: subgrid;
  grid-column: 1 / -1;
`;

export const TableRow = styled('tr', {
  shouldForwardProp: prop => prop !== 'divider' && isPropValid(prop),
})<{divider?: boolean}>`
  display: grid;
  grid-template-columns: subgrid;
  grid-column: 1 / -1;
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

export const TableResizer = styled('div')<{headRowHeight?: number}>`
  position: absolute;
  top: 0px;
  right: -6px;
  width: 11px;

  height: ${p =>
    `var(--table-resizer-height, ${p.headRowHeight ?? TABLE_HEAD_ROW_HEIGHT}px)`};

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
    height: ${p => p.headRowHeight ?? TABLE_HEAD_ROW_HEIGHT}px;
    background-color: ${p => p.theme.tokens.graphics.accent.vibrant};
    opacity: 0.4;
  }
`;
