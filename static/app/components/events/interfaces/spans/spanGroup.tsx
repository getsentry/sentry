import {Component, Fragment} from 'react';

import {Organization} from 'app/types';
import {EventTransaction} from 'app/types/event';

import {ScrollbarManagerChildrenProps, withScrollbarManager} from './scrollbarManager';
import SpanBar from './spanBar';
import {ParsedTraceType, ProcessedSpanType, TreeDepthType} from './types';
import {SpanBoundsType, SpanGeneratedBoundsType} from './utils';

type PropType = ScrollbarManagerChildrenProps & {
  organization: Organization;
  event: Readonly<EventTransaction>;
  span: Readonly<ProcessedSpanType>;
  trace: Readonly<ParsedTraceType>;
  generateBounds: (bounds: SpanBoundsType) => SpanGeneratedBoundsType;
  treeDepth: number;
  continuingTreeDepths: Array<TreeDepthType>;
  numOfSpanChildren: number;
  renderedSpanChildren: Array<JSX.Element>;
  spanBarColour?: string;
  spanBarHatch?: boolean;
  spanNumber: number;
  isLast: boolean;
  isRoot?: boolean;
  isCurrentSpanFilteredOut: boolean;
};

type State = {
  showSpanTree: boolean;
};

class SpanGroup extends Component<PropType, State> {
  state: State = {
    showSpanTree: true,
  };

  componentDidUpdate(_prevProps: PropType, prevState: State) {
    if (prevState.showSpanTree !== this.state.showSpanTree) {
      // Update horizontal scroll states after this subtree was either hidden or
      // revealed.
      this.props.updateScrollState();
    }
  }

  toggleSpanTree = () => {
    this.setState(state => ({
      showSpanTree: !state.showSpanTree,
    }));
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
      spanBarHatch,
      span,
      numOfSpanChildren,
      trace,
      isLast,
      isRoot,
      continuingTreeDepths,
      generateBounds,
      treeDepth,
      spanNumber,
      isCurrentSpanFilteredOut,
      organization,
      event,
    } = this.props;

    return (
      <Fragment>
        <SpanBar
          organization={organization}
          event={event}
          spanBarColour={spanBarColour}
          spanBarHatch={spanBarHatch}
          span={span}
          showSpanTree={this.state.showSpanTree}
          numOfSpanChildren={numOfSpanChildren}
          trace={trace}
          generateBounds={generateBounds}
          toggleSpanTree={this.toggleSpanTree}
          treeDepth={treeDepth}
          continuingTreeDepths={continuingTreeDepths}
          spanNumber={spanNumber}
          isLast={isLast}
          isRoot={isRoot}
          isCurrentSpanFilteredOut={isCurrentSpanFilteredOut}
        />
        {this.renderSpanChildren()}
      </Fragment>
    );
  }
}

export default withScrollbarManager(SpanGroup);
