import React from 'react';

import {
  UserSelectValues,
  setBodyUserSelect,
} from 'app/components/events/interfaces/spans/utils.tsx';

export type DraggableColumnsChildrenProps = {
  startColumnDrag: (
    event: React.MouseEvent<SVGSVGElement, MouseEvent>,
    initialColumnIndex: number
  ) => void;
};

type Props = {
  children: (props: DraggableColumnsChildrenProps) => JSX.Element;
};

type State = {
  isDragging: boolean;
};

class DraggableColumns extends React.Component<Props, State> {
  state: State = {
    isDragging: false,
  };

  previousUserSelect: UserSelectValues | null = null;

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

    this.setState({
      isDragging: true,
    });

    console.log('dragging column', initialColumnIndex);
  };

  onDragMove = (event: MouseEvent) => {
    if (!this.state.isDragging || event.type !== 'mousemove') {
      return;
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
    });
  };

  cleanUpListeners = () => {
    if (this.state.isDragging) {
      window.removeEventListener('mousemove', this.onDragMove);
      window.removeEventListener('mouseup', this.onDragEnd);
    }
  };

  componentWillUnmount() {
    this.cleanUpListeners();
  }

  render() {
    const childrenProps = {
      startColumnDrag: this.startColumnDrag,
    };

    return this.props.children(childrenProps);
  }
}

export default DraggableColumns;
