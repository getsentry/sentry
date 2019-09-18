import React from 'react';

import InlineSvg from 'app/components/inlineSvg';

import {FLAG_GRID_RESIZABLE, FLAG_GRID_DRAGGABLE} from './flags';
import {
  GridHeadCell as GridHeadCellWrapper,
  GridHeadCellButton,
  GridHeadCellButtonHover,
  GridHeadCellButtonHoverBackground,
  GridHeadCellButtonHoverButtonGroup,
  GridHeadCellButtonHoverButton,
  GridHeadCellButtonHoverDraggable,
  GridHeadCellResizer,
} from './styles';

export type GridHeadCellProps = {
  isEditing: boolean;
  isPrimary: boolean;
  children: React.ReactNode | React.ReactChild;

  actions: {
    deleteColumn: () => void;
    toggleModalEditColumn: () => void;
  };
};
export type GridHeadCellState = {
  isHovering: boolean;
};

/**
 * The GridHeadCell has several user interactions that result in different
 * states that are only specific to the header. This component aims to abstract
 * the complexity of GridHeadCell away.
 */
class GridHeadCell extends React.Component<GridHeadCellProps, GridHeadCellState> {
  static defaultProps = {
    isEditing: false,
    isPrimary: false,
  };

  state = {
    isHovering: false,
  };

  setHovering = (isHovering: boolean) => {
    this.setState({isHovering});
  };

  renderButtonHoverDraggable(children: React.ReactNode) {
    const {actions} = this.props;

    return (
      <React.Fragment>
        {/* Ensure that background is always at the top. The background must be
            independent because it has <100% opacity, but the elements on top
            of it must be 100% opacity */}
        <GridHeadCellButtonHoverBackground>{children}</GridHeadCellButtonHoverBackground>

        <GridHeadCellButtonHover>
          {FLAG_GRID_DRAGGABLE && (
            <GridHeadCellButtonHoverDraggable src="icon-grabbable" />
          )}

          <GridHeadCellButtonHoverButtonGroup isFlagged={FLAG_GRID_DRAGGABLE}>
            <GridHeadCellButtonHoverButton onClick={actions.toggleModalEditColumn}>
              <InlineSvg src="icon-edit-pencil" />
            </GridHeadCellButtonHoverButton>
            <GridHeadCellButtonHoverButton onClick={actions.deleteColumn}>
              <InlineSvg src="icon-trash" />
            </GridHeadCellButtonHoverButton>
          </GridHeadCellButtonHoverButtonGroup>

          {FLAG_GRID_DRAGGABLE && (
            <GridHeadCellButtonHoverDraggable src="icon-grabbable" />
          )}
        </GridHeadCellButtonHover>
      </React.Fragment>
    );
  }

  render() {
    const {isEditing, children} = this.props;
    const {isHovering} = this.state;

    return (
      <GridHeadCellWrapper
        onMouseEnter={() => this.setHovering(true)}
        onMouseLeave={() => this.setHovering(false)}
      >
        <GridHeadCellButton isEditing={isEditing}>
          {children}
          {isEditing && isHovering && this.renderButtonHoverDraggable(children)}
        </GridHeadCellButton>

        {/* Keep the Resizer at the bottom to ensure that it is will always
            float on top of everything else */
        FLAG_GRID_RESIZABLE && <GridHeadCellResizer isEditing={isEditing} />}
      </GridHeadCellWrapper>
    );
  }
}

export default GridHeadCell;
