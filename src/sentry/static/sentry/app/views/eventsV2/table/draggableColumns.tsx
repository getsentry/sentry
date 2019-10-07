import React from 'react';

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

  startColumnDrag = (
    event: React.MouseEvent<SVGSVGElement, MouseEvent>,
    initialColumnIndex: number
  ) => {
    const isDragging = this.state.isDragging;

    if (isDragging || event.type !== 'mousedown') {
      return;
    }

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
