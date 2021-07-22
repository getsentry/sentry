import * as React from 'react';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';

import {MessageRow} from 'app/components/performance/waterfall/messageRow';
import {pickBarColor} from 'app/components/performance/waterfall/utils';
import {t, tct} from 'app/locale';
import {Organization} from 'app/types';
import {assert} from 'app/types/utils';

import {DragManagerChildrenProps} from './dragManager';
import {ScrollbarManagerChildrenProps, withScrollbarManager} from './scrollbarManager';
import SpanBar from './spanBar';
import SpanGroupBar, {isCollapsedSpanGroup} from './spanGroupBar';
import {
  EnhancedProcessedSpanType,
  EnhancedSpan,
  FilterSpans,
  ParsedTraceType,
} from './types';
import {getSpanID, getSpanOperation} from './utils';
import WaterfallModel from './waterfallModel';

type PropType = ScrollbarManagerChildrenProps & {
  organization: Organization;
  dragProps: DragManagerChildrenProps;
  traceViewRef: React.RefObject<HTMLDivElement>;
  filterSpans: FilterSpans | undefined;
  waterfallModel: WaterfallModel;
  spans: EnhancedProcessedSpanType[];
};

class SpanTree extends React.Component<PropType> {
  shouldComponentUpdate(nextProps: PropType) {
    if (
      this.props.dragProps.isDragging !== nextProps.dragProps.isDragging ||
      this.props.dragProps.isWindowSelectionDragging !==
        nextProps.dragProps.isWindowSelectionDragging
    ) {
      return true;
    }

    if (
      nextProps.dragProps.isDragging ||
      nextProps.dragProps.isWindowSelectionDragging ||
      isEqual(this.props.spans, nextProps.spans)
    ) {
      return false;
    }

    return true;
  }

  componentDidUpdate(prevProps: PropType) {
    if (
      !isEqual(prevProps.filterSpans, this.props.filterSpans) ||
      !isEqual(prevProps.spans, this.props.spans)
    ) {
      // Update horizontal scroll states after a search has been performed or if
      // if the spans has changed
      this.props.updateScrollState();
    }
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

    return <MessageRow>{messages}</MessageRow>;
  }

  generateLimitExceededMessage() {
    const {waterfallModel} = this.props;
    const {parsedTrace} = waterfallModel;

    if (hasAllSpans(parsedTrace)) {
      return null;
    }

    return (
      <MessageRow>
        {t(
          'The next spans are unavailable. You may have exceeded the span limit or need to address missing instrumentation.'
        )}
      </MessageRow>
    );
  }

  toggleSpanTree = (spanID: string) => () => {
    this.props.waterfallModel.toggleSpanGroup(spanID);
    // Update horizontal scroll states after this subtree was either hidden or
    // revealed.
    this.props.updateScrollState();
  };

