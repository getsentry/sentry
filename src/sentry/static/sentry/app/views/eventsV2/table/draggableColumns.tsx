import React from 'react';
import ReactDOM from 'react-dom';
import styled from 'react-emotion';

import {
  UserSelectValues,
  setBodyUserSelect,
} from 'app/components/events/interfaces/spans/utils.tsx';
import {TableColumn} from './types';

export type DraggableColumnsChildrenProps = {
  startColumnDrag: (
    event: React.MouseEvent<SVGSVGElement, MouseEvent>,
    initialColumnIndex: number
  ) => void;
};

type Props = {
  children: (props: DraggableColumnsChildrenProps) => JSX.Element;
  columnOrder: TableColumn<React.ReactText>[];
};

type State = {
  isDragging: boolean;
  draggingColumnIndex: undefined | number;
};

class DraggableColumns extends React.Component<Props, State> {
  state: State = {
    isDragging: false,
    draggingColumnIndex: void 0,
  };

  previousUserSelect: UserSelectValues | null = null;
  portal: HTMLElement | null = null;
  dragGhostRef = React.createRef<HTMLDivElement>();

  startColumnDrag = (
    event: React.MouseEvent<SVGSVGElement, MouseEvent>,
    initialColumnIndex: number
  ) => {
    const isDragging = this.state.isDragging;

    if (isDragging || event.type !== 'mousedown') {
      return;
    }

    // prevent the user from selecting things outside the minimap when dragging
    // the mouse cursor outside the minimap

    this.previousUserSelect = setBodyUserSelect({
      userSelect: 'none',
      MozUserSelect: 'none',
      msUserSelect: 'none',
    });

    // attach event listeners so that the mouse cursor can drag anywhere

    window.addEventListener('mousemove', this.onDragMove);
    window.addEventListener('mouseup', this.onDragEnd);

    const columnBeingDragged = this.props.columnOrder[initialColumnIndex];

    this.setState({
      isDragging: true,
      draggingColumnIndex: initialColumnIndex,
    });

    console.log('dragging column', initialColumnIndex, columnBeingDragged);
  };

  onDragMove = (event: MouseEvent) => {
    if (!this.state.isDragging || event.type !== 'mousemove') {
      return;
    }

    // console.log('event.pageX', event.pageX);

    if (this.dragGhostRef.current) {
      const ghostDOM = this.dragGhostRef.current;
      ghostDOM.style.left = `${event.pageX}px`;
      ghostDOM.style.top = `${event.pageY}px`;
    }
  };

  onDragEnd = (event: MouseEvent) => {
    if (!this.state.isDragging || event.type !== 'mouseup') {
      return;
    }

    // remove listeners that were attached in startColumnDrag

    this.cleanUpListeners();

    // restore body styles

    if (this.previousUserSelect) {
      setBodyUserSelect(this.previousUserSelect);
      this.previousUserSelect = null;
    }

    // indicate drag has ended

    this.setState({
      isDragging: false,
      draggingColumnIndex: void 0,
    });

    console.log('ended');
  };

  cleanUpListeners = () => {
    if (this.state.isDragging) {
      window.removeEventListener('mousemove', this.onDragMove);
      window.removeEventListener('mouseup', this.onDragEnd);
    }
  };

  componentDidMount() {
    if (!this.portal) {
      const portal = document.createElement('div');
      portal.setAttribute('id', 'draggable-columns-portal');

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

  renderChildren = () => {
    const childrenProps = {
      startColumnDrag: this.startColumnDrag,
    };

    return this.props.children(childrenProps);
  };

  renderThing = () => {
    if (
      this.portal &&
      this.state.isDragging &&
      typeof this.state.draggingColumnIndex === 'number'
    ) {
      const columnBeingDragged = this.props.columnOrder[this.state.draggingColumnIndex];

      const ghost = (
        <React.Fragment>
          <DebugSquare innerRef={this.dragGhostRef}>
            <GhostContentBox>{columnBeingDragged.name}</GhostContentBox>
          </DebugSquare>
        </React.Fragment>
      );

      return ReactDOM.createPortal(ghost, this.portal);
    }

    return null;
  };

  render() {
    return (
      <React.Fragment>
        {this.renderThing()}
        {this.renderChildren()}
      </React.Fragment>
    );
  }
}

const DebugSquare = styled('div')`
  position: absolute;
  top: 0;
  bottom: 0;
`;

const GhostContentBox = styled('div')`
  background-color: white;

  outline: 1px solid red;
`;

// const MouseGuide = styled('div')`
//   position: absolute;
//   top: 0;
//   bottom: 0;

//   width: 1px;
//   height: 100vh;
//   background-color: red;
// `;

export default DraggableColumns;
