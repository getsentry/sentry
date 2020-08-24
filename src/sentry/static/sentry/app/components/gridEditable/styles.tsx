import React from 'react';
import styled from '@emotion/styled';

import {Panel, PanelBody} from 'app/components/panels';
import space from 'app/styles/space';

export const GRID_HEAD_ROW_HEIGHT = 45;
export const GRID_BODY_ROW_HEIGHT = 40;
export const GRID_STATUS_MESSAGE_HEIGHT = GRID_BODY_ROW_HEIGHT * 4;

/**
 * Local z-index stacking context
 * https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Positioning/Understanding_z_index/The_stacking_context
 */
// Parent context is Panel
const Z_INDEX_PANEL = 1;
const Z_INDEX_GRID_STATUS = -1;
const Z_INDEX_GRID = 5;

// Parent context is GridHeadCell
const Z_INDEX_GRID_RESIZER = 1;

export const Header = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${space(1)};
`;

export const HeaderTitle = styled('h4')`
  margin: 0;
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.gray600};
`;

export const HeaderButtonContainer = styled('div')`
  display: grid;
  grid-gap: ${space(1)};
  grid-auto-flow: column;
  grid-auto-columns: auto;
  justify-items: end;

  /* Hovercard anchor element when features are disabled. */
  & > span {
    display: flex;
    flex-direction: row;
  }
`;

const PanelWithProtectedBorder = styled(Panel)`
  overflow: hidden;
  z-index: ${Z_INDEX_PANEL};
`;
export const Body = props => (
  <PanelWithProtectedBorder>
    <PanelBody>{props.children}</PanelBody>
  </PanelWithProtectedBorder>
);

/**
 * Grid is the parent element for the tableResizable component.
 *
 * On newer browsers, it will use CSS Grids to implement its layout.
 *
 * However, it is based on <table>, which has a distinction between header/body
 * HTML elements, which allows CSS selectors to its full potential. This has
 * the added advantage that older browsers will still have a chance of
 * displaying the data correctly (but this is untested).
 *
 * <thead>, <tbody>, <tr> are ignored by CSS Grid.
 * The entire layout is determined by the usage of <th> and <td>.
 */
export const Grid = styled('table')`
  position: inherit;
  display: grid;

  /* Overwritten by GridEditable.setGridTemplateColumns */
  grid-template-columns: repeat(auto-fill, minmax(50px, auto));

  box-sizing: border-box;
  border-collapse: collapse;
  margin: 0;

  z-index: ${Z_INDEX_GRID};
  overflow-x: scroll;
`;

export const GridRow = styled('tr')`
  display: contents;

  &:last-child,
  &:last-child > td:first-child,
  &:last-child > td:last-child {
    border-bottom-left-radius: ${p => p.theme.borderRadius};
    border-bottom-right-radius: ${p => p.theme.borderRadius};
  }
`;

/**
 * GridHead is the collection of elements that builds the header section of the
 * Grid. As the entirety of the add/remove/resize actions are performed on the
 * header, most of the elements behave different for each stage.
 */
export const GridHead = styled('thead')`
  display: contents;
`;

export const GridHeadCell = styled('th')<{isFirst: boolean}>`
  /* By default, a grid item cannot be smaller than the size of its content.
     We override this by setting min-width to be 0. */
  position: relative; /* Used by GridResizer */
  height: ${GRID_HEAD_ROW_HEIGHT}px;
  display: flex;
  align-items: center;
  min-width: 24px;
  padding: 0 ${space(2)};

  border-right: 1px solid transparent;
  border-left: 1px solid transparent;
  background-color: ${p => p.theme.gray100};
  color: ${p => p.theme.gray600};

  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: 600;
  text-transform: uppercase;
  user-select: none;

  a,
  div {
    line-height: 1.1;
    color: inherit;
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
  }

  &:first-child {
    border-top-left-radius: ${p => p.theme.borderRadius};
  }

  &:last-child {
    border-top-right-radius: ${p => p.theme.borderRadius};
    border-right: none;
  }

  &:hover {
    border-left-color: ${p => (p.isFirst ? 'transparent' : p.theme.border)};
    border-right-color: ${p => p.theme.border};
  }
