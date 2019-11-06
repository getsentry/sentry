import styled from 'react-emotion';

import InlineSvg from 'app/components/inlineSvg';
import {Panel, PanelBody} from 'app/components/panels';
import space from 'app/styles/space';

export const ADD_BUTTON_SIZE = 16; // this is an even number
export const GRID_HEADER_HEIGHT = 45;
const GRID_EDIT_WIDTH = 35;
const GRID_EDIT_WIDTH_EDIT_MODE =
  GRID_EDIT_WIDTH + ADD_BUTTON_SIZE / 2 + (12 - ADD_BUTTON_SIZE / 2);

/**
 * Explanation of z-index:
 *  - Resizer needs to float above <th> cells to be interactive.
 *  - Editable needs to float above Resizer to hide the right-most Resizer,
 */
const Z_INDEX_RESIZER = '1';
const Z_INDEX_EDITABLE = '10';
export const Z_INDEX_ADD_COLUMN = '20';

type GridEditableProps = {
  numColumn?: number;
  isEditable?: boolean;
  isEditing?: boolean;
  isPrimary?: boolean;
  isDragging?: boolean;
};

export const GridPanel = styled(Panel)`
  overflow: hidden;
`;
export const GridPanelBody = styled(PanelBody)``;

/**
 *
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
 *
 */
export const Grid = styled('table')<GridEditableProps>`
  position: relative;
  display: grid;
  grid-template-columns: 2.5fr repeat(${p => (p.numColumn ? p.numColumn - 1 : 0)}, 1fr);

  box-sizing: border-box;
  border-collapse: collapse;
  margin: 0;

  background-color: ${p => p.theme.offWhite};
  overflow: hidden;

  /* For the last column, we want to have some space on the right if column
     is editable.

     For the header, we set padding for 1 or 2 buttons depending on state
     For the body, use "td:last-child" */
  th:last-child {
    ${p => {
      if (!p.isEditable) {
        return 'padding-right: 0px';
      }
      if (!p.isEditing) {
        return `padding-right: ${GRID_EDIT_WIDTH}px;`;
      }

      return `padding-right: ${GRID_EDIT_WIDTH_EDIT_MODE}px;`;
    }}
  }
`;
export const GridRow = styled('tr')`
  display: contents;
`;

/**
 *
 * GridHead is the collection of elements that builds the header section of the
 * Grid. As the entirety of the add/remove/resize actions are performed on the
 * header, most of the elements behave different for each stage.
 *
 */
export const GridHead = styled('thead')`
  display: contents;
`;
export const GridHeadCell = styled('th')`
  /* By default, a grid item cannot be smaller than the size of its content.
     We override this by setting min-width to be 0. */
  position: relative;
  min-width: 0;
  height: ${GRID_HEADER_HEIGHT}px;

  border-bottom: 1px solid ${p => p.theme.borderDark};
  background: ${p => p.theme.offWhite};
`;
export const GridHeadCellButton = styled('div')<GridEditableProps>`
  position: relative;
  min-width: 24px; /* Ensure that edit/remove buttons are never hidden */
  display: block;
  margin: ${space(1)} ${space(1.5)};
  padding: ${space(1)} ${space(0.5)};
  border-radius: ${p => p.theme.borderRadius};

  color: ${p => {
    if (p.isDragging) {
      return p.theme.offWhite2;
    }

    return p.theme.gray2;
  }};
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
  text-transform: uppercase;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;

  background: ${p => {
    if (p.isDragging) {
      return p.theme.gray2;
    }

    if (p.isEditing) {
      return p.theme.offWhite2;
    }

    return 'none';
  }};

  a {
    color: ${p => {
      if (p.isDragging) {
        return p.theme.offWhite2;
      }

      return p.theme.gray2;
    }};
  }

  &:hover,
  &:active {
    color: ${p => {
      if (p.isDragging) {
        return p.theme.offWhite2;
      }

      return p.theme.gray2;
    }};

    a {
      color: ${p => {
        if (p.isDragging) {
          return p.theme.offWhite2;
        }

        return p.theme.gray2;
      }};
    }
  }

  user-select: none;
`;
export const GridHeadCellResizer = styled('span')<GridEditableProps>`
  position: absolute;
  top: 0;
  right: -2px; /* Overlap half of Resizer into the right neighbor */
  display: block;
  width: 4px;
  height: 100%;

  padding: ${space(1.5)} 1px; /* Padding sets the size of ::after  */
  z-index: ${Z_INDEX_RESIZER};
  cursor: col-resize;

  &::after {
    content: ' ';
    display: block;
    width: 2px;
    height: 100%;

    border-left: 1px solid ${p => p.theme.gray2};
    border-right: 1px solid ${p => p.theme.gray2};
  }
`;

