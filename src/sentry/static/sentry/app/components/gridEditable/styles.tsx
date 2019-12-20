import React from 'react';
import styled from 'react-emotion';

import Alert from 'app/components/alert';
import InlineSvg from 'app/components/inlineSvg';
import {Panel, PanelBody} from 'app/components/panels';
import space from 'app/styles/space';

export const GRID_HEAD_ROW_HEIGHT = 45;
export const GRID_BODY_ROW_HEIGHT = 40;

// Local z-index stacking context
// https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Positioning/Understanding_z_index/The_stacking_context
export const Z_INDEX_RESIZER = 1;

type GridEditableProps = {
  numColumn?: number;
  isEditable?: boolean;
  isEditing?: boolean;
  isPrimary?: boolean;
  isDragging?: boolean;
};

export const Header = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 0 ${space(1)} ${space(1)} 0;
`;

export const HeaderTitle = styled('h4')`
  margin: 0;
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.gray3};
`;

export const HeaderButton = styled('div')`
  display: flex;
  align-items: center;
  color: ${p => p.theme.gray3};
  cursor: pointer;
  font-size: ${p => p.theme.fontSizeSmall};

  > svg {
    margin-right: ${space(0.5)};
  }

  &:hover,
  &:active {
    color: ${p => p.theme.gray4};
  }
`;

const PanelWithProtectedBorder = styled(Panel)`
  overflow: hidden;
`;
export const Body: React.FC = props => (
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
  position: relative;
  display: grid;

  /* Overwritten by GridEditable.setGridTemplateColumns */
  grid-template-columns: repeat(auto-fill, 1fr);

  box-sizing: border-box;
  border-collapse: collapse;
  margin: 0;

  /* background-color: ${p => p.theme.offWhite}; */
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
export const GridHeadCell = styled('th')`
  /* By default, a grid item cannot be smaller than the size of its content.
     We override this by setting min-width to be 0. */
  position: relative; /* Used by GridResizer */
  min-width: 0;
  height: ${GRID_HEAD_ROW_HEIGHT}px;

  background-color: ${p => p.theme.offWhite};
  border-bottom: 1px solid ${p => p.theme.borderDark};

  &:first-child {
    border-top-left-radius: ${p => p.theme.borderRadius};
  }

  &:last-child {
    border-top-right-radius: ${p => p.theme.borderRadius};
    border-right: none;
  }
`;
export const GridHeadCellButton = styled('div')<GridEditableProps>`
  min-width: 24px; /* Ensure that edit/remove buttons are never hidden */
  display: block;
  margin: ${space(0.5)};
  padding: ${space(1.5)};
  border-radius: 2px;

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

/**
 * GridHeadCellButtonHover is the collection of interactive elements to add or
 * move the columns. They are expected to be draggable.
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
 * GridBody are the collection of elements that contains and display the data
 * of the Grid. They are rather simple.
 */
export const GridBody = styled('tbody')`
  display: contents;

  > tr:last-child td {
    border-bottom: none;
  }
`;
export const GridBodyCell = styled('td')`
  position: relative;
  /* By default, a grid item cannot be smaller than the size of its content.
     We override this by setting min-width to be 0. */
  min-width: 0;
  /* Locking in the height makes a lot of things easier */
  height: ${GRID_BODY_ROW_HEIGHT}px;
  padding: ${space(1)} ${space(2)};

  background-color: ${p => p.theme.white};
  border-bottom: 1px solid ${p => p.theme.borderLight};

  font-size: ${p => p.theme.fontSizeMedium};

  &:last-child {
    border-right: none;
  }
`;
export const GridBodyCellSpan = styled(GridBodyCell)`
  grid-column: 1 / -1;
`;
export const GridBodyCellLoading = styled('div')`
  min-height: 220px;
`;

export const GridBodyErrorAlert = styled(Alert)`
  margin: 0;
`;

/**
 * We have a fat GridResizer and we use the ::after pseudo-element to draw
 * a thin 1px border.
 *
 * The right-most GridResizer has a width of 2px and no right padding to make it
 * more obvious as it is usually sitting next to the border for <Panel>
 */
export const GridResizer = styled('div')<{dataRows: number; isLast?: boolean}>`
  position: absolute;
  top: 0px;
  right: ${p => (p.isLast ? '0px' : '-4px')};
  width: ${p => (p.isLast ? '6px' : '9px')};

  height: ${p => GRID_HEAD_ROW_HEIGHT + p.dataRows * GRID_BODY_ROW_HEIGHT}px;

  padding-left: 4px;
  padding-right: ${p => (p.isLast ? '0px' : '4px')};

  cursor: col-resize;
  z-index: ${Z_INDEX_RESIZER};

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
    background-color: ${p => p.theme.borderDark};
  }

  /**
   * Ensure that this rule is after :hover, otherwise it will flicker when
   * the GridResizer is dragged
   */
  &:active::after,
  &:focus::after {
    background-color: ${p => p.theme.gray2};
  }
`;
