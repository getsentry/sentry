import React from 'react';
import styled from 'react-emotion';

import InlineSvg from 'app/components/inlineSvg';

import {FLAG_GRID_RESIZABLE} from './flags';
import {
  GridHeadCell as GridHeadCellWrapper,
  GridHeadCellButton,
  GridHeadCellButtonHover,
  GridHeadCellButtonHoverBackground,
  GridHeadCellButtonHoverButton,
  GridHeadCellButtonHoverDraggable,
  GridHeadCellResizer,
  Z_INDEX_ADD_COLUMN,
} from './styles';
import {GridColumnHeader} from './types';

export type GridHeadCellProps<Column> = {
  isColumnDragging: boolean;
  gridHeadCellButtonProps: {[prop: string]: any};
  isLast: boolean;

  isEditing: boolean;
  isPrimary: boolean;

  indexColumnOrder: number;
  column: Column;
  children: React.ReactNode | React.ReactChild;

  actions: {
    moveColumnCommit: (indexFrom: number, indexTo: number) => void;
    onDragStart: (
      event: React.MouseEvent<SVGSVGElement, MouseEvent>,
      indexFrom: number
    ) => void;
    deleteColumn: (index: number) => void;
    toggleModalEditColumn: (index?: number, column?: Column) => void;
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
class GridHeadCell<Column extends GridColumnHeader> extends React.Component<
  GridHeadCellProps<Column>,
  GridHeadCellState
> {
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

  deleteColumn = () => {
    const {actions, indexColumnOrder} = this.props;
    actions.deleteColumn(indexColumnOrder);
  };

  toggleModal = () => {
    const {actions, indexColumnOrder, column} = this.props;
    actions.toggleModalEditColumn(indexColumnOrder, column);
  };

  onDragStart = (event: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    // hide hovers when dragging
    this.setHovering(false);

    const fromColumn = this.props.indexColumnOrder;
    this.props.actions.onDragStart(event, fromColumn);
  };

  renderButtonHoverDraggable(children: React.ReactNode) {
    const {isHovering} = this.state;
    const {isEditing, isColumnDragging} = this.props;

    if (!isEditing || !isHovering || isColumnDragging) {
      return null;
    }

    return (
      <React.Fragment>
        {/* Ensure that background is always at the top. The background must be
            independent because it has <100% opacity, but the elements on top
            of it must be 100% opacity */}
        <GridHeadCellButtonHoverBackground>{children}</GridHeadCellButtonHoverBackground>

        <GridHeadCellButtonHover>
          <GridHeadCellButtonHoverDraggable
            src="icon-grabbable"
            onMouseDown={this.onDragStart}
          />

          <div>
            <GridHeadCellButtonHoverButton onClick={this.toggleModal}>
              <InlineSvg src="icon-edit-pencil" />
            </GridHeadCellButtonHoverButton>
            <GridHeadCellButtonHoverButton onClick={this.deleteColumn}>
              <InlineSvg src="icon-trash" />
            </GridHeadCellButtonHoverButton>
          </div>

          <GridHeadCellButtonHoverDraggable
            src="icon-grabbable"
            onMouseDown={this.onDragStart}
          />
        </GridHeadCellButtonHover>
      </React.Fragment>
    );
  }

  renderThing = () => {
    const {isEditing, isLast} = this.props;

    if (isLast) {
      return null;
    }

    return (
      <React.Fragment>
        <GridHeadCellResizer isEditing={isEditing} />
        <AddColumnButton />
      </React.Fragment>
    );
  };

  render() {
    const {isEditing, children, column, gridHeadCellButtonProps} = this.props;

    return (
      <GridHeadCellWrapper
        onMouseEnter={() => this.setHovering(true)}
        onMouseMove={() => this.setHovering(true)}
        onMouseLeave={() => this.setHovering(false)}
      >
        <GridHeadCellButton
          isDragging={column.isDragging}
          isEditing={isEditing}
          {...gridHeadCellButtonProps}
        >
          {children}
          {this.renderButtonHoverDraggable(children)}
        </GridHeadCellButton>

        {/* Keep the Resizer at the bottom to ensure that it is will always
            float on top of everything else */
        FLAG_GRID_RESIZABLE && this.renderThing()}
      </GridHeadCellWrapper>
    );
  }
}

const AddColumnButton = styled('div')`
  height: 24px;
  width: 24px;

  border-radius: 3px;

  position: absolute;
  top: ${45 - 12}px;
  right: -12px;

  background-color: blue;

  z-index: ${Z_INDEX_ADD_COLUMN};
`;

export default GridHeadCell;