`;

/**
 * Create spacing/padding similar to GridHeadCellWrapper but
 * without interactive aspects.
 */
export const GridHeadCellStatic = styled('th')`
  height: ${GRID_HEAD_ROW_HEIGHT}px;
  display: flex;
  align-items: center;
  padding: 0 ${space(2)};
  background-color: ${p => p.theme.gray100};
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: 600;
  line-height: 1;
  text-transform: uppercase;
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;

  &:first-child {
    border-top-left-radius: ${p => p.theme.borderRadius};
    padding: ${space(1)} 0 ${space(1)} ${space(3)};
  }
`;

/**
 * GridBody are the collection of elements that contains and display the data
 * of the Grid. They are rather simple.
 */
export const GridBody = styled('tbody')`
  display: contents;

  > tr:first-child td {
    border-top: 1px solid ${p => p.theme.border};
  }
`;
export const GridBodyCell = styled('td')`
  /* By default, a grid item cannot be smaller than the size of its content.
     We override this by setting min-width to be 0. */
  min-width: 0;
  /* Locking in the height makes calculation for resizer to be easier.
     min-height is used to allow a cell to expand and this is used to display
     feedback during empty/error state */
  min-height: ${GRID_BODY_ROW_HEIGHT}px;
  padding: ${space(1)} ${space(2)};

  background-color: ${p => p.theme.white};
  border-top: 1px solid ${p => p.theme.border};

  font-size: ${p => p.theme.fontSizeMedium};

  &:first-child {
    padding: ${space(1)} 0 ${space(1)} ${space(3)};
  }

  &:last-child {
    border-right: none;
  }
`;

const GridStatusWrapper = styled(GridBodyCell)`
  grid-column: 1 / -1;
  width: 100%;
  height: ${GRID_STATUS_MESSAGE_HEIGHT}px;
  background-color: transparent;
`;
const GridStatusFloat = styled('div')`
  position: absolute;
  top: 45px;
  left: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: ${GRID_STATUS_MESSAGE_HEIGHT}px;

  z-index: ${Z_INDEX_GRID_STATUS};
  background: ${p => p.theme.white};
`;
export const GridBodyCellStatus = props => (
  <GridStatusWrapper>
    <GridStatusFloat>{props.children}</GridStatusFloat>
  </GridStatusWrapper>
);

/**
 * We have a fat GridResizer and we use the ::after pseudo-element to draw
 * a thin 1px border.
 *
 * The right most cell does not have a resizer as resizing from that side does strange things.
 */
export const GridResizer = styled('div')<{dataRows: number}>`
  position: absolute;
  top: 0px;
  right: -6px;
  width: 11px;

  height: ${p => {
    const numOfRows = p.dataRows;
    let height = GRID_HEAD_ROW_HEIGHT + numOfRows * GRID_BODY_ROW_HEIGHT;

    if (numOfRows >= 2) {
      // account for border-bottom height
      height += numOfRows - 1;
    }

    return height;
  }}px;

  padding-left: 5px;
  padding-right: 5px;

  cursor: col-resize;
  z-index: ${Z_INDEX_GRID_RESIZER};

  /**
   * This element allows us to have a fat GridResizer that is easy to hover and
   * drag, but still draws an appealing thin line for the border
   */
  &::after {
    content: ' ';
    display: block;
    width: 100%; /* Equivalent to 1px */
    height: 100%;
  }

  &:hover::after {
    background-color: ${p => p.theme.gray400};
  }

  /**
   * Ensure that this rule is after :hover, otherwise it will flicker when
   * the GridResizer is dragged
   */
  &:active::after,
  &:focus::after {
    background-color: ${p => p.theme.purple400};
  }

  /**
   * This element gives the resize handle a more visible knob to grab
   */
  &:hover::before {
    position: absolute;
    top: 0;
    left: 2px;
    content: ' ';
    display: block;
    width: 7px;
    height: ${GRID_HEAD_ROW_HEIGHT}px;
    background-color: ${p => p.theme.purple400};
    opacity: 0.4;
  }
`;
