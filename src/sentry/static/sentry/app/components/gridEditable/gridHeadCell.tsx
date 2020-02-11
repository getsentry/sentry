import React from 'react';

import InlineSvg from 'app/components/inlineSvg';
import {IconEdit} from 'app/icons/iconEdit';

import {
  GridHeadCell as GridHeadCellWrapper,
  GridHeadCellButton,
  GridHeadCellButtonHover,
  GridHeadCellButtonHoverButton,
  GridHeadCellButtonHoverDraggable,
} from './styles';
import {GridColumnHeader} from './types';

type DefaultProps = {
  isFirst: boolean;
  isEditing: boolean;
  isDeletable: boolean;
};

export type GridHeadCellProps<Column> = DefaultProps & {
  isColumnDragging: boolean;
  gridHeadCellButtonProps: {[prop: string]: any};

  indexColumnOrder: number;
  column: Column;
  children: React.ReactNode | React.ReactChild;

  openModalAddColumnAt: (insertIndex: number) => void;

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
  static defaultProps: DefaultProps = {
    isEditing: false,
    isDeletable: true,
    isFirst: false,
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

  renderButtonHoverDraggable() {
    const {isHovering} = this.state;
    const {isEditing, isDeletable, isColumnDragging} = this.props;

    if (!isEditing || !isHovering || isColumnDragging) {
      return null;
    }

    const deleteButton = isDeletable ? (
      <GridHeadCellButtonHoverButton onClick={this.deleteColumn}>
        <InlineSvg src="icon-trash" />
      </GridHeadCellButtonHoverButton>
    ) : null;

    return (
      <React.Fragment>
        {/* Ensure that background is always at the top. The background must be
            independent because it has <100% opacity, but the elements on top
            of it must be 100% opacity */}
        <GridHeadCellButtonHover>
          <GridHeadCellButtonHoverDraggable
            src="icon-grabbable"
            onMouseDown={this.onDragStart}
          />

          <div>
            <GridHeadCellButtonHoverButton onClick={this.toggleModal}>
              <IconEdit size="xs" />
            </GridHeadCellButtonHoverButton>
            {deleteButton}
          </div>

          <GridHeadCellButtonHoverDraggable
            src="icon-grabbable"
            onMouseDown={this.onDragStart}
          />
        </GridHeadCellButtonHover>
      </React.Fragment>
    );
  }

  render() {
    const {isEditing, isFirst, children, column, gridHeadCellButtonProps} = this.props;

    return (
      <GridHeadCellWrapper isFirst={isFirst}>
        <GridHeadCellButton
          isDragging={column.isDragging}
          {...gridHeadCellButtonProps}
          isEditing={isEditing}
          onMouseEnter={() => this.setHovering(true)}
          onMouseMove={() => this.setHovering(true)}
          onMouseLeave={() => this.setHovering(false)}
        >
          {children}
          {this.renderButtonHoverDraggable()}
        </GridHeadCellButton>
      </GridHeadCellWrapper>
    );
  }
}

export default GridHeadCell;
