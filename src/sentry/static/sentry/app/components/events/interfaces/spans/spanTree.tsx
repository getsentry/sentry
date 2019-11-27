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
import {FilterSpans} from './traceView';

type RenderedSpanTree = {
  spanTree: JSX.Element | null;
  nextSpanNumber: number;
  numOfSpansOutOfViewAbove: number;
  numOfFilteredSpansAbove: number;
};

type PropType = {
  trace: ParsedTraceType;
  dragProps: DragManagerChildrenProps;
  filterSpans: FilterSpans | undefined;
};

class SpanTree extends React.Component<PropType> {
  traceViewRef = React.createRef<HTMLDivElement>();

  shouldComponentUpdate(nextProps: PropType) {
    if (nextProps.dragProps.isDragging || nextProps.dragProps.isWindowSelectionDragging) {
      return false;
    }

    return true;
  }

  generateInfoMessage(input: {
    isCurrentSpanHidden: boolean;
    numOfSpansOutOfViewAbove;
  }): React.ReactNode {
    const {isCurrentSpanHidden, numOfSpansOutOfViewAbove} = input;

    const messages: React.ReactNode[] = [];

    const showHiddenSpansMessage = !isCurrentSpanHidden && numOfSpansOutOfViewAbove > 0;

    if (showHiddenSpansMessage) {
      messages.push(
        <span key="spans-out-of-view">
          <strong>{t('Spans out of view:')}</strong> {numOfSpansOutOfViewAbove}
        </span>
      );
    }

    if (messages.length <= 0) {
      return null;
    }

    return <SpanRowMessage>{messages}</SpanRowMessage>;
  }

  isSpanFiltered(span: Readonly<SpanType>): boolean {
    const {filterSpans} = this.props;

    if (!filterSpans) {
      return false;
    }

    return filterSpans.spanIDs.has(span.span_id);
  }

  renderSpan = ({
    spanNumber,
    isRoot,
    isLast,
    treeDepth,
    continuingTreeDepths,
    numOfSpansOutOfViewAbove,
    numOfFilteredSpansAbove,
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
    numOfFilteredSpansAbove: number;
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
    const isCurrentSpanFiltered = this.isSpanFiltered(span);

    type AccType = {
      renderedSpanChildren: Array<JSX.Element>;
      nextSpanNumber: number;
      numOfSpansOutOfViewAbove: number;
      numOfFilteredSpansAbove: number;
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
          numOfFilteredSpansAbove: acc.numOfFilteredSpansAbove,
          span: spanChild,
          childSpans,
          generateBounds,
        });

        acc.renderedSpanChildren.push(
          <React.Fragment key={key}>{results.spanTree}</React.Fragment>
        );

        acc.numOfSpansOutOfViewAbove = results.numOfSpansOutOfViewAbove;
        acc.numOfFilteredSpansAbove = results.numOfFilteredSpansAbove;

        acc.nextSpanNumber = results.nextSpanNumber;

        return acc;
      },
      {
        renderedSpanChildren: [],
        nextSpanNumber: spanNumber + 1,
        numOfSpansOutOfViewAbove: isCurrentSpanHidden ? numOfSpansOutOfViewAbove + 1 : 0,
        numOfFilteredSpansAbove: isCurrentSpanFiltered ? numOfFilteredSpansAbove + 1 : 0,
      }
    );

    const infoMessage = this.generateInfoMessage({
      isCurrentSpanHidden,
      numOfSpansOutOfViewAbove,
    });

    return {
      numOfSpansOutOfViewAbove: reduced.numOfSpansOutOfViewAbove,
      numOfFilteredSpansAbove: reduced.numOfFilteredSpansAbove,
      nextSpanNumber: reduced.nextSpanNumber,
      spanTree: (
        <React.Fragment>
          {infoMessage}
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
      numOfFilteredSpansAbove: 0,
      span: rootSpan,
      childSpans: trace.childSpans,
      generateBounds,
    });
  };

  render() {
    const {spanTree, numOfSpansOutOfViewAbove} = this.renderRootSpan();

    const infoMessage = this.generateInfoMessage({
      isCurrentSpanHidden: false,
      numOfSpansOutOfViewAbove,
    });

    return (
      <DividerHandlerManager.Provider interactiveLayerRef={this.traceViewRef}>
        <TraceViewContainer innerRef={this.traceViewRef}>
          {spanTree}
          {infoMessage}
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
