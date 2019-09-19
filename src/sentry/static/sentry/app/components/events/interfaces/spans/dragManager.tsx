import React from 'react';

import {rectOfContent, clamp, UserSelectValues, setBodyUserSelect} from './utils';

// we establish the minimum window size so that the window size of 0% is not possible
const MINIMUM_WINDOW_SIZE = 0.5 / 100; // 0.5% window size

enum ViewHandleType {
  Left,
  Right,
}

export type DragManagerChildrenProps = {
  // handles

  isDragging: boolean;

  // left-side handle

  onLeftHandleDragStart: (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
  leftHandlePosition: number; // between 0 to 1

  // right-side handle

  onRightHandleDragStart: (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
  rightHandlePosition: number; // between 0 to 1

  // custom window selection

  isCustomWindowDragging: boolean;
  customWindowSize: number; // between 0 (0%) and 1 (100%)

  // window sizes

  viewWindowStart: number; // between 0 to 1
  viewWindowEnd: number; // between 0 to 1
};

type DragManagerProps = {
  children: (props: DragManagerChildrenProps) => JSX.Element;

  // this is the DOM element where the drag events occur. it's also the reference point
  // for calculating the relative mouse x coordinate.
  interactiveLayerRef: React.RefObject<HTMLDivElement>;
};

type DragManagerState = {
  // draggable handles

  isDragging: boolean;
  currentDraggingHandle: ViewHandleType | undefined;
  leftHandlePosition: number;
  rightHandlePosition: number;

  // custom window selection

  isCustomWindowDragging: boolean;
  customWindowSize: number;

  // window sizes

  viewWindowStart: number;
  viewWindowEnd: number;
};

class DragManager extends React.Component<DragManagerProps, DragManagerState> {
  state: DragManagerState = {
    // draggable handles

    isDragging: false,
    currentDraggingHandle: void 0,
    leftHandlePosition: 0, // positioned on the left-most side at 0%
    rightHandlePosition: 1, // positioned on the right-most side at 100%

    // custom window selection

    isCustomWindowDragging: false,
    customWindowSize: 0, // between 0 (0%) and 1 (100%)

    // window sizes

    viewWindowStart: 0,
    viewWindowEnd: 1,
  };

  previousUserSelect: UserSelectValues | null = null;

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

    this.previousUserSelect = setBodyUserSelect({
      userSelect: 'none',
      MozUserSelect: 'none',
      msUserSelect: 'none',
    });

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

    if (this.previousUserSelect) {
      setBodyUserSelect(this.previousUserSelect);
      this.previousUserSelect = null;
    }

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
        return;
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
        return;
      }
      default: {
        throw Error('this.state.currentDraggingHandle is undefined');
      }
    }
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
      isDragging: this.state.isDragging,

      // left handle

      onLeftHandleDragStart: this.onLeftHandleDragStart,
      leftHandlePosition: this.state.leftHandlePosition,

      // right handle

      onRightHandleDragStart: this.onRightHandleDragStart,
      rightHandlePosition: this.state.rightHandlePosition,

      // custom window selection

      isCustomWindowDragging: this.state.isCustomWindowDragging,
      customWindowSize: this.state.customWindowSize,

      // window sizes

      viewWindowStart: this.state.viewWindowStart,
      viewWindowEnd: this.state.viewWindowEnd,
    };

    return this.props.children(childrenProps);
  }
}

export default DragManager;
