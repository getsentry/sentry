import * as React from 'react';
import styled from '@emotion/styled';
import {uuid4} from '@sentry/utils';
import {memoize} from 'lodash';
import isEqual from 'lodash/isEqual';

import {MessageRow} from 'sentry/components/performance/waterfall/messageRow';
import {pickBarColor} from 'sentry/components/performance/waterfall/utils';
import {t, tct} from 'sentry/locale';
import {Organization} from 'sentry/types';
import * as QuickTraceContext from 'sentry/utils/performance/quickTrace/quickTraceContext';

import * as DividerHandlerManager from './dividerHandlerManager';
import {DragManagerChildrenProps} from './dragManager';
import * as ScrollbarManager from './scrollbarManager';
import {ScrollbarManagerChildrenProps, withScrollbarManager} from './scrollbarManager';
import SpanBar from './spanBar';
import {SpanDescendantGroupBar} from './spanDescendantGroupBar';
import SpanSiblingGroupBar from './spanSiblingGroupBar';
import {
  EnhancedProcessedSpanType,
  EnhancedSpan,
  FilterSpans,
  GroupType,
  ParsedTraceType,
  SpanType,
} from './types';
import {getSpanID, getSpanOperation, setSpansOnTransaction} from './utils';
import WaterfallModel from './waterfallModel';

type PropType = ScrollbarManagerChildrenProps & {
  allSpans: EnhancedProcessedSpanType[];
  dividerHandlerChildrenProps: DividerHandlerManager.DividerHandlerManagerChildrenProps;
  dragProps: DragManagerChildrenProps;
  filterSpans: FilterSpans | undefined;
  organization: Organization;
  quickTrace: any;
  scrollbarManagerChildrenProps: ScrollbarManager.ScrollbarManagerChildrenProps;
  spans: EnhancedProcessedSpanType[];
  traceViewRef: React.RefObject<HTMLDivElement>;
  waterfallModel: WaterfallModel;
};

