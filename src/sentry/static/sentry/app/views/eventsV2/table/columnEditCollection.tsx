import React from 'react';
import ReactDOM from 'react-dom';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import {SectionHeading} from 'app/components/charts/styles';
import {IconAdd, IconDelete, IconGrabbable} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Column} from 'app/utils/discover/fields';
import theme from 'app/utils/theme';
import {getPointerPosition} from 'app/utils/touch';
import {setBodyUserSelect, UserSelectValues} from 'app/utils/userselect';

import {generateFieldOptions} from '../utils';

import {QueryField} from './queryField';

type Props = {
  // Input columns
  columns: Column[];
  fieldOptions: ReturnType<typeof generateFieldOptions>;
  // Fired when columns are added/removed/modified
  onChange: (columns: Column[]) => void;
  className?: string;
};

type State = {
  isDragging: boolean;
  draggingIndex: undefined | number;
  draggingTargetIndex: undefined | number;
  draggingGrabbedOffset: undefined | {x: number; y: number};
  left: undefined | number;
  top: undefined | number;
};

const DRAG_CLASS = 'draggable-item';
const GHOST_PADDING = 4;
const MAX_COL_COUNT = 20;

enum PlaceholderPosition {
  TOP,
  BOTTOM,
}

class ColumnEditCollection extends React.Component<Props, State> {
  state: State = {
    isDragging: false,
    draggingIndex: void 0,
    draggingTargetIndex: void 0,
    draggingGrabbedOffset: void 0,
    left: void 0,
    top: void 0,
  };

  componentDidMount() {
    if (!this.portal) {
      const portal = document.createElement('div');

      portal.style.position = 'absolute';
      portal.style.top = '0';
      portal.style.left = '0';
      portal.style.zIndex = String(theme.zIndex.modal);

      this.portal = portal;

      document.body.appendChild(this.portal);
    }
  }

  componentWillUnmount() {
    if (this.portal) {
      document.body.removeChild(this.portal);
    }
    this.cleanUpListeners();
  }

  previousUserSelect: UserSelectValues | null = null;
  portal: HTMLElement | null = null;
  dragGhostRef = React.createRef<HTMLDivElement>();

  keyForColumn(column: Column, isGhost: boolean): string {
    if (column.kind === 'function') {
      return [...column.function, isGhost].join(':');
    }
    return [...column.field, isGhost].join(':');
  }

  cleanUpListeners() {
    if (this.state.isDragging) {
      window.removeEventListener('mousemove', this.onDragMove);
      window.removeEventListener('touchmove', this.onDragMove);
      window.removeEventListener('mouseup', this.onDragEnd);
      window.removeEventListener('touchend', this.onDragEnd);
    }
  }

  // Signal to the parent that a new column has been added.
  handleAddColumn = () => {
    const newColumn: Column = {kind: 'field', field: ''};
    this.props.onChange([...this.props.columns, newColumn]);
  };

  handleUpdateColumn = (index: number, column: Column) => {
    const newColumns = [...this.props.columns];
    newColumns.splice(index, 1, column);
    this.props.onChange(newColumns);
  };

  removeColumn(index: number) {
    const newColumns = [...this.props.columns];
    newColumns.splice(index, 1);
    this.props.onChange(newColumns);
  }

