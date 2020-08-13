import React from 'react';
import styled from '@emotion/styled';

import {SentryTransactionEvent} from 'app/types';
import {
  TreeDepthType,
  OrphanTreeDepth,
} from 'app/components/events/interfaces/spans/types';
import * as DividerHandlerManager from 'app/components/events/interfaces/spans/dividerHandlerManager';

import {
  diffTransactions,
  DiffSpanType,
  SpanChildrenLookupType,
  getSpanID,
  boundsGenerator,
  SpanGeneratedBoundsType,
  isOrphanDiffSpan,
} from './utils';
import SpanGroup from './spanGroup';

type RenderedSpanTree = {
  spanTree: JSX.Element | null;
  nextSpanNumber: number;
  // numOfSpansOutOfViewAbove: number;
  // numOfFilteredSpansAbove: number;
};

type Props = {
  baselineEvent: SentryTransactionEvent;
  regressionEvent: SentryTransactionEvent;
};

class SpanTree extends React.Component<Props> {
  traceViewRef = React.createRef<HTMLDivElement>();

  renderSpan({
    span,
    childSpans,
    spanNumber,
    treeDepth,
    continuingTreeDepths,
    isLast,
    isRoot,
    generateBounds,
  }: {
    span: Readonly<DiffSpanType>;
    childSpans: SpanChildrenLookupType;
    spanNumber: number;
    treeDepth: number;
    continuingTreeDepths: Array<TreeDepthType>;
    isLast: boolean;
    isRoot: boolean;
    generateBounds: (span: DiffSpanType) => SpanGeneratedBoundsType;
  }): RenderedSpanTree {
    const spanChildren: Array<DiffSpanType> = childSpans?.[getSpanID(span)] ?? [];

    // Mark descendents as being rendered. This is to address potential recursion issues due to malformed data.
    // For example if a span has a span_id that's identical to its parent_span_id.
    childSpans = {
      ...childSpans,
    };
    delete childSpans[getSpanID(span)];

    type AccType = {
      renderedSpanChildren: Array<JSX.Element>;
      nextSpanNumber: number;
    };

    const treeDepthEntry = isOrphanDiffSpan(span)
      ? ({type: 'orphan', depth: treeDepth} as OrphanTreeDepth)
      : treeDepth;

    const treeArr = isLast
      ? continuingTreeDepths
      : [...continuingTreeDepths, treeDepthEntry];

    const reduced: AccType = spanChildren.reduce(
      (acc: AccType, spanChild, index) => {
        const key = `${getSpanID(spanChild)}`;

        const results = this.renderSpan({
          spanNumber: acc.nextSpanNumber,
          isLast: index + 1 === spanChildren.length,
          isRoot: false,
          span: spanChild,
          childSpans,
          continuingTreeDepths: treeArr,
          treeDepth: treeDepth + 1,
          generateBounds,
        });

        acc.renderedSpanChildren.push(
          <React.Fragment key={key}>{results.spanTree}</React.Fragment>
        );

        acc.nextSpanNumber = results.nextSpanNumber;

        return acc;
      },
      {
        renderedSpanChildren: [],
        nextSpanNumber: spanNumber + 1,
      }
    );

    const spanTree = (
      <React.Fragment>
        <SpanGroup
          spanNumber={spanNumber}
          span={span}
          renderedSpanChildren={reduced.renderedSpanChildren}
          treeDepth={treeDepth}
          continuingTreeDepths={continuingTreeDepths}
          isRoot={isRoot}
          isLast={isLast}
          numOfSpanChildren={spanChildren.length}
          generateBounds={generateBounds}
        />
      </React.Fragment>
    );

    return {
      nextSpanNumber: reduced.nextSpanNumber,
      spanTree,
    };
  }

  renderRootSpans(): RenderedSpanTree {
    const {baselineEvent, regressionEvent} = this.props;

    const comparisonReport = diffTransactions({
      baselineEvent,
      regressionEvent,
    });

    const {rootSpans, childSpans} = comparisonReport;

    const generateBounds = boundsGenerator(rootSpans);

    let nextSpanNumber = 1;

    const spanTree = (
      <React.Fragment key="root-spans-tree">
        {rootSpans.map((rootSpan, index) => {
          const renderedRootSpan = this.renderSpan({
            isLast: index + 1 === rootSpans.length,
            isRoot: true,
            span: rootSpan,
            childSpans,
            spanNumber: nextSpanNumber,
            treeDepth: 0,
            continuingTreeDepths: [],
            generateBounds,
          });

          nextSpanNumber = renderedRootSpan.nextSpanNumber;

          return (
            <React.Fragment key={String(index)}>
              {renderedRootSpan.spanTree}
            </React.Fragment>
          );
        })}
      </React.Fragment>
    );

    return {
      spanTree,
      nextSpanNumber,
    };
  }

  render() {
    const {spanTree} = this.renderRootSpans();

    return (
      <DividerHandlerManager.Provider interactiveLayerRef={this.traceViewRef}>
        <TraceViewContainer ref={this.traceViewRef}>{spanTree}</TraceViewContainer>
      </DividerHandlerManager.Provider>
    );
  }
}

const TraceViewContainer = styled('div')`
  overflow-x: hidden;
  border-bottom-left-radius: 3px;
  border-bottom-right-radius: 3px;
`;

export default SpanTree;
