import React from 'react';

import EventView from 'app/utils/discover/eventView';
import {TableData, TableDataRow} from 'app/views/eventsV2/table/types';

import {SpanBoundsType, SpanGeneratedBoundsType, isGapSpan, getSpanID} from './utils';
import {ProcessedSpanType, ParsedTraceType} from './types';
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
  spanBarColour?: string;
  spanBarHatch?: boolean;
  spanNumber: number;
  isLast: boolean;
  isRoot?: boolean;
  isCurrentSpanFilteredOut: boolean;
  spansWithErrors: TableData | null | undefined;
};

type State = {
  showSpanTree: boolean;
};

class SpanGroup extends React.Component<PropType, State> {
  state: State = {
    showSpanTree: true,
  };

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

  getSpanErrors(): TableDataRow[] {
    const {span, spansWithErrors} = this.props;

    const spanID = getSpanID(span);

    if (isGapSpan(span) || !spansWithErrors?.data || !spanID) {
      return [];
    }

    return spansWithErrors.data.filter(row => {
      return row['trace.span'] === spanID;
    });
  }

  getTotalNumberOfErrors(): number {
    const {spansWithErrors} = this.props;

    const data = spansWithErrors?.data;

    if (Array.isArray(data)) {
      return data.length;
    }

    return 0;
  }

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
      orgId,
      eventView,
    } = this.props;

    return (
      <React.Fragment>
        <SpanBar
          eventView={eventView}
          orgId={orgId}
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
          totalNumberOfErrors={this.getTotalNumberOfErrors()}
          spanErrors={this.getSpanErrors()}
        />
        {this.renderSpanChildren()}
      </React.Fragment>
    );
  }
}

export default SpanGroup;
