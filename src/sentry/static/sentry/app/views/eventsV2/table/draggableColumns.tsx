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
  draggingColumnIndex: undefined | number;
  destinationColumnIndex: undefined | number;
};

type Props = {
  children: (props: DraggableColumnsChildrenProps) => JSX.Element;
  columnOrder: TableColumn<React.ReactText>[];
};

type State = {
  isDragging: boolean;
  left: undefined | number;
  top: undefined | number;

  draggingColumnIndex: undefined | number;
  destinationColumnIndex: undefined | number;
};

class DraggableColumns extends React.Component<Props, State> {
  state: State = {
    isDragging: false,

    // initial coordinates for when the drag began
    left: void 0,
    top: void 0,

    draggingColumnIndex: void 0,
    destinationColumnIndex: void 0,
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
      left: event.pageX,
      top: event.pageY,
    });

    console.log('dragging column', initialColumnIndex, columnBeingDragged);

    // TODO: experiment, clean this up

    const foo = document.querySelectorAll('.grid-head-cell-button');
    const moo = Array.from(foo).map(column => {
      return column.getBoundingClientRect();
    });

    console.log('foo', foo);
    console.log('moo', moo);

    foo.forEach(element => {
      const rects = element.getBoundingClientRect();

      const reference = document.createElement('div');
      reference.style.height = '10px';
      reference.style.width = `${rects.width * 0.8}px`;
      reference.style.position = 'absolute';
      reference.style.top = `${rects.top}px`;
      reference.style.left = `${rects.left + rects.width * 0.1}px`;
      reference.style.zIndex = '9999';
      reference.style.backgroundColor = 'yellow';

      //   document.body.appendChild(reference);
    });
  };

  onDragMove = (event: MouseEvent) => {
    if (!this.state.isDragging || event.type !== 'mousemove') {
      return;
    }

    if (this.dragGhostRef.current) {
      // move the ghosted column title

      const ghostDOM = this.dragGhostRef.current;
      ghostDOM.style.left = `${event.pageX}px`;
      ghostDOM.style.top = `${event.pageY}px`;
    }

    const gridHeadCellButtons = document.querySelectorAll('.grid-head-cell-button');

    const destinationColumnIndex = Array.from(gridHeadCellButtons).findIndex(
      headerElement => {
        const rects = headerElement.getBoundingClientRect();

        const left = event.pageX;

        const thresholdStart = rects.left;
        const thresholdEnd = rects.left + rects.width;

        return left >= thresholdStart && left <= thresholdEnd;
      }
    );

    if (destinationColumnIndex >= 0) {
      const destinationColumn = this.props.columnOrder[destinationColumnIndex];

      console.log('move to', destinationColumn.name);

      this.setState({
        destinationColumnIndex,
      });
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
      left: void 0,
      top: void 0,
      draggingColumnIndex: void 0,
      destinationColumnIndex: void 0,
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
      draggingColumnIndex: this.state.draggingColumnIndex,
      destinationColumnIndex: this.state.destinationColumnIndex,
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

      const top = `${this.state.top}px`;
      const left = `${this.state.left}px`;

      const ghost = (
        <React.Fragment>
          <GhostPlacement
            innerRef={this.dragGhostRef}
            style={{display: 'block', top, left}}
          >
            <GhostContentBox>{columnBeingDragged.name}</GhostContentBox>
          </GhostPlacement>
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

const GhostPlacement = styled('div')`
  position: absolute;
  top: 0;
  bottom: 0;
  display: none;

  user-select: none;
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
