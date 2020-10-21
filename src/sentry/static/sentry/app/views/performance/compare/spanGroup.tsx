import { Component, Fragment } from 'react';

import {TreeDepthType} from 'app/components/events/interfaces/spans/types';

import {DiffSpanType, SpanGeneratedBoundsType} from './utils';
import SpanBar from './spanBar';

type Props = {
  span: Readonly<DiffSpanType>;
  renderedSpanChildren: Array<JSX.Element>;
  treeDepth: number;
  continuingTreeDepths: Array<TreeDepthType>;
  spanNumber: number;
  isLast: boolean;
  isRoot: boolean;
  numOfSpanChildren: number;
  generateBounds: (span: DiffSpanType) => SpanGeneratedBoundsType;
};

type State = {
  showSpanTree: boolean;
};

class SpanGroup extends Component<Props, State> {
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
      <Fragment>
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
      </Fragment>
    );
  }
}

export default SpanGroup;
