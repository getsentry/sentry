import React from 'react';

export type CursorGuideManagerChildrenProps = {
  showCursorGuide: boolean;
  mousePageX: number | undefined;

  displayCursorGuide: (mousePageX: number) => void;
  hideCursorGuide: () => void;
};

const CursorGuideManagerContext = React.createContext<CursorGuideManagerChildrenProps>({
  showCursorGuide: false,
  mousePageX: void 0,

  displayCursorGuide: () => {},
  hideCursorGuide: () => {},
});

type PropType = {
  children: React.ReactNode;

  // this is the DOM element where the drag events occur. it's also the reference point
  // for calculating the relative mouse x coordinate.
  //   interactiveLayerRef: React.RefObject<HTMLDivElement>;
};

type StateType = {
  showCursorGuide: boolean;
  mousePageX: number | undefined;
};

export class Provider extends React.Component<PropType, StateType> {
  state: StateType = {
    showCursorGuide: false,
    mousePageX: void 0,
  };

  displayCursorGuide = (mousePageX: number) => {
    this.setState({
      showCursorGuide: true,
      mousePageX,
    });
  };

  hideCursorGuide = () => {
    this.setState({
      showCursorGuide: false,
      mousePageX: void 0,
    });
  };

  render() {
    const childrenProps = {
      showCursorGuide: this.state.showCursorGuide,
      mousePageX: this.state.mousePageX,

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
