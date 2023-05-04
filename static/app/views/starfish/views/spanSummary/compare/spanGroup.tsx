import React from 'react';

import {TreeDepthType} from 'sentry/components/events/interfaces/spans/types';

import SpanBar from './spanBar';
import {DiffSpanType, SpanGeneratedBoundsType} from './utils';

type Props = {
  continuingTreeDepths: Array<TreeDepthType>;
  generateBounds: (span: DiffSpanType) => SpanGeneratedBoundsType;
  isLast: boolean;
  isRoot: boolean;
  numOfSpanChildren: number;
  renderedSpanChildren: Array<JSX.Element>;
  span: Readonly<DiffSpanType>;
  spanNumber: number;
  treeDepth: number;
};

type State = {
  showSpanTree: boolean;
};

class SpanGroup extends React.Component<Props, State> {
  state: State = {
    showSpanTree: true,
  };

  toggleSpanTree = () => {
    this.setState(state => ({
      showSpanTree: !state.showSpanTree,
    }));
  };

  renderSpanChildren() {
    if (!this.state.showSpanTree) {
      return null;
    }

    return this.props.renderedSpanChildren;
  }

  render() {
    const {
      span,
      treeDepth,
      continuingTreeDepths,
      spanNumber,
      isLast,
      isRoot,
      numOfSpanChildren,
      generateBounds,
    } = this.props;

    return (
      <React.Fragment>
        <SpanBar
          span={span}
          treeDepth={treeDepth}
          continuingTreeDepths={continuingTreeDepths}
          spanNumber={spanNumber}
          isLast={isLast}
          isRoot={isRoot}
          numOfSpanChildren={numOfSpanChildren}
          showSpanTree={this.state.showSpanTree}
          toggleSpanTree={this.toggleSpanTree}
          generateBounds={generateBounds}
        />
        {this.renderSpanChildren()}
      </React.Fragment>
    );
  }
}

export default SpanGroup;