class SpanTree extends React.Component<PropType> {
  componentDidMount() {
    setSpansOnTransaction(this.props.spans.length);
  }

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
    isCurrentSpanFilteredOut: boolean;
    isCurrentSpanHidden: boolean;
    numOfFilteredSpansAbove: number;
    numOfSpansOutOfViewAbove: number;
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
    this.props.waterfallModel.toggleSpanSubTree(spanID);
    // Update horizontal scroll states after this subtree was either hidden or
    // revealed.
    this.props.updateScrollState();
  };

  generateBounds = () => {
    return this.props.waterfallModel.generateBounds({
      viewStart: this.props.dragProps.viewWindowStart,
      viewEnd: this.props.dragProps.viewWindowEnd,
    });
  };

  getContinuingDepthFromPayload = (payload: EnhancedProcessedSpanType) => {
    if (
      payload.type === 'filtered_out' ||
      payload.type === 'out_of_view' ||
      payload.type === 'span_group_chain' ||
      payload.type === 'span_group_siblings'
    ) {
      return [];
    }
    return payload.continuingTreeDepths;
  };

  toggleEmbeddedFromPayload = (payload: EnhancedProcessedSpanType) => {
    if (
      payload.type === 'filtered_out' ||
      payload.type === 'out_of_view' ||
      payload.type === 'span_group_chain' ||
      payload.type === 'span_group_siblings'
    ) {
      return () => {};
    }
    return payload.toggleEmbeddedChildren;
  };

  getSpan = memoize((spanId: string, allSpans: EnhancedProcessedSpanType[]) => {
    return allSpans.find(span => span.span.span_id === spanId) || allSpans[0];
  });

  render() {
    const {waterfallModel, spans, organization} = this.props;

    type AccType = {
      numOfFilteredSpansAbove: number;
      numOfSpansOutOfViewAbove: number;
      spanNumber: number;
      spanTree: React.ReactNode[];
    };

    const numOfSpans = spans.reduce((sum: number, payload: EnhancedProcessedSpanType) => {
      switch (payload.type) {
        case 'root_span':
        case 'span':
        case 'span_group_chain': {
          return sum + 1;
        }

        default: {
          return sum;
        }
      }
    }, 0);

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

        const spanNumber = acc.spanNumber;
        const {span, treeDepth, continuingTreeDepths} = payload;

        if (payload.type === 'span_group_chain') {
          acc.spanTree.push(
            <SpanDescendantGroupBar
              key={`${spanNumber}-span-group`}
              event={waterfallModel.event}
              span={span}
              generateBounds={this.generateBounds}
              treeDepth={treeDepth}
              continuingTreeDepths={continuingTreeDepths}
              spanNumber={spanNumber}
              spanGrouping={payload.spanNestedGrouping as EnhancedSpan[]}
              toggleSpanGroup={payload.toggleNestedSpanGroup as () => void}
            />
          );
          acc.spanNumber = spanNumber + 1;
          return acc;
        }

        if (payload.type === 'span_group_siblings') {
          acc.spanTree.push(
            <SpanSiblingGroupBar
              key={`${spanNumber}-span-sibling`}
              event={waterfallModel.event}
              span={span}
              generateBounds={this.generateBounds}
              treeDepth={treeDepth}
              continuingTreeDepths={continuingTreeDepths}
              spanNumber={spanNumber}
              spanGrouping={payload.spanSiblingGrouping as EnhancedSpan[]}
              toggleSiblingSpanGroup={payload.toggleSiblingSpanGroup}
              isLastSibling={payload.isLastSibling ?? false}
              occurrence={payload.occurrence}
            />
          );
          acc.spanNumber = spanNumber + 1;
          return acc;
        }

        const key = getSpanID(span, `span-${spanNumber}`);
        const isLast = payload.isLastSibling;
        const isRoot = type === 'root_span';
        const spanBarColor: string = pickBarColor(getSpanOperation(span));
        const numOfSpanChildren = payload.numOfSpanChildren;

        acc.numOfFilteredSpansAbove = 0;
        acc.numOfSpansOutOfViewAbove = 0;

        let toggleSpanGroup: (() => void) | undefined = undefined;
        if (payload.type === 'span') {
          toggleSpanGroup = payload.toggleNestedSpanGroup;
        }

        let toggleSiblingSpanGroup:
          | ((span: SpanType, occurrence: number) => void)
          | undefined = undefined;
        if (payload.type === 'span' && payload.isFirstSiblingOfGroup) {
          toggleSiblingSpanGroup = payload.toggleSiblingSpanGroup;
        }

        let groupType;
        if (toggleSpanGroup) {
          groupType = GroupType.DESCENDANTS;
        } else if (toggleSiblingSpanGroup) {
          groupType = GroupType.SIBLINGS;
        }

        acc.spanTree.push(
          <SpanBar
            key={key}
            organization={organization}
            event={waterfallModel.event}
            spanBarColor={spanBarColor}
            spanBarHatch={type === 'gap'}
            span={span}
            quickTrace={this.props.quickTrace}
            scrollbarManagerChildrenProps={this.props.scrollbarManagerChildrenProps}
            dividerHandlerChildrenProps={this.props.dividerHandlerChildrenProps}
            enhancedSpan={this.getSpan(span.span_id ?? uuid4(), this.props.allSpans)}
            showSpanTree={!waterfallModel.hiddenSpanSubTrees.has(getSpanID(span))}
            numOfSpanChildren={numOfSpanChildren}
            trace={waterfallModel.parsedTrace}
            generateBounds={this.generateBounds}
            toggleSpanTree={this.toggleSpanTree}
            spanId={getSpanID(span)}
            treeDepth={treeDepth}
            continuingTreeDepths={this.getContinuingDepthFromPayload}
            spanNumber={spanNumber}
            isLast={isLast}
            isRoot={isRoot}
            showEmbeddedChildren={payload.showEmbeddedChildren}
            toggleEmbeddedChildren={this.toggleEmbeddedFromPayload}
            toggleSiblingSpanGroup={toggleSiblingSpanGroup}
            fetchEmbeddedChildrenState={payload.fetchEmbeddedChildrenState}
            toggleSpanGroup={toggleSpanGroup}
            numOfSpans={numOfSpans}
            groupType={groupType}
            groupOccurrence={payload.groupOccurrence}
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