/**
 *
 * GridHeadCellButtonHover is the collection of interactive elements to add or
 * move the columns. They are expected to be draggable.
 *
 */
export const GridHeadCellButtonHover = styled('div')<GridEditableProps>`
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  height: 100%;

  color: ${p => p.theme.gray3};

  &:hover {
    color: ${p => p.theme.gray4};
  }
  &:active {
    color: ${p => p.theme.gray5};
  }
`;
export const GridHeadCellButtonHoverBackground = styled(GridHeadCellButton)`
  position: absolute;
  top: 0;
  left: 0;
  display: block;
  width: 100%;
  height: 100%;

  background-color: ${p => p.theme.offWhite2};
  margin: 0;

  a,
  &:hover a,
  &:active a {
    color: ${p => p.theme.gray1} !important;
  }
`;

export const GridHeadCellButtonHoverButton = styled('div')`
  display: inline-flex;
  justify-content: center;
  align-items: center;
  width: 20px;
  height: 20px;

  margin: ${space(0.25)};
  border: 2px solid ${p => p.theme.gray3};
  border-radius: ${p => p.theme.borderRadius};
  background-color: ${p => p.theme.offWhite2};
  opacity: 1;

  font-size: 14px;
  cursor: pointer;

  &:hover {
    border: 2px solid ${p => p.theme.gray4};
  }
  &:active {
    border: 2px solid ${p => p.theme.gray5};
  }
`;
export const GridHeadCellButtonHoverDraggable = styled(InlineSvg)`
  cursor: grab;
  user-select: none;
`;

/**
 *
 * GridBody are the collection of elements that contains and display the data
 * of the Grid. They are rather simple.
 *
 */
export const GridBody = styled('tbody')`
  display: contents;

  > tr:last-child td {
    border-bottom: none;
  }
`;
export const GridBodyCell = styled('td')`
  /* By default, a grid item cannot be smaller than the size of its content.
     We override this by setting min-width to be 0. */
  min-width: 0;
  padding: ${space(2)} ${space(2)};
  background-color: ${p => p.theme.white};
  border-bottom: 1px solid ${p => p.theme.borderLight};

  font-size: ${p => p.theme.fontSizeMedium};
`;
export const GridBodyCellSpan = styled(GridBodyCell)`
  grid-column: 1 / -1;
`;
export const GridBodyCellLoading = styled('div')`
  min-height: 220px;
`;

/**
 *
 * GridEditGroup are the buttons that are on the top right of the Grid that
 * allows the user to add/remove/resize the columns of the Grid
 *
 */
export const GridEditGroup = styled('th')`
  position: absolute;
  top: 0;
  right: 0;
  display: flex;
  height: ${GRID_HEADER_HEIGHT}px;

  background-color: ${p => p.theme.offWhite};
  border-bottom: 1px solid ${p => p.theme.borderDark};

  z-index: ${Z_INDEX_EDITABLE};
`;
export const GridEditGroupButton = styled('div')`
  display: block;
  width: ${GRID_EDIT_WIDTH}px;
  height: ${GRID_HEADER_HEIGHT}px;

  color: ${p => p.theme.gray2};
  font-size: 16px;
  cursor: pointer;

  &:hover {
    color: ${p => p.theme.gray3};
  }
  &:active {
    color: ${p => p.theme.gray4};
  }
  &:last-child {
    border-left: 1px solid ${p => p.theme.borderDark};
  }

  /* Targets ToolTip to ensure that it will fill up the parent element and
     its child elements will float in its center */
  > span {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    height: 100%;
  }
`;
