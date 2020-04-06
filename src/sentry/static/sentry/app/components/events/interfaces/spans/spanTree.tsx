import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import EventView from 'app/utils/discover/eventView';

import {
  ProcessedSpanType,
  RawSpanType,
  SpanChildrenLookupType,
  ParsedTraceType,
  GapSpanType,
  SentryTransactionEvent,
} from './types';
import {
  boundsGenerator,
  SpanBoundsType,
  SpanGeneratedBoundsType,
  pickSpanBarColour,
  generateRootSpan,
  getSpanID,
  getSpanOperation,
  getSpanTraceID,
  isGapSpan,
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
  orgId: string;
  eventView: EventView;
  trace: ParsedTraceType;
  dragProps: DragManagerChildrenProps;
  filterSpans: FilterSpans | undefined;
  event: SentryTransactionEvent;
};

class SpanTree extends React.Component<PropType> {
  shouldComponentUpdate(nextProps: PropType) {
    if (nextProps.dragProps.isDragging || nextProps.dragProps.isWindowSelectionDragging) {
      return false;
    }

    return true;
  }

  traceViewRef = React.createRef<HTMLDivElement>();

  generateInfoMessage(input: {
    isCurrentSpanHidden: boolean;
    numOfSpansOutOfViewAbove: number;
    isCurrentSpanFilteredOut: boolean;
    numOfFilteredSpansAbove: number;
  }): React.ReactNode {
    const {
      isCurrentSpanHidden,
      numOfSpansOutOfViewAbove,
      isCurrentSpanFilteredOut,
      numOfFilteredSpansAbove,
    } = input;

    const messages: React.ReactNode[] = [];

    const showHiddenSpansMessage = !isCurrentSpanHidden && numOfSpansOutOfViewAbove > 0;

    if (showHiddenSpansMessage) {
      messages.push(
        <span key="spans-out-of-view">
          <strong>{numOfSpansOutOfViewAbove}</strong> {t('spans out of view')}
        </span>
      );
    }

    const showFilteredSpansMessage =
      !isCurrentSpanFilteredOut && numOfFilteredSpansAbove > 0;

    if (showFilteredSpansMessage) {
      if (!isCurrentSpanHidden) {
        messages.push(
          <span key="spans-filtered">
            <strong>{numOfFilteredSpansAbove}</strong> {t('spans filtered out')}
          </span>
        );
      }
    }

    if (messages.length <= 0) {
      return null;
    }

    return <SpanRowMessage>{messages}</SpanRowMessage>;
  }

