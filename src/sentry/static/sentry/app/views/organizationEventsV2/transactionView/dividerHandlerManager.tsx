import React from 'react';

import {
  rectOfContent,
  clamp,
  toPercent,
  UserSelectValues,
  setBodyUserSelect,
} from './utils';

// divider handle is positioned at 50% width from the left-hand side
const DEFAULT_DIVIDER_POSITION = 0.5;

const selectDividerLines = (transform: (dividerDOM: HTMLDivElement) => void): void => {
  document
    .querySelectorAll<HTMLDivElement>("[data-test-id='divider-line']")
    .forEach(transform);
};

const selectGhostDividerLines = (
  transform: (dividerDOM: HTMLDivElement) => void
): void => {
  document
    .querySelectorAll<HTMLDivElement>("[data-test-id='divider-line-ghost']")
    .forEach(transform);
};

export type DividerHandlerManagerChildrenProps = {
  dividerPosition: number;
  setHover: (nextHover: boolean) => void;
  onDragStart: (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
};

type StateType = {
  dividerPosition: number; // between 0 and 1
};

const DividerManagerContext = React.createContext<DividerHandlerManagerChildrenProps>({
  dividerPosition: DEFAULT_DIVIDER_POSITION,
  onDragStart: () => {},
  setHover: () => {},
});

type PropType = {
  children: React.ReactNode;
  interactiveLayerRef: React.RefObject<HTMLDivElement>;
};

export class Provider extends React.Component<PropType, StateType> {
  state: StateType = {
    dividerPosition: DEFAULT_DIVIDER_POSITION,
  };

  previousUserSelect: UserSelectValues | null = null;
  dividerHandlePosition: number = DEFAULT_DIVIDER_POSITION;
  isDragging: boolean = false;

  hasInteractiveLayer = (): boolean => {
    return !!this.props.interactiveLayerRef.current;
  };

  setHover = (nextHover: boolean) => {
    if (this.isDragging) {
      return;
    }

    selectDividerLines(dividerDOM => {
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
    // the mouse cursor outside the minimap

    this.previousUserSelect = setBodyUserSelect({
      userSelect: 'none',
      MozUserSelect: 'none',
      msUserSelect: 'none',
    });

    // attach event listeners so that the mouse cursor does not select text during a drag
    window.addEventListener('mousemove', this.onDragMove);
    window.addEventListener('mouseup', this.onDragEnd);

    // indicate drag has begun

    this.isDragging = true;

    selectDividerLines((dividerDOM: HTMLDivElement) => {
      dividerDOM.style.backgroundColor = 'rgba(73,80,87,0.75)';
    });

    selectGhostDividerLines((dividerDOM: HTMLDivElement) => {
      dividerDOM.style.display = 'block';
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

    selectDividerLines((dividerDOM: HTMLDivElement) => {
      dividerDOM.style.left = dividerHandlePositionString;
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

    selectDividerLines((dividerDOM: HTMLDivElement) => {
      dividerDOM.style.backgroundColor = null;
    });

    selectGhostDividerLines((dividerDOM: HTMLDivElement) => {
      dividerDOM.style.display = 'none';
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
