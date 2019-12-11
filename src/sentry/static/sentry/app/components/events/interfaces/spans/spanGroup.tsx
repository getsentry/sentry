import React from 'react';

import EventView from 'app/views/eventsV2/eventView';

import {SpanBoundsType, SpanGeneratedBoundsType} from './utils';
import {ProcessedSpanType, ParsedTraceType, SentryTransactionEvent} from './types';
import SpanBar from './spanBar';

type PropType = {
  orgId: string;
  eventView: EventView;
  span: Readonly<ProcessedSpanType>;
  trace: Readonly<ParsedTraceType>;
  generateBounds: (bounds: SpanBoundsType) => SpanGeneratedBoundsType;
  treeDepth: number;
  continuingTreeDepths: Array<number>;
  numOfSpanChildren: number;
  renderedSpanChildren: Array<JSX.Element>;
  spanBarColour: string;
  spanNumber: number;
  isLast: boolean;
  isRoot?: boolean;
  isCurrentSpanFilteredOut: boolean;
  event: SentryTransactionEvent;
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
      isLast,
      isRoot,
      continuingTreeDepths,
      generateBounds,
      treeDepth,
      spanNumber,
      isCurrentSpanFilteredOut,
      orgId,
      eventView,
      event,
    } = this.props;

    return (
      <React.Fragment>
        <SpanBar
          eventView={eventView}
          orgId={orgId}
          spanBarColour={spanBarColour}
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
          event={event}
        />
        {this.renderSpanChildren()}
      </React.Fragment>
    );
  }
}

export default SpanGroup;
