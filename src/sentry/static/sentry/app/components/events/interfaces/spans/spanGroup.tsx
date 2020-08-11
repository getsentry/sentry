import React from 'react';

import {Organization, SentryTransactionEvent} from 'app/types';
import {TableData, TableDataRow} from 'app/utils/discover/discoverQuery';

import {SpanBoundsType, SpanGeneratedBoundsType, isGapSpan, getSpanID} from './utils';
import {ProcessedSpanType, ParsedTraceType, TreeDepthType} from './types';
import SpanBar from './spanBar';

type PropType = {
  orgId: string;
  organization: Organization;
  event: Readonly<SentryTransactionEvent>;
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
      organization,
      event,
    } = this.props;

    return (
      <React.Fragment>
        <SpanBar
          organization={organization}
          event={event}
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
