import React from 'react';

import {
  rectOfContent,
  clamp,
  toPercent,
  UserSelectValues,
  setBodyUserSelect,
} from './utils';

// divider handle is positioned at 50% width from the left-hand side
const DEFAULT_DIVIDER_POSITION = 0.4;

const selectRefs = (
  refs: Array<React.RefObject<HTMLDivElement>>,
  transform: (dividerDOM: HTMLDivElement) => void
) => {
  refs.forEach(ref => {
    if (ref.current) {
      transform(ref.current);
    }
  });
};

export type DividerHandlerManagerChildrenProps = {
  dividerPosition: number;
  setHover: (nextHover: boolean) => void;
  onDragStart: (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
  addDividerLineRef: () => React.RefObject<HTMLDivElement>;
  addGhostDividerLineRef: () => React.RefObject<HTMLDivElement>;
};

type StateType = {
  dividerPosition: number; // between 0 and 1
};

const DividerManagerContext = React.createContext<DividerHandlerManagerChildrenProps>({
  dividerPosition: DEFAULT_DIVIDER_POSITION,
  onDragStart: () => {},
  setHover: () => {},
  addDividerLineRef: () => React.createRef<HTMLDivElement>(),
  addGhostDividerLineRef: () => React.createRef<HTMLDivElement>(),
});

type PropType = {
  children: React.ReactNode;

  // this is the DOM element where the drag events occur. it's also the reference point
  // for calculating the relative mouse x coordinate.
  interactiveLayerRef: React.RefObject<HTMLDivElement>;
};

export class Provider extends React.Component<PropType, StateType> {
  state: StateType = {
    dividerPosition: DEFAULT_DIVIDER_POSITION,
  };

  componentWillUnmount() {
    this.cleanUpListeners();
  }

  previousUserSelect: UserSelectValues | null = null;
  dividerHandlePosition: number = DEFAULT_DIVIDER_POSITION;
  isDragging: boolean = false;
  dividerLineRefs: Array<React.RefObject<HTMLDivElement>> = [];
  ghostDividerLineRefs: Array<React.RefObject<HTMLDivElement>> = [];

  hasInteractiveLayer = (): boolean => !!this.props.interactiveLayerRef.current;

  addDividerLineRef = () => {
    const ref = React.createRef<HTMLDivElement>();
    this.dividerLineRefs.push(ref);
    return ref;
  };

  addGhostDividerLineRef = () => {
    const ref = React.createRef<HTMLDivElement>();
    this.ghostDividerLineRefs.push(ref);
    return ref;
  };

  setHover = (nextHover: boolean) => {
    if (this.isDragging) {
      return;
    }

    selectRefs(this.dividerLineRefs, dividerDOM => {
      if (nextHover) {
        dividerDOM.classList.add('hovering');
        return;
      }

      dividerDOM.classList.remove('hovering');
    });
  };

  onDragStart = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (this.isDragging || event.type !== 'mousedown' || !this.hasInteractiveLayer()) {
      return;
    }

    event.stopPropagation();

    // prevent the user from selecting things outside the minimap when dragging
    // the mouse cursor inside the minimap

    this.previousUserSelect = setBodyUserSelect({
      userSelect: 'none',
      MozUserSelect: 'none',
      msUserSelect: 'none',
      webkitUserSelect: 'none',
    });

    // attach event listeners so that the mouse cursor does not select text during a drag
    window.addEventListener('mousemove', this.onDragMove);
    window.addEventListener('mouseup', this.onDragEnd);

    this.setHover(true);

    // indicate drag has begun

    this.isDragging = true;

    selectRefs(this.dividerLineRefs, (dividerDOM: HTMLDivElement) => {
      dividerDOM.style.backgroundColor = 'rgba(73,80,87,0.75)';
      dividerDOM.style.cursor = 'col-resize';
    });

    selectRefs(this.ghostDividerLineRefs, (dividerDOM: HTMLDivElement) => {
      dividerDOM.style.cursor = 'col-resize';

      const {parentNode} = dividerDOM;

      if (!parentNode) {
        return;
      }

      const container = parentNode as HTMLDivElement;
      container.style.display = 'block';
    });
  };

  onDragMove = (event: MouseEvent) => {
    if (!this.isDragging || event.type !== 'mousemove' || !this.hasInteractiveLayer()) {
      return;
    }

    const rect = rectOfContent(this.props.interactiveLayerRef.current!);

    // mouse x-coordinate relative to the interactive layer's left side
    const rawMouseX = (event.pageX - rect.x) / rect.width;

    const min = 0;
    const max = 1;

    // clamp rawMouseX to be within [0, 1]
    this.dividerHandlePosition = clamp(rawMouseX, min, max);

    const dividerHandlePositionString = toPercent(this.dividerHandlePosition);

    selectRefs(this.ghostDividerLineRefs, (dividerDOM: HTMLDivElement) => {
      const {parentNode} = dividerDOM;

      if (!parentNode) {
        return;
      }

      const container = parentNode as HTMLDivElement;

      container.style.width = `calc(${dividerHandlePositionString} + 0.5px)`;
    });
  };

  onDragEnd = (event: MouseEvent) => {
    if (!this.isDragging || event.type !== 'mouseup' || !this.hasInteractiveLayer()) {
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

    this.isDragging = false;

    this.setHover(false);

    selectRefs(this.dividerLineRefs, (dividerDOM: HTMLDivElement) => {
      dividerDOM.style.backgroundColor = '';
      dividerDOM.style.cursor = '';
    });

    selectRefs(this.ghostDividerLineRefs, (dividerDOM: HTMLDivElement) => {
      dividerDOM.style.cursor = '';

      const {parentNode} = dividerDOM;

      if (!parentNode) {
        return;
      }

      const container = parentNode as HTMLDivElement;
      container.style.display = 'none';
    });

    this.setState({
      // commit dividerHandlePosition to be dividerPosition
      dividerPosition: this.dividerHandlePosition,
    });
  };

  cleanUpListeners = () => {
    if (this.isDragging) {
      // we only remove listeners during a drag
      window.removeEventListener('mousemove', this.onDragMove);
      window.removeEventListener('mouseup', this.onDragEnd);
    }
  };

  render() {
    const childrenProps = {
      dividerPosition: this.state.dividerPosition,
      setHover: this.setHover,
      onDragStart: this.onDragStart,
      addDividerLineRef: this.addDividerLineRef,
      addGhostDividerLineRef: this.addGhostDividerLineRef,
    };

    // NOTE: <DividerManagerContext.Provider /> will not re-render its children
    // - if the `value` prop changes, and
    // - if the `children` prop stays the same
    //
    // Thus, only <DividerManagerContext.Consumer /> components will re-render.
    // This is an optimization for when childrenProps changes, but this.props does not change.
    //
    // We prefer to minimize the amount of top-down prop drilling from this component
    // to the respective divider components.

    return (
      <DividerManagerContext.Provider value={childrenProps}>
        {this.props.children}
      </DividerManagerContext.Provider>
    );
  }
}

export const Consumer = DividerManagerContext.Consumer;
