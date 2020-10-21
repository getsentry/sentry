import * as React from 'react';

import {rectOfContent, clamp} from './utils';
import {ParsedTraceType} from './types';
import {DragManagerChildrenProps} from './dragManager';

export type CursorGuideManagerChildrenProps = {
  showCursorGuide: boolean;
  mouseLeft: number | undefined;
  traceViewMouseLeft: number | undefined;

  displayCursorGuide: (mousePageX: number) => void;
  hideCursorGuide: () => void;
};

const CursorGuideManagerContext = React.createContext<CursorGuideManagerChildrenProps>({
  showCursorGuide: false,
  mouseLeft: void 0,
  traceViewMouseLeft: void 0,

  displayCursorGuide: () => {},
  hideCursorGuide: () => {},
});

type PropType = {
  trace: ParsedTraceType;
  children: React.ReactNode;
  dragProps: DragManagerChildrenProps;

  // this is the DOM element where the drag events occur. it's also the reference point
  // for calculating the relative mouse x coordinate.
  interactiveLayerRef: React.RefObject<HTMLDivElement>;
};

type StateType = {
  showCursorGuide: boolean;
  mouseLeft: number | undefined;
  traceViewMouseLeft: number | undefined;
};

export class Provider extends React.Component<PropType, StateType> {
  state: StateType = {
    showCursorGuide: false,
    mouseLeft: void 0,
    traceViewMouseLeft: void 0,
  };

  hasInteractiveLayer = (): boolean => !!this.props.interactiveLayerRef.current;

  displayCursorGuide = (mousePageX: number) => {
    if (!this.hasInteractiveLayer()) {
      return;
    }

    const {trace, dragProps} = this.props;

    const interactiveLayer = this.props.interactiveLayerRef.current!;

    const rect = rectOfContent(interactiveLayer);

    // duration of the entire trace in seconds
    const traceDuration = trace.traceEndTimestamp - trace.traceStartTimestamp;

    const viewStart = dragProps.viewWindowStart;
    const viewEnd = dragProps.viewWindowEnd;

    const viewStartTimestamp = trace.traceStartTimestamp + viewStart * traceDuration;
    const viewEndTimestamp = trace.traceEndTimestamp - (1 - viewEnd) * traceDuration;
    const viewDuration = viewEndTimestamp - viewStartTimestamp;

    // clamp mouseLeft to be within [0, 1]
    const mouseLeft = clamp((mousePageX - rect.x) / rect.width, 0, 1);

    const duration =
      mouseLeft * Math.abs(trace.traceEndTimestamp - trace.traceStartTimestamp);

    const startTimestamp = trace.traceStartTimestamp + duration;

    const start = (startTimestamp - viewStartTimestamp) / viewDuration;

    this.setState({
      showCursorGuide: true,
      mouseLeft,
      traceViewMouseLeft: start,
    });
  };

  hideCursorGuide = () => {
    if (!this.hasInteractiveLayer()) {
      return;
    }

    this.setState({
      showCursorGuide: false,
      mouseLeft: void 0,
      traceViewMouseLeft: void 0,
    });
  };

  render() {
    const childrenProps = {
      showCursorGuide: this.state.showCursorGuide,
      mouseLeft: this.state.mouseLeft,
      traceViewMouseLeft: this.state.traceViewMouseLeft,

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
