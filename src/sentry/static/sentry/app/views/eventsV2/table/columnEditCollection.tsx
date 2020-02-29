import React from 'react';
import ReactDOM from 'react-dom';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import {IconAdd, IconGrabbable, IconClose} from 'app/icons';
import {t} from 'app/locale';
import {OrganizationSummary} from 'app/types';
import space from 'app/styles/space';
import {
  UserSelectValues,
  setBodyUserSelect,
} from 'app/components/events/interfaces/spans/utils';

import {Column} from '../eventView';
import ColumnEditRow from './columnEditRow';

type Props = {
  // Input columns
  columns: Column[];
  organization: OrganizationSummary;
  tagKeys: string[];
  // Fired when columns are added/removed/modified
  onChange: (columns: Column[]) => void;
};

type State = {
  isDragging: boolean;
  draggingIndex: undefined | number;
  draggingTargetIndex: undefined | number;
  left: undefined | number;
  top: undefined | number;
};

const DRAG_CLASS = 'draggable-item';

class ColumnEditCollection extends React.Component<Props, State> {
  state = {
    isDragging: false,
    draggingIndex: void 0,
    draggingTargetIndex: void 0,
    left: void 0,
    top: void 0,
  };

  componentDidMount() {
    if (!this.portal) {
      const portal = document.createElement('div');

      portal.style.position = 'absolute';
      portal.style.top = '0';
      portal.style.left = '0';
      portal.style.zIndex = '9999';

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

  cleanUpListeners() {
    if (this.state.isDragging) {
      window.removeEventListener('mousemove', this.onDragMove);
      window.removeEventListener('mouseup', this.onDragEnd);
    }
  }

  // Signal to the parent that a new column has been added.
  handleAddColumn = () => {
    const newColumns = [...this.props.columns, {aggregation: '', field: ''}];
    this.props.onChange(newColumns);
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

  startDrag(event: React.MouseEvent<HTMLButtonElement>, index: number) {
    const isDragging = this.state.isDragging;
    if (isDragging || event.type !== 'mousedown') {
      return;
    }

    // prevent the user from selecting things when dragging a column.
    this.previousUserSelect = setBodyUserSelect({
      userSelect: 'none',
      MozUserSelect: 'none',
      msUserSelect: 'none',
    });

    // attach event listeners so that the mouse cursor can drag anywhere
    window.addEventListener('mousemove', this.onDragMove);
    window.addEventListener('mouseup', this.onDragEnd);

    this.setState({
      isDragging: true,
      draggingIndex: index,
      draggingTargetIndex: index,
      top: event.pageY,
      left: event.pageX,
    });
  }

  onDragMove = (event: MouseEvent) => {
    if (!this.state.isDragging || event.type !== 'mousemove') {
      return;
    }

    if (this.dragGhostRef.current) {
      // move the ghost box
      const ghostDOM = this.dragGhostRef.current;
      ghostDOM.style.left = `${event.pageX}px`;
      ghostDOM.style.top = `${event.pageY}px`;
    }

    const dragItems = document.querySelectorAll(`.${DRAG_CLASS}`);
    // Find the item that the ghost is currently over.
    const targetIndex = Array.from(dragItems).findIndex(dragItem => {
      const rects = dragItem.getBoundingClientRect();
      const top = event.pageY;

      const thresholdStart = rects.top;
      const thresholdEnd = rects.top + rects.height;

      return top >= thresholdStart && top <= thresholdEnd;
    });

    if (targetIndex >= 0 && targetIndex !== this.state.draggingTargetIndex) {
      this.setState({draggingTargetIndex: targetIndex});
    }
  };

  onDragEnd = (event: MouseEvent) => {
    if (!this.state.isDragging || event.type !== 'mouseup') {
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
    });
  };

  renderGhost() {
    const index = this.state.draggingIndex;
    if (typeof index !== 'number' || !this.state.isDragging || !this.portal) {
      return null;
    }

    const top = `${this.state.top}px`;
    const left = `${this.state.left}px`;
    const col = this.props.columns[index];

    const ghost = (
      <Ghost ref={this.dragGhostRef} style={{display: 'block', top, left}}>
        {this.renderItem(col, index, true)}
      </Ghost>
    );

    return ReactDOM.createPortal(ghost, this.portal);
  }

  renderItem(col: Column, i: number, isGhost = false) {
    const {organization, tagKeys} = this.props;
    const {isDragging, draggingTargetIndex} = this.state;

    // Replace the dragged row with a placeholder.
    if (isDragging && isGhost === false && draggingTargetIndex === i) {
      return <DragPlaceholder key={`placeholder-${i}`} className={DRAG_CLASS} />;
    }

    return (
      <RowContainer key={`container-${i}`}>
        <IconButton
          aria-label={t('Drag to reorder columns')}
          onMouseDown={event => this.startDrag(event, i)}
        >
          <IconGrabbable size="sm" />
        </IconButton>
        <ColumnEditRow
          className={DRAG_CLASS}
          organization={organization}
          column={col}
          parentIndex={i}
          tagKeys={tagKeys}
          onChange={this.handleUpdateColumn}
        />
        <IconButton aria-label={t('Remove column')} onClick={() => this.removeColumn(i)}>
          <IconClose size="sm" />
        </IconButton>
      </RowContainer>
    );
  }

  render() {
    const {columns} = this.props;
    return (
      <div>
        {this.renderGhost()}
        {columns.map((col: Column, i: number) => this.renderItem(col, i))}
        <Actions>
          <Button onClick={this.handleAddColumn}>
            <StyledIconAdd circle size="sm" />
            {t('Add a column')}
          </Button>
        </Actions>
      </div>
    );
  }
}

const RowContainer = styled('div')`
  display: flex;
  align-items: center;
  width: 100%;

  margin-bottom: ${space(1)};
`;

const Ghost = styled('div')`
  background: ${p => p.theme.white};
  position: absolute;
  padding: 4px;
  border: 4px solid ${p => p.theme.borderLight};
  border-radius: 4px;
  width: 400px;
  opacity: 80%;

  & > ${RowContainer} {
    margin-bottom: 0;
  }
`;

const DragPlaceholder = styled('div')`
  margin: 0 ${space(1)} ${space(1)} ${space(1)};
  border: 2px dashed ${p => p.theme.borderLight};
  width: 100%;
  height: 38px;
`;

const IconButton = styled('button')`
  padding: 0 ${space(1)};
  margin: 0;
  border: 0;
  height: 16px;
  background: transparent;
  outline: none;
`;

const StyledIconAdd = styled(IconAdd)`
  margin-right: ${space(1)};
`;

const Actions = styled('div')`
  padding-top: ${space(1)};
`;

export default ColumnEditCollection;
