import React from 'react';

import {SpanBoundsType, SpanGeneratedBoundsType} from './utils';
import {SpanType, ParsedTraceType} from './types';
import SpanBar from './spanBar';

type PropType = {
  span: Readonly<SpanType>;
  trace: Readonly<ParsedTraceType>;
  generateBounds: (bounds: SpanBoundsType) => SpanGeneratedBoundsType;
  treeDepth: number;
  numOfSpanChildren: number;
  renderedSpanChildren: Array<JSX.Element>;
  spanBarColour: string;
  spanNumber: number;
};

type State = {
  showSpanTree: boolean;
};

class SpanGroup extends React.Component<PropType, State> {
  state: State = {
    showSpanTree: true,
  };

  toggleSpanTree = () => {
    this.setState(state => {
      return {
        showSpanTree: !state.showSpanTree,
      };
    });
  };

  renderSpanChildren = () => {
    if (!this.state.showSpanTree) {
      return null;
    }

    return this.props.renderedSpanChildren;
  };

  render() {
    const {
      spanBarColour,
      span,
      numOfSpanChildren,
      trace,
      generateBounds,
      treeDepth,
      spanNumber,
    } = this.props;

    return (
      <React.Fragment>
        <SpanBar
          spanBarColour={spanBarColour}
          span={span}
          showSpanTree={this.state.showSpanTree}
          numOfSpanChildren={numOfSpanChildren}
          trace={trace}
          generateBounds={generateBounds}
          toggleSpanTree={this.toggleSpanTree}
          treeDepth={treeDepth}
          spanNumber={spanNumber}
        />
        {this.renderSpanChildren()}
      </React.Fragment>
    );
  }
}

export default SpanGroup;