  startDrag(
    event: React.MouseEvent<HTMLButtonElement> | React.TouchEvent<HTMLButtonElement>,
    index: number
  ) {
    const isDragging = this.state.isDragging;
    if (isDragging || !['mousedown', 'touchstart'].includes(event.type)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();

    const top = getPointerPosition(event, 'pageY');
    const left = getPointerPosition(event, 'pageX');

    // Compute where the user clicked on the drag handle. Avoids the element
    // jumping from the cursor on mousedown.
    const {x, y} = Array.from(document.querySelectorAll(`.${DRAG_CLASS}`))
      .find(n => n.contains(event.currentTarget))!
      .getBoundingClientRect();

    const draggingGrabbedOffset = {
      x: left - x + GHOST_PADDING,
      y: top - y + GHOST_PADDING,
    };

    // prevent the user from selecting things when dragging a column.
    this.previousUserSelect = setBodyUserSelect({
      userSelect: 'none',
      MozUserSelect: 'none',
      msUserSelect: 'none',
      webkitUserSelect: 'none',
    });

    // attach event listeners so that the mouse cursor can drag anywhere
    window.addEventListener('mousemove', this.onDragMove);
    window.addEventListener('touchmove', this.onDragMove);
    window.addEventListener('mouseup', this.onDragEnd);
    window.addEventListener('touchend', this.onDragEnd);

    this.setState({
      isDragging: true,
      draggingIndex: index,
      draggingTargetIndex: index,
      draggingGrabbedOffset,
      top,
      left,
    });
  }

  onDragMove = (event: MouseEvent | TouchEvent) => {
    const {isDragging, draggingTargetIndex, draggingGrabbedOffset} = this.state;

    if (!isDragging || !['mousemove', 'touchmove'].includes(event.type)) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();

    const pointerX = getPointerPosition(event, 'pageX');
    const pointerY = getPointerPosition(event, 'pageY');

    const dragOffsetX = draggingGrabbedOffset?.x ?? 0;
    const dragOffsetY = draggingGrabbedOffset?.y ?? 0;

    if (this.dragGhostRef.current) {
      // move the ghost box
      const ghostDOM = this.dragGhostRef.current;
      // Adjust so cursor is over the grab handle.
      ghostDOM.style.left = `${pointerX - dragOffsetX}px`;
      ghostDOM.style.top = `${pointerY - dragOffsetY}px`;
    }

    const dragItems = document.querySelectorAll(`.${DRAG_CLASS}`);
    // Find the item that the ghost is currently over.
    const targetIndex = Array.from(dragItems).findIndex(dragItem => {
      const rects = dragItem.getBoundingClientRect();
      const top = pointerY;

      const thresholdStart = window.scrollY + rects.top;
      const thresholdEnd = window.scrollY + rects.top + rects.height;

      return top >= thresholdStart && top <= thresholdEnd;
    });

    if (targetIndex >= 0 && targetIndex !== draggingTargetIndex) {
      this.setState({draggingTargetIndex: targetIndex});
    }
  };

  onDragEnd = (event: MouseEvent | TouchEvent) => {
    if (!this.state.isDragging || !['mouseup', 'touchend'].includes(event.type)) {
      return;
    }

    const sourceIndex = this.state.draggingIndex;
    const targetIndex = this.state.draggingTargetIndex;
    if (typeof sourceIndex !== 'number' || typeof targetIndex !== 'number') {
      return;
    }

    // remove listeners that were attached in startColumnDrag
    this.cleanUpListeners();

    // restore body user-select values
    if (this.previousUserSelect) {
      setBodyUserSelect(this.previousUserSelect);
      this.previousUserSelect = null;
    }

    // Reorder columns and trigger change.
    const newColumns = [...this.props.columns];
    const removed = newColumns.splice(sourceIndex, 1);
    newColumns.splice(targetIndex, 0, removed[0]);
    this.props.onChange(newColumns);

    this.setState({
      isDragging: false,
      left: undefined,
      top: undefined,
      draggingIndex: undefined,
      draggingTargetIndex: undefined,
      draggingGrabbedOffset: undefined,
    });
  };

  renderGhost(gridColumns: number) {
    const {isDragging, draggingIndex, draggingGrabbedOffset} = this.state;

    const index = draggingIndex;
    if (typeof index !== 'number' || !isDragging || !this.portal) {
      return null;
    }
    const dragOffsetX = draggingGrabbedOffset?.x ?? 0;
    const dragOffsetY = draggingGrabbedOffset?.y ?? 0;

    const top = Number(this.state.top) - dragOffsetY;
    const left = Number(this.state.left) - dragOffsetX;
    const col = this.props.columns[index];

    const style = {
      top: `${top}px`,
      left: `${left}px`,
    };
    const ghost = (
      <Ghost ref={this.dragGhostRef} style={style}>
        {this.renderItem(col, index, {isGhost: true, gridColumns})}
      </Ghost>
    );

    return ReactDOM.createPortal(ghost, this.portal);
  }

  renderItem(
    col: Column,
    i: number,
    {
      canDelete = true,
      isGhost = false,
      gridColumns = 2,
    }: {canDelete?: boolean; isGhost?: boolean; gridColumns: number}
  ) {
    const {fieldOptions} = this.props;
    const {isDragging, draggingTargetIndex, draggingIndex} = this.state;

    let placeholder: React.ReactNode = null;
    // Add a placeholder above the target row.
    if (isDragging && isGhost === false && draggingTargetIndex === i) {
      placeholder = (
        <DragPlaceholder
          key={`placeholder:${this.keyForColumn(col, isGhost)}`}
          className={DRAG_CLASS}
        />
      );
    }

    // If the current row is the row in the drag ghost return the placeholder
    // or a hole if the placeholder is elsewhere.
    if (isDragging && isGhost === false && draggingIndex === i) {
      return placeholder;
    }

    const position =
      Number(draggingTargetIndex) <= Number(draggingIndex)
        ? PlaceholderPosition.TOP
        : PlaceholderPosition.BOTTOM;

    return (
      <React.Fragment key={`${i}:${this.keyForColumn(col, isGhost)}`}>
        {position === PlaceholderPosition.TOP && placeholder}
        <RowContainer className={isGhost ? '' : DRAG_CLASS}>
          {canDelete ? (
            <Button
              aria-label={t('Drag to reorder')}
              onMouseDown={event => this.startDrag(event, i)}
              onTouchStart={event => this.startDrag(event, i)}
              icon={<IconGrabbable size="xs" />}
              size="zero"
              borderless
            />
          ) : (
            <span />
          )}
          <QueryField
            fieldOptions={fieldOptions}
            gridColumns={gridColumns}
            fieldValue={col}
            onChange={value => this.handleUpdateColumn(i, value)}
            takeFocus={i === this.props.columns.length - 1}
          />
          {canDelete ? (
            <Button
              aria-label={t('Remove column')}
              onClick={() => this.removeColumn(i)}
              icon={<IconDelete />}
              borderless
            />
          ) : (
            <span />
          )}
        </RowContainer>
        {position === PlaceholderPosition.BOTTOM && placeholder}
      </React.Fragment>
    );
  }

  render() {
    const {className, columns} = this.props;
    const canDelete = columns.length > 1;
    const canAdd = columns.length < MAX_COL_COUNT;
    const title = canAdd
      ? undefined
      : `Sorry, you reached the maximum number of columns. Delete columns to add more.`;

    // Get the longest number of columns so we can layout the rows.
    // We always want at least 2 columns.
    const gridColumns = Math.max(
      ...columns.map(col =>
        col.kind === 'function' && col.function[2] !== undefined ? 3 : 2
      )
    );

    return (
      <div className={className}>
        {this.renderGhost(gridColumns)}
        <RowContainer>
          <Heading gridColumns={gridColumns}>
            <StyledSectionHeading>{t('Tag / Field / Function')}</StyledSectionHeading>
            <StyledSectionHeading>{t('Field Parameter')}</StyledSectionHeading>
          </Heading>
        </RowContainer>
        {columns.map((col: Column, i: number) =>
          this.renderItem(col, i, {canDelete, gridColumns})
        )}
        <RowContainer>
          <Actions>
            <Button
              size="small"
              label={t('Add a Column')}
              onClick={this.handleAddColumn}
              title={title}
              disabled={!canAdd}
              icon={<IconAdd isCircled size="xs" />}
            >
              {t('Add a Column')}
            </Button>
          </Actions>
        </RowContainer>
      </div>
    );
  }
}

const RowContainer = styled('div')`
  display: grid;
  grid-template-columns: ${space(3)} 1fr ${space(3)};
  justify-content: center;
  align-items: center;
  width: 100%;
  touch-action: none;
  padding-bottom: ${space(1)};
`;

const Ghost = styled('div')`
  background: ${p => p.theme.background};
  display: block;
  position: absolute;
  padding: ${GHOST_PADDING}px;
  border-radius: ${p => p.theme.borderRadius};
  box-shadow: 0 0 15px rgba(0, 0, 0, 0.15);
  width: 710px;
  opacity: 0.8;
  cursor: grabbing;
  padding-right: ${space(2)};

  & > ${RowContainer} {
    padding-bottom: 0;
  }

  & svg {
    cursor: grabbing;
  }
`;

const DragPlaceholder = styled('div')`
  margin: 0 ${space(3)} ${space(1)} ${space(3)};
  border: 2px dashed ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  height: 41px;
`;

const Actions = styled('div')`
  grid-column: 2 / 3;
`;

const Heading = styled('div')<{gridColumns: number}>`
  grid-column: 2 / 3;

  /* Emulate the grid used in the column editor rows */
  display: grid;
  grid-template-columns: repeat(${p => p.gridColumns}, 1fr);
  grid-column-gap: ${space(1)};
`;

const StyledSectionHeading = styled(SectionHeading)`
  margin: 0;
`;

export default ColumnEditCollection;
