import React from 'react';
import styled from '@emotion/styled';

import GuideAnchor from 'app/components/assistant/guideAnchor';
import {t, tct} from 'app/locale';
import {Organization} from 'app/types';
import {EventTransaction} from 'app/types/event';
import {TableData} from 'app/utils/discover/discoverQuery';

import * as DividerHandlerManager from './dividerHandlerManager';
import {DragManagerChildrenProps} from './dragManager';
import {ActiveOperationFilter} from './filter';
import {DividerLine} from './spanBar';
import SpanGroup from './spanGroup';
import {SpanRowMessage} from './styles';
import {FilterSpans} from './traceView';
import {
  GapSpanType,
  OrphanTreeDepth,
  ParsedTraceType,
  ProcessedSpanType,
  RawSpanType,
  SpanChildrenLookupType,
  TreeDepthType,
} from './types';
import {
  boundsGenerator,
  generateRootSpan,
  getSpanID,
  getSpanOperation,
  getSpanTraceID,
  isEventFromBrowserJavaScriptSDK,
  isGapSpan,
  isOrphanSpan,
  pickSpanBarColour,
  SpanBoundsType,
  SpanGeneratedBoundsType,
} from './utils';

type RenderedSpanTree = {
  spanTree: JSX.Element | null;
  nextSpanNumber: number;
  numOfSpansOutOfViewAbove: number;
  numOfFilteredSpansAbove: number;
};

type PropType = {
  orgId: string;
  organization: Organization;
  trace: ParsedTraceType;
  dragProps: DragManagerChildrenProps;
  filterSpans: FilterSpans | undefined;
  event: EventTransaction;
  spansWithErrors: TableData | null | undefined;
  operationNameFilters: ActiveOperationFilter;
  traceViewRef: React.RefObject<HTMLDivElement>;
};

