import React from 'react';
import styled from 'react-emotion';
import get from 'lodash/get';

import {t} from 'app/locale';

import {SpanType, SpanChildrenLookupType, ParsedTraceType} from './types';
import {
  boundsGenerator,
  SpanBoundsType,
  SpanGeneratedBoundsType,
  pickSpanBarColour,
} from './utils';
import {DragManagerChildrenProps} from './dragManager';
import SpanGroup from './spanGroup';
import {SpanRowMessage} from './styles';
import * as DividerHandlerManager from './dividerHandlerManager';

type RenderedSpanTree = {
  spanTree: JSX.Element | null;
  nextSpanNumber: number;
  numOfSpansOutOfViewAbove: number;
};

type PropType = {
  trace: ParsedTraceType;
  dragProps: DragManagerChildrenProps;
};

class SpanTree extends React.Component<PropType> {
  traceViewRef = React.createRef<HTMLDivElement>();

  shouldComponentUpdate(nextProps: PropType) {
    if (nextProps.dragProps.isDragging || nextProps.dragProps.isWindowSelectionDragging) {
      return false;
    }

    return true;
  }

  renderSpan = ({
    spanNumber,
    isRoot,
    isLast,
    treeDepth,
    continuingTreeDepths,
    numOfSpansOutOfViewAbove,
    childSpans,
    span,
    generateBounds,
  }: {
    spanNumber: number;
    treeDepth: number;
    continuingTreeDepths: Array<number>;
    isLast: boolean;
    isRoot?: boolean;
    numOfSpansOutOfViewAbove: number;
    span: Readonly<SpanType>;
    childSpans: Readonly<SpanChildrenLookupType>;
    generateBounds: (bounds: SpanBoundsType) => SpanGeneratedBoundsType;
  }): RenderedSpanTree => {
    const spanBarColour: string = pickSpanBarColour(span.op);
    const spanChildren: Array<SpanType> = get(childSpans, span.span_id, []);

    const bounds = generateBounds({
      startTimestamp: span.start_timestamp,
      endTimestamp: span.timestamp,
    });

    const isCurrentSpanHidden = !bounds.isSpanVisibleInView;

    type AccType = {
      renderedSpanChildren: Array<JSX.Element>;
      nextSpanNumber: number;
      numOfSpansOutOfViewAbove: number;
    };

    const treeArr = isLast ? continuingTreeDepths : [...continuingTreeDepths, treeDepth];

    const reduced: AccType = spanChildren.reduce(
      (acc: AccType, spanChild, index) => {
        const key = `${span.trace_id}${spanChild.span_id}`;

        const results = this.renderSpan({
          spanNumber: acc.nextSpanNumber,
          isLast: index + 1 === spanChildren.length,
          continuingTreeDepths: treeArr,
          treeDepth: treeDepth + 1,
          numOfSpansOutOfViewAbove: acc.numOfSpansOutOfViewAbove,
          span: spanChild,
          childSpans,
          generateBounds,
        });

        acc.renderedSpanChildren.push(
          <React.Fragment key={key}>{results.spanTree}</React.Fragment>
        );

        acc.numOfSpansOutOfViewAbove = results.numOfSpansOutOfViewAbove;

        acc.nextSpanNumber = results.nextSpanNumber;

        return acc;
      },
      {
        renderedSpanChildren: [],
        nextSpanNumber: spanNumber + 1,
        numOfSpansOutOfViewAbove: isCurrentSpanHidden ? numOfSpansOutOfViewAbove + 1 : 0,
      }
    );

    const showHiddenSpansMessage = !isCurrentSpanHidden && numOfSpansOutOfViewAbove > 0;

    const hiddenSpansMessage = showHiddenSpansMessage ? (
      <SpanRowMessage>
        <span>
          {t('Spans out of view:')} {numOfSpansOutOfViewAbove}
        </span>
      </SpanRowMessage>
    ) : null;

    return {
      numOfSpansOutOfViewAbove: reduced.numOfSpansOutOfViewAbove,
      nextSpanNumber: reduced.nextSpanNumber,
      spanTree: (
        <React.Fragment>
          {hiddenSpansMessage}
          <SpanGroup
            spanNumber={spanNumber}
            isLast={isLast}
            continuingTreeDepths={continuingTreeDepths}
            isRoot={isRoot}
            span={span}
            trace={this.props.trace}
            generateBounds={generateBounds}
            treeDepth={treeDepth}
            numOfSpanChildren={spanChildren.length}
            renderedSpanChildren={reduced.renderedSpanChildren}
            spanBarColour={spanBarColour}
          />
        </React.Fragment>
      ),
    };
  };

  renderRootSpan = (): RenderedSpanTree => {
    const {dragProps, trace} = this.props;

    const rootSpan: SpanType = {
      trace_id: trace.traceID,
      span_id: trace.rootSpanID,
      parent_span_id: trace.parentSpanID,
      start_timestamp: trace.traceStartTimestamp,
      timestamp: trace.traceEndTimestamp,
      op: trace.op,
      data: {},
    };

    const generateBounds = boundsGenerator({
      traceStartTimestamp: trace.traceStartTimestamp,
      traceEndTimestamp: trace.traceEndTimestamp,
      viewStart: dragProps.viewWindowStart,
      viewEnd: dragProps.viewWindowEnd,
    });

    return this.renderSpan({
      isRoot: true,
      isLast: true,
      spanNumber: 1,
      treeDepth: 0,
      continuingTreeDepths: [],
      numOfSpansOutOfViewAbove: 0,
      span: rootSpan,
      childSpans: trace.childSpans,
      generateBounds,
    });
  };

  render() {
    const {spanTree, numOfSpansOutOfViewAbove} = this.renderRootSpan();

    const hiddenSpansMessage =
      numOfSpansOutOfViewAbove > 0 ? (
        <SpanRowMessage>
          <span>
            {t('Spans out of view:')} {numOfSpansOutOfViewAbove}
          </span>
        </SpanRowMessage>
      ) : null;

    return (
      <DividerHandlerManager.Provider interactiveLayerRef={this.traceViewRef}>
        <TraceViewContainer innerRef={this.traceViewRef}>
          {spanTree}
          {hiddenSpansMessage}
        </TraceViewContainer>
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
