import React from 'react';
import styled from 'react-emotion';
import {get} from 'lodash';

import {t} from 'app/locale';

import {SpanType, SpanChildrenLookupType, ParsedTraceType} from './types';
import {
  boundsGenerator,
  SpanBoundsType,
  SpanGeneratedBoundsType,
  generateSpanColourPicker,
} from './utils';
import {DragManagerChildrenProps} from './dragManager';
import SpanGroup from './spanGroup';
import {SpanRowMessage} from './styles';
import * as DividerHandlerManager from './dividerHandlerManager';

type RenderedSpanTree = {
  spanTree: JSX.Element | null;
  nextSpanNumber: number;
  numOfHiddenSpansAbove: number;
};

type PropType = {
  traceViewRef: React.RefObject<HTMLDivElement>;
  trace: ParsedTraceType;
  dragProps: DragManagerChildrenProps;
};

class SpanTree extends React.Component<PropType> {
  shouldComponentUpdate(nextProps: PropType) {
    if (nextProps.dragProps.isDragging) {
      return false;
    }

    return true;
  }

  renderSpan = ({
    spanNumber,
    treeDepth,
    numOfHiddenSpansAbove,
    childSpans,
    span,
    generateBounds,
    pickSpanBarColour,
  }: {
    spanNumber: number;
    treeDepth: number;
    numOfHiddenSpansAbove: number;
    span: Readonly<SpanType>;
    childSpans: Readonly<SpanChildrenLookupType>;
    generateBounds: (bounds: SpanBoundsType) => SpanGeneratedBoundsType;
    pickSpanBarColour: () => string;
  }): RenderedSpanTree => {
    const spanBarColour: string = pickSpanBarColour();

    const spanChildren: Array<SpanType> = get(childSpans, span.span_id, []);

    const bounds = generateBounds({
      startTimestamp: span.start_timestamp,
      endTimestamp: span.timestamp,
    });

    const isCurrentSpanHidden = !bounds.isSpanVisibleInView;

    type AccType = {
      renderedSpanChildren: Array<JSX.Element>;
      nextSpanNumber: number;
      numOfHiddenSpansAbove: number;
    };

    const reduced: AccType = spanChildren.reduce(
      (acc: AccType, spanChild) => {
        const key = `${span.trace_id}${spanChild.span_id}`;

        const results = this.renderSpan({
          spanNumber: acc.nextSpanNumber,
          treeDepth: treeDepth + 1,
          numOfHiddenSpansAbove: acc.numOfHiddenSpansAbove,
          span: spanChild,
          childSpans,
          generateBounds,
          pickSpanBarColour,
        });

        acc.renderedSpanChildren.push(
          <React.Fragment key={key}>{results.spanTree}</React.Fragment>
        );

        acc.numOfHiddenSpansAbove = results.numOfHiddenSpansAbove;

        acc.nextSpanNumber = results.nextSpanNumber;

        return acc;
      },
      {
        renderedSpanChildren: [],
        nextSpanNumber: spanNumber + 1,
        numOfHiddenSpansAbove: isCurrentSpanHidden ? numOfHiddenSpansAbove + 1 : 0,
      }
    );

    const showHiddenSpansMessage = !isCurrentSpanHidden && numOfHiddenSpansAbove > 0;

    const hiddenSpansMessage = showHiddenSpansMessage ? (
      <SpanRowMessage>
        <span>
          {t('Number of hidden spans:')} {numOfHiddenSpansAbove}
        </span>
      </SpanRowMessage>
    ) : null;

    return {
      numOfHiddenSpansAbove: reduced.numOfHiddenSpansAbove,
      nextSpanNumber: reduced.nextSpanNumber,
      spanTree: (
        <React.Fragment>
          {hiddenSpansMessage}
          <SpanGroup
            spanNumber={spanNumber}
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
      start_timestamp: trace.traceStartTimestamp,
      timestamp: trace.traceEndTimestamp,
      op: 'transaction',
      data: {},
    };

    const pickSpanBarColour = generateSpanColourPicker();

    const generateBounds = boundsGenerator({
      traceStartTimestamp: trace.traceStartTimestamp,
      traceEndTimestamp: trace.traceEndTimestamp,
      viewStart: dragProps.viewWindowStart,
      viewEnd: dragProps.viewWindowEnd,
    });

    return this.renderSpan({
      spanNumber: 1,
      treeDepth: 0,
      numOfHiddenSpansAbove: 0,
      span: rootSpan,
      childSpans: trace.childSpans,
      generateBounds,
      pickSpanBarColour,
    });
  };

  render() {
    const {spanTree, numOfHiddenSpansAbove} = this.renderRootSpan();

    const hiddenSpansMessage =
      numOfHiddenSpansAbove > 0 ? (
        <SpanRowMessage>
          <span>
            {t('Number of hidden spans:')} {numOfHiddenSpansAbove}
          </span>
        </SpanRowMessage>
      ) : null;

    return (
      <DividerHandlerManager.Provider interactiveLayerRef={this.props.traceViewRef}>
        <TraceViewContainer innerRef={this.props.traceViewRef}>
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