class SpanTree extends React.Component<PropType> {
  shouldComponentUpdate(nextProps: PropType) {
    if (nextProps.dragProps.isDragging || nextProps.dragProps.isWindowSelectionDragging) {
      return false;
    }

    return true;
  }

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
        if (numOfFilteredSpansAbove === 1) {
          messages.push(
            <span key="spans-filtered">
              {tct('[numOfSpans] hidden span', {
                numOfSpans: <strong>{numOfFilteredSpansAbove}</strong>,
              })}
            </span>
          );
        } else {
          messages.push(
            <span key="spans-filtered">
              {tct('[numOfSpans] hidden spans', {
                numOfSpans: <strong>{numOfFilteredSpansAbove}</strong>,
              })}
            </span>
          );
        }
      }
    }

    if (messages.length <= 0) {
      return null;
    }

    return <SpanRowMessage>{messages}</SpanRowMessage>;
  }

  generateLimitExceededMessage() {
    const {trace} = this.props;

    if (hasAllSpans(trace)) {
      return null;
    }

    return (
      <SpanRowMessage>
        {t(
          'The next spans are unavailable. You may have exceeded the span limit or need to address missing instrumentation.'
        )}
      </SpanRowMessage>
    );
  }

  isSpanFilteredOut(span: Readonly<RawSpanType>): boolean {
    const {filterSpans, operationNameFilters} = this.props;

    if (operationNameFilters.type === 'active_filter') {
      const operationName = getSpanOperation(span);

      if (
        typeof operationName === 'string' &&
        !operationNameFilters.operationNames.has(operationName)
      ) {
        return true;
      }
    }

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
    continuingTreeDepths: Array<TreeDepthType>;
    isLast: boolean;
    isRoot?: boolean;
    numOfSpansOutOfViewAbove: number;
    numOfFilteredSpansAbove: number;
    span: Readonly<ProcessedSpanType>;
    childSpans: SpanChildrenLookupType;
    generateBounds: (bounds: SpanBoundsType) => SpanGeneratedBoundsType;
    previousSiblingEndTimestamp: undefined | number;
  }): RenderedSpanTree => {
    const {orgId, event, spansWithErrors, organization} = this.props;

    const spanBarColour: string = pickSpanBarColour(getSpanOperation(span));
    const spanChildren: Array<RawSpanType> = childSpans?.[getSpanID(span)] ?? [];

    // Mark descendents as being rendered. This is to address potential recursion issues due to malformed data.
    // For example if a span has a span_id that's identical to its parent_span_id.
    childSpans = {
      ...childSpans,
    };
    delete childSpans[getSpanID(span)];

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
    const shouldIncludeGap = !isEventFromBrowserJavaScriptSDK(event);

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

    const treeDepthEntry = isOrphanSpan(span)
      ? ({type: 'orphan', depth: treeDepth} as OrphanTreeDepth)
      : treeDepth;

    const treeArr = isLast
      ? continuingTreeDepths
      : [...continuingTreeDepths, treeDepthEntry];

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
      isOrphan: isOrphanSpan(span),
    };

    const spanGapComponent =
      isValidGap && isSpanDisplayed ? (
        <SpanGroup
          orgId={orgId}
          organization={organization}
          event={event}
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
          spansWithErrors={spansWithErrors}
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
            orgId={orgId}
            organization={organization}
            event={event}
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
            spansWithErrors={spansWithErrors}
          />
        </React.Fragment>
      ),
    };
  };

  generateBounds() {
    const {dragProps, trace} = this.props;

    return boundsGenerator({
      traceStartTimestamp: trace.traceStartTimestamp,
      traceEndTimestamp: trace.traceEndTimestamp,
      viewStart: dragProps.viewWindowStart,
      viewEnd: dragProps.viewWindowEnd,
    });
  }

  renderRootSpan = (): RenderedSpanTree => {
    const {trace} = this.props;

    const rootSpan: RawSpanType = generateRootSpan(trace);

    const generateBounds = this.generateBounds();

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

  renderDivider(
    dividerHandlerChildrenProps: DividerHandlerManager.DividerHandlerManagerChildrenProps
  ) {
    const {addDividerLineRef} = dividerHandlerChildrenProps;

    return (
      <DividerLine
        ref={addDividerLineRef()}
        style={{
          position: 'relative',
        }}
        onMouseEnter={() => {
          dividerHandlerChildrenProps.setHover(true);
        }}
        onMouseLeave={() => {
          dividerHandlerChildrenProps.setHover(false);
        }}
        onMouseOver={() => {
          dividerHandlerChildrenProps.setHover(true);
        }}
        onMouseDown={dividerHandlerChildrenProps.onDragStart}
        onClick={event => {
          // we prevent the propagation of the clicks from this component to prevent
          // the span detail from being opened.
          event.stopPropagation();
        }}
      />
    );
  }

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

    const limitExceededMessage = this.generateLimitExceededMessage();

    return (
      <TraceViewContainer ref={this.props.traceViewRef}>
        {spanTree}
        <GuideAnchorWrapper>
          <GuideAnchor target="span_tree" position="bottom" />
        </GuideAnchorWrapper>
        {infoMessage}
        {limitExceededMessage}
      </TraceViewContainer>
    );
  }
}

const TraceViewContainer = styled('div')`
  overflow-x: hidden;
  border-bottom-left-radius: 3px;
  border-bottom-right-radius: 3px;
`;

const GuideAnchorWrapper = styled('div')`
  height: 0;
  width: 0;
  margin-left: 50%;
`;

/**
 * Checks if a trace contains all of its spans.
 *
 * The heuristic used here favors false negatives over false positives.
 * This is because showing a warning that the trace is not showing all
 * spans when it has them all is more misleading than not showing a
 * warning when it is missing some spans.
 *
 * A simple heuristic to determine when there are unrecorded spans
 *
 * 1. We assume if there are less than 999 spans, then we have all
 *    the spans for a transaction. 999 was chosen because most SDKs
 *    have a default limit of 1000 spans per transaction, but the
 *    python SDK is 999 for historic reasons.
 *
 * 2. We assume that if there are unrecorded spans, they should be
 *    at least 100ms in duration.
 *
 * While not perfect, this simple heuristic is unlikely to report
 * false positives.
 */
function hasAllSpans(trace: ParsedTraceType): boolean {
  const {traceEndTimestamp, spans} = trace;
  if (spans.length < 999) {
    return true;
  }

  const lastSpan = spans.reduce((latest, span) =>
    latest.timestamp > span.timestamp ? latest : span
  );
  const missingDuration = traceEndTimestamp - lastSpan.timestamp;

  return missingDuration < 0.1;
}

export default SpanTree;
