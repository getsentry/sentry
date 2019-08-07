import React from 'react';

import {rectOfContent, clamp} from './utils';

// we establish the minimum window size so that the window size of 0% is not possible
const MINIMUM_WINDOW_SIZE = 0.5 / 100; // 0.5% window size

enum ViewHandleType {
  Left,
  Right,
}

export type DragManagerChildrenProps = {
  isDragging: boolean;

  // left-side handle

  onLeftHandleDragStart: (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
  leftHandlePosition: number; // between 0 to 1
  viewWindowStart: number; // between 0 to 1

  // right-side handle

  onRightHandleDragStart: (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
  rightHandlePosition: number; // between 0 to 1
  viewWindowEnd: number; // between 0 to 1
};

type DragManagerProps = {
  children: (props: DragManagerChildrenProps) => JSX.Element;
  interactiveLayerRef: React.RefObject<HTMLDivElement>;
};

type DragManagerState = {
  isDragging: boolean;
  currentDraggingHandle: ViewHandleType | undefined;
  leftHandlePosition: number;
  rightHandlePosition: number;

  viewWindowStart: number;
  viewWindowEnd: number;
};

class DragManager extends React.Component<DragManagerProps, DragManagerState> {
  state: DragManagerState = {
    isDragging: false,
    currentDraggingHandle: void 0,
    leftHandlePosition: 0, // positioned on the left-most side at 0%
    rightHandlePosition: 1, // positioned on the right-most side at 100%

    viewWindowStart: 0,
    viewWindowEnd: 1,
  };

  previousUserSelect: string | null = null;

  hasInteractiveLayer = (): boolean => {
    return !!this.props.interactiveLayerRef.current;
  };

  onDragStart = (viewHandle: ViewHandleType) => (
    event: React.MouseEvent<HTMLDivElement, MouseEvent>
  ) => {
    if (
      this.state.isDragging ||
      event.type !== 'mousedown' ||
      !this.hasInteractiveLayer()
    ) {
      return;
    }

    // prevent the user from selecting things outside the minimap when dragging
    // the mouse cursor outside the minimap

    this.previousUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = 'none';

    // attach event listeners so that the mouse cursor can drag outside of the
    // minimap
    window.addEventListener('mousemove', this.onDragMove);
    window.addEventListener('mouseup', this.onDragEnd);

    // indicate drag has begun

    this.setState({
      isDragging: true,
      currentDraggingHandle: viewHandle,
    });
  };

  onLeftHandleDragStart = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    this.onDragStart(ViewHandleType.Left)(event);
  };

  onRightHandleDragStart = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    this.onDragStart(ViewHandleType.Right)(event);
  };

  onDragMove = (event: MouseEvent) => {
    if (
      !this.state.isDragging ||
      event.type !== 'mousemove' ||
      !this.hasInteractiveLayer()
    ) {
      return;
    }

    const rect = rectOfContent(this.props.interactiveLayerRef.current!);

    // mouse x-coordinate relative to the interactive layer's left side
    const rawMouseX = (event.pageX - rect.x) / rect.width;

    switch (this.state.currentDraggingHandle) {
      case ViewHandleType.Left: {
        const min = 0;
        const max = this.state.rightHandlePosition - MINIMUM_WINDOW_SIZE;

        this.setState({
          // clamp rawMouseX to be within [0, rightHandlePosition - MINIMUM_WINDOW_SIZE]
          leftHandlePosition: clamp(rawMouseX, min, max),
        });
        break;
      }
      case ViewHandleType.Right: {
        const min = this.state.leftHandlePosition + MINIMUM_WINDOW_SIZE;
        const max = 1;

        this.setState({
          // clamp rawMouseX to be within [leftHandlePosition + MINIMUM_WINDOW_SIZE, 1]
          rightHandlePosition: clamp(rawMouseX, min, max),
        });
        break;
      }
      default: {
        throw Error('this.state.currentDraggingHandle is undefined');
      }
    }
  };

  onDragEnd = (event: MouseEvent) => {
    if (
      !this.state.isDragging ||
      event.type !== 'mouseup' ||
      !this.hasInteractiveLayer()
    ) {
      return;
    }

    // remove listeners that were attached in onDragStart

    this.cleanUpListeners();

    // restore body styles

    document.body.style.userSelect = this.previousUserSelect;
    this.previousUserSelect = null;

    // indicate drag has ended

    switch (this.state.currentDraggingHandle) {
      case ViewHandleType.Left: {
        this.setState(state => {
          return {
            isDragging: false,
            currentDraggingHandle: void 0,

            // commit leftHandlePosition to be viewWindowStart
            viewWindowStart: state.leftHandlePosition,
          };
        });
        break;
      }
      case ViewHandleType.Right: {
        this.setState(state => {
          return {
            isDragging: false,
            currentDraggingHandle: void 0,

            // commit rightHandlePosition to be viewWindowEnd
            viewWindowEnd: state.rightHandlePosition,
          };
        });
        break;
      }
      default: {
        throw Error('this.state.currentDraggingHandle is undefined');
      }
    }

    this.setState({
      isDragging: false,
      currentDraggingHandle: void 0,
    });
  };

  cleanUpListeners = () => {
    if (this.state.isDragging) {
      window.removeEventListener('mousemove', this.onDragMove);
      window.removeEventListener('mouseup', this.onDragEnd);
    }
  };

  render() {
    const childrenProps = {
      isDragging: this.state.isDragging,

      onLeftHandleDragStart: this.onLeftHandleDragStart,
      leftHandlePosition: this.state.leftHandlePosition,
      viewWindowStart: this.state.viewWindowStart,

      onRightHandleDragStart: this.onRightHandleDragStart,
      rightHandlePosition: this.state.rightHandlePosition,
      viewWindowEnd: this.state.viewWindowEnd,
    };

    return this.props.children(childrenProps);
  }
}

export default DragManager;
