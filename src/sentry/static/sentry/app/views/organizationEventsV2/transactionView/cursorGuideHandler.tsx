import React from 'react';

import {rectOfContent, clamp} from './utils';

export type CursorGuideManagerChildrenProps = {
  showCursorGuide: boolean;
  mouseLeft: number | undefined;

  displayCursorGuide: (mousePageX: number) => void;
  hideCursorGuide: () => void;
};

const CursorGuideManagerContext = React.createContext<CursorGuideManagerChildrenProps>({
  showCursorGuide: false,
  mouseLeft: void 0,

  displayCursorGuide: () => {},
  hideCursorGuide: () => {},
});

type PropType = {
  children: React.ReactNode;

  // this is the DOM element where the drag events occur. it's also the reference point
  // for calculating the relative mouse x coordinate.
  interactiveLayerRef: React.RefObject<HTMLDivElement>;
};

type StateType = {
  showCursorGuide: boolean;
  mouseLeft: number | undefined;
};

export class Provider extends React.Component<PropType, StateType> {
  state: StateType = {
    showCursorGuide: false,
    mouseLeft: void 0,
  };

  hasInteractiveLayer = (): boolean => {
    return !!this.props.interactiveLayerRef.current;
  };

  displayCursorGuide = (mousePageX: number) => {
    if (!this.hasInteractiveLayer()) {
      return;
    }

    const interactiveLayer = this.props.interactiveLayerRef.current!;

    const rect = rectOfContent(interactiveLayer);

    // clamp mouseLeft to be within [0, 1]
    const mouseLeft = clamp((mousePageX - rect.x) / rect.width, 0, 1);

    this.setState({
      showCursorGuide: true,
      mouseLeft,
    });
  };

  hideCursorGuide = () => {
    if (!this.hasInteractiveLayer()) {
      return;
    }

    this.setState({
      showCursorGuide: false,
      mouseLeft: void 0,
    });
  };

  render() {
    const childrenProps = {
      showCursorGuide: this.state.showCursorGuide,
      mouseLeft: this.state.mouseLeft,

      displayCursorGuide: this.displayCursorGuide,
      hideCursorGuide: this.hideCursorGuide,
    };

    return (
      <CursorGuideManagerContext.Provider value={childrenProps}>
        {this.props.children}
      </CursorGuideManagerContext.Provider>
    );
  }
}

export const Consumer = CursorGuideManagerContext.Consumer;