  render() {
    const {waterfallModel, spans, organization, dragProps} = this.props;
    const generateBounds = waterfallModel.generateBounds({
      viewStart: dragProps.viewWindowStart,
      viewEnd: dragProps.viewWindowEnd,
    });

    type AccType = {
      numOfSpansOutOfViewAbove: number;
      numOfFilteredSpansAbove: number;
      spanTree: React.ReactNode[];
      spanNumber: number;
    };

    const {spanTree, numOfSpansOutOfViewAbove, numOfFilteredSpansAbove} = spans.reduce(
      (acc: AccType, payload: EnhancedProcessedSpanType) => {
        const {type} = payload;

        switch (payload.type) {
          case 'filtered_out': {
            acc.numOfFilteredSpansAbove += 1;
            return acc;
          }
          case 'out_of_view': {
            acc.numOfSpansOutOfViewAbove += 1;
            return acc;
          }
          default: {
            break;
          }
        }

        const previousSpanNotDisplayed =
          acc.numOfFilteredSpansAbove > 0 || acc.numOfSpansOutOfViewAbove > 0;

        if (previousSpanNotDisplayed) {
          const infoMessage = this.generateInfoMessage({
            isCurrentSpanHidden: false,
            numOfSpansOutOfViewAbove: acc.numOfSpansOutOfViewAbove,
            isCurrentSpanFilteredOut: false,
            numOfFilteredSpansAbove: acc.numOfFilteredSpansAbove,
          });
          acc.spanTree.push(infoMessage);
        }

        const {span} = payload;

        let spanNumber = acc.spanNumber;

        const key = getSpanID(span, `span-${spanNumber}`);
        const isLast = payload.isLastSibling;
        const isRoot = type === 'root_span';
        const spanBarColor: string = pickBarColor(getSpanOperation(span));
        const numOfSpanChildren = payload.numOfSpanChildren;
        const treeDepth = payload.treeDepth;
        const continuingTreeDepths = payload.continuingTreeDepths;

        acc.numOfFilteredSpansAbove = 0;
        acc.numOfSpansOutOfViewAbove = 0;

        const hasCollapsedSpanGroup: boolean =
          (payload.type === 'span' || payload.type === 'root_span') &&
          isCollapsedSpanGroup({
            spanGrouping: payload.spanGrouping,
            showSpanGroup: payload.showSpanGroup,
            toggleSpanGroup: payload.toggleSpanGroup,
          });

        if (hasCollapsedSpanGroup) {
          assert(payload.type === 'span' || payload.type === 'root_span');
          // If the span has a collapsed span group, then we render it above the associated span.
          // The associated span will be the last span of the span group.
          acc.spanTree.push(
            <SpanGroupBar
              key={`${key}-span-group`}
              event={waterfallModel.event}
              span={span}
              generateBounds={generateBounds}
              treeDepth={treeDepth}
              continuingTreeDepths={continuingTreeDepths}
              spanNumber={spanNumber}
              spanGrouping={payload.spanGrouping as EnhancedSpan[]}
              toggleSpanGroup={payload.toggleSpanGroup as () => void}
            />
          );

          spanNumber = spanNumber + 1;
        }

        acc.spanTree.push(
          <SpanBar
            key={key}
            organization={organization}
            event={waterfallModel.event}
            spanBarColor={spanBarColor}
            spanBarHatch={type === 'gap'}
            span={span}
            showSpanTree={!waterfallModel.hiddenSpanGroups.has(getSpanID(span))}
            numOfSpanChildren={numOfSpanChildren}
            trace={waterfallModel.parsedTrace}
            generateBounds={generateBounds}
            toggleSpanTree={this.toggleSpanTree(getSpanID(span))}
            treeDepth={treeDepth}
            continuingTreeDepths={continuingTreeDepths}
            spanNumber={spanNumber}
            isLast={isLast}
            isRoot={isRoot}
            showEmbeddedChildren={payload.showEmbeddedChildren}
            toggleEmbeddedChildren={payload.toggleEmbeddedChildren}
            fetchEmbeddedChildrenState={payload.fetchEmbeddedChildrenState}
            hasCollapsedSpanGroup={hasCollapsedSpanGroup}
          />
        );

        acc.spanNumber = spanNumber + 1;
        return acc;
      },
      {
        numOfSpansOutOfViewAbove: 0,
        numOfFilteredSpansAbove: 0,
        spanTree: [],
        spanNumber: 1, // 1-based indexing
      }
    );

    const infoMessage = this.generateInfoMessage({
      isCurrentSpanHidden: false,
      numOfSpansOutOfViewAbove,
      isCurrentSpanFilteredOut: false,
      numOfFilteredSpansAbove,
    });

    return (
      <TraceViewContainer ref={this.props.traceViewRef}>
        {spanTree}
        {infoMessage}
        {this.generateLimitExceededMessage()}
      </TraceViewContainer>
    );
  }
}

const TraceViewContainer = styled('div')`
  overflow-x: hidden;
  border-bottom-left-radius: 3px;
  border-bottom-right-radius: 3px;
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

export default withScrollbarManager(SpanTree);