  isSpanFilteredOut(span: Readonly<RawSpanType>): boolean {
    const {filterSpans} = this.props;

    if (!filterSpans) {
      return false;
    }

    return !filterSpans.spanIDs.has(getSpanID(span));
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
    previousSiblingEndTimestamp,
  }: {
    spanNumber: number;
    treeDepth: number;
    continuingTreeDepths: Array<number>;
    isLast: boolean;
    isRoot?: boolean;
    numOfSpansOutOfViewAbove: number;
    numOfFilteredSpansAbove: number;
    span: Readonly<ProcessedSpanType>;
    childSpans: Readonly<SpanChildrenLookupType>;
    generateBounds: (bounds: SpanBoundsType) => SpanGeneratedBoundsType;
    previousSiblingEndTimestamp: undefined | number;
  }): RenderedSpanTree => {
    const {orgId, eventView, event} = this.props;

    const spanBarColour: string = pickSpanBarColour(getSpanOperation(span));
    const spanChildren: Array<RawSpanType> = childSpans?.[getSpanID(span)] ?? [];

    const bounds = generateBounds({
      startTimestamp: span.start_timestamp,
      endTimestamp: span.timestamp,
    });

    const isCurrentSpanHidden = !bounds.isSpanVisibleInView;
    const isCurrentSpanFilteredOut = isGapSpan(span)
      ? false
      : this.isSpanFilteredOut(span);

    const isSpanDisplayed = !isCurrentSpanHidden && !isCurrentSpanFilteredOut;

    // hide gap spans (i.e. "missing instrumentation" spans) for browser js transactions,
    // since they're not useful to indicate
    const shouldIncludeGap = !isJavaScriptSDK(event.sdk?.name);

    const isValidGap =
      typeof previousSiblingEndTimestamp === 'number' &&
      previousSiblingEndTimestamp < span.start_timestamp &&
      // gap is at least 100 ms
      span.start_timestamp - previousSiblingEndTimestamp >= 0.1 &&
      shouldIncludeGap;

    const spanGroupNumber = isValidGap && isSpanDisplayed ? spanNumber + 1 : spanNumber;

    type AccType = {
      renderedSpanChildren: Array<JSX.Element>;
      nextSpanNumber: number;
      numOfSpansOutOfViewAbove: number;
      numOfFilteredSpansAbove: number;
      previousSiblingEndTimestamp: undefined | number;
    };

    const treeArr = isLast ? continuingTreeDepths : [...continuingTreeDepths, treeDepth];

    const reduced: AccType = spanChildren.reduce(
      (acc: AccType, spanChild, index) => {
        const key = `${getSpanTraceID(span)}${getSpanID(spanChild)}`;

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
          previousSiblingEndTimestamp: acc.previousSiblingEndTimestamp,
        });

        acc.renderedSpanChildren.push(
          <React.Fragment key={key}>{results.spanTree}</React.Fragment>
        );

        acc.numOfSpansOutOfViewAbove = results.numOfSpansOutOfViewAbove;
        acc.numOfFilteredSpansAbove = results.numOfFilteredSpansAbove;

        acc.nextSpanNumber = results.nextSpanNumber;

        acc.previousSiblingEndTimestamp = spanChild.timestamp;

        return acc;
      },
      {
        renderedSpanChildren: [],
        nextSpanNumber: spanGroupNumber + 1,
        numOfSpansOutOfViewAbove: isCurrentSpanHidden ? numOfSpansOutOfViewAbove + 1 : 0,
        numOfFilteredSpansAbove: isCurrentSpanFilteredOut
          ? numOfFilteredSpansAbove + 1
          : isCurrentSpanHidden
          ? numOfFilteredSpansAbove
          : 0,
        previousSiblingEndTimestamp: undefined,
      }
    );

    const infoMessage = this.generateInfoMessage({
      isCurrentSpanHidden,
      numOfSpansOutOfViewAbove,
      isCurrentSpanFilteredOut,
      numOfFilteredSpansAbove,
    });

    const spanGap: Readonly<GapSpanType> = {
      type: 'gap',
      start_timestamp: previousSiblingEndTimestamp || span.start_timestamp,
      timestamp: span.start_timestamp, // this is essentially end_timestamp
      description: t('Missing instrumentation'),
    };

    const spanGapComponent =
      isValidGap && isSpanDisplayed ? (
        <SpanGroup
          eventView={eventView}
          orgId={orgId}
          spanNumber={spanNumber}
          isLast={false}
          continuingTreeDepths={continuingTreeDepths}
          isRoot={isRoot}
          span={spanGap}
          trace={this.props.trace}
          generateBounds={generateBounds}
          treeDepth={treeDepth}
          numOfSpanChildren={0}
          renderedSpanChildren={[]}
          isCurrentSpanFilteredOut={isCurrentSpanFilteredOut}
          spanBarHatch
        />
      ) : null;

    return {
      numOfSpansOutOfViewAbove: reduced.numOfSpansOutOfViewAbove,
      numOfFilteredSpansAbove: reduced.numOfFilteredSpansAbove,
      nextSpanNumber: reduced.nextSpanNumber,
      spanTree: (
        <React.Fragment>
          {infoMessage}
          {spanGapComponent}
          <SpanGroup
            eventView={eventView}
            orgId={orgId}
            spanNumber={spanGroupNumber}
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
            isCurrentSpanFilteredOut={isCurrentSpanFilteredOut}
            spanBarHatch={false}
          />
        </React.Fragment>
      ),
    };
  };

  renderRootSpan = (): RenderedSpanTree => {
    const {dragProps, trace} = this.props;

    const rootSpan: RawSpanType = generateRootSpan(trace);

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
      previousSiblingEndTimestamp: undefined,
    });
  };

  render() {
    const {
      spanTree,
      numOfSpansOutOfViewAbove,
      numOfFilteredSpansAbove,
    } = this.renderRootSpan();

    const infoMessage = this.generateInfoMessage({
      isCurrentSpanHidden: false,
      numOfSpansOutOfViewAbove,
      isCurrentSpanFilteredOut: false,
      numOfFilteredSpansAbove,
    });

    return (
      <DividerHandlerManager.Provider interactiveLayerRef={this.traceViewRef}>
        <TraceViewContainer ref={this.traceViewRef}>
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

function isJavaScriptSDK(sdkName?: string): boolean {
  if (!sdkName) {
    return false;
  }
  // based on https://github.com/getsentry/sentry-javascript/blob/master/packages/browser/src/version.ts
  return sdkName.toLowerCase() === 'sentry.javascript.browser';
}

export default SpanTree;
