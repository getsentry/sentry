import React, {Component} from 'react';
import {
  CellMeasurer,
  CellMeasurerCache,
  List as ReactVirtualizedList,
  ListRowProps,
  OverscanIndicesGetterParams,
  WindowScroller,
} from 'react-virtualized';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';

import {ROW_HEIGHT, SpanBarType} from 'sentry/components/performance/waterfall/constants';
import {MessageRow} from 'sentry/components/performance/waterfall/messageRow';
import {pickBarColor} from 'sentry/components/performance/waterfall/utils';
import {t, tct} from 'sentry/locale';
import {Organization} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';

import * as AnchorLinkManager from './anchorLinkManager';
import {DragManagerChildrenProps} from './dragManager';
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
import {
  getSpanID,
  getSpanOperation,
  setSpansOnTransaction,
  spanTargetHash,
} from './utils';
import WaterfallModel from './waterfallModel';

type PropType = ScrollbarManagerChildrenProps & {
  dragProps: DragManagerChildrenProps;
  filterSpans: FilterSpans | undefined;
  organization: Organization;
  spans: EnhancedProcessedSpanType[];
  traceViewRef: React.RefObject<HTMLDivElement>;
  waterfallModel: WaterfallModel;
  focusedSpanIds?: Set<string>;
};

const cache = new CellMeasurerCache({
  fixedWidth: true,

  defaultHeight: ROW_HEIGHT,
  minHeight: ROW_HEIGHT,
});

const listRef = React.createRef<ReactVirtualizedList>();

class SpanTree extends Component<PropType> {
  state = {
    isScrollingToAnchor: false,
    anchoredSpanIndex: -1,
  };

  componentDidMount() {
    setSpansOnTransaction(this.props.spans.length);

    if (location.hash) {
      const {spans} = this.props;

      const index = spans.findIndex(({span}) => {
        if ('type' in span) {
          return false;
        }
        return spanTargetHash(span.span_id) === location.hash;
      });

      if (index < 0) {
        return;
      }

      // This is just an estimate of where the anchored span is located. We can't get its precise location here, since
      // we need it to mount and use its boundingbox to determine that, but since the list is virtualized, there's no guarantee that
      // this span is mounted initially. The actual scroll positioning will be determined within the SpanBar instance that is anchored,
      // since this scroll estimation will allow that span to mount
      window.scrollTo(0, window.scrollY + ROW_HEIGHT * index);
    }
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
    filteredSpansAbove: EnhancedProcessedSpanType[];
    isCurrentSpanFilteredOut: boolean;
    isCurrentSpanHidden: boolean;
    outOfViewSpansAbove: EnhancedProcessedSpanType[];
  }): JSX.Element | null {
    const {
      isCurrentSpanHidden,
      outOfViewSpansAbove,
      isCurrentSpanFilteredOut,
      filteredSpansAbove,
    } = input;

    const {focusedSpanIds, waterfallModel, organization} = this.props;

    const messages: React.ReactNode[] = [];
    let firstHiddenSpanId = '0';

    const numOfSpansOutOfViewAbove = outOfViewSpansAbove.length;
    const showHiddenSpansMessage = !isCurrentSpanHidden && numOfSpansOutOfViewAbove > 0;

    if (showHiddenSpansMessage) {
      firstHiddenSpanId = getSpanID(outOfViewSpansAbove[0].span);
      messages.push(
        <span key={`spans-out-of-view-${firstHiddenSpanId}`}>
          <strong>{numOfSpansOutOfViewAbove}</strong> {t('spans out of view')}
        </span>
      );
    }

    const numOfFilteredSpansAbove = filteredSpansAbove.length;
    const showFilteredSpansMessage =
      !isCurrentSpanFilteredOut && numOfFilteredSpansAbove > 0;

    if (showFilteredSpansMessage) {
      firstHiddenSpanId = getSpanID(filteredSpansAbove[0].span);
      if (!isCurrentSpanHidden) {
        if (numOfFilteredSpansAbove === 1) {
          messages.push(
            <span key={`spans-filtered-${firstHiddenSpanId}`}>
              {tct('[numOfSpans] hidden span', {
                numOfSpans: <strong>{numOfFilteredSpansAbove}</strong>,
              })}
            </span>
          );
        } else {
          messages.push(
            <span key={`spans-filtered-${firstHiddenSpanId}`}>
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

    const isClickable = focusedSpanIds && showFilteredSpansMessage;

    return (
      <MessageRow
        key={`message-row-${firstHiddenSpanId}`}
        onClick={
          isClickable
            ? () => {
                trackAdvancedAnalyticsEvent(
                  'issue_details.performance.hidden_spans_expanded',
                  {organization}
                );
                waterfallModel.expandHiddenSpans(filteredSpansAbove.slice(0));
              }
            : undefined
        }
        cursor={isClickable ? 'pointer' : 'default'}
      >
        {messages}
      </MessageRow>
    );
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

  generateSpanTree = () => {
    const {
      waterfallModel,
      spans,
      organization,
      dragProps,
      onWheel,
      generateContentSpanBarRef,
      markSpanOutOfView,
      markSpanInView,
      storeSpanBar,
    } = this.props;

    const generateBounds = waterfallModel.generateBounds({
      viewStart: dragProps.viewWindowStart,
      viewEnd: dragProps.viewWindowEnd,
    });

    type AccType = {
      filteredSpansAbove: EnhancedProcessedSpanType[];
      outOfViewSpansAbove: EnhancedProcessedSpanType[];
      spanNumber: number;
      spanTree: JSX.Element[];
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

    const isEmbeddedSpanTree = waterfallModel.isEmbeddedSpanTree;

    const {spanTree, outOfViewSpansAbove, filteredSpansAbove} = spans.reduce(
      (acc: AccType, payload: EnhancedProcessedSpanType) => {
        const {type} = payload;

        switch (payload.type) {
          case 'filtered_out': {
            acc.filteredSpansAbove.push(payload);
            return acc;
          }
          case 'out_of_view': {
            acc.outOfViewSpansAbove.push(payload);
            return acc;
          }
          default: {
            break;
          }
        }

        const previousSpanNotDisplayed =
          acc.filteredSpansAbove.length > 0 || acc.outOfViewSpansAbove.length > 0;

        if (previousSpanNotDisplayed) {
          const infoMessage = this.generateInfoMessage({
            isCurrentSpanHidden: false,
            filteredSpansAbove: acc.filteredSpansAbove,
            outOfViewSpansAbove: acc.outOfViewSpansAbove,
            isCurrentSpanFilteredOut: false,
          });
          if (infoMessage) {
            acc.spanTree.push(infoMessage);
          }
        }

        const spanNumber = acc.spanNumber;
        const {span, treeDepth, continuingTreeDepths} = payload;

        if (payload.type === 'span_group_chain') {
          acc.spanTree.push(
            <SpanDescendantGroupBar
              key={`${spanNumber}-span-group`}
              event={waterfallModel.event}
              span={span}
              generateBounds={generateBounds}
              treeDepth={treeDepth}
              continuingTreeDepths={continuingTreeDepths}
              spanNumber={spanNumber}
              spanGrouping={payload.spanNestedGrouping as EnhancedSpan[]}
              toggleSpanGroup={payload.toggleNestedSpanGroup as () => void}
              onWheel={onWheel}
              generateContentSpanBarRef={generateContentSpanBarRef}
            />
          );
          acc.spanNumber = spanNumber + 1;

          acc.outOfViewSpansAbove = [];
          acc.filteredSpansAbove = [];

          return acc;
        }

        if (payload.type === 'span_group_siblings') {
          acc.spanTree.push(
            <SpanSiblingGroupBar
              key={`${spanNumber}-span-sibling`}
              event={waterfallModel.event}
              span={span}
              generateBounds={generateBounds}
              treeDepth={treeDepth}
              continuingTreeDepths={continuingTreeDepths}
              spanNumber={spanNumber}
              spanGrouping={payload.spanSiblingGrouping as EnhancedSpan[]}
              toggleSiblingSpanGroup={payload.toggleSiblingSpanGroup}
              isLastSibling={payload.isLastSibling ?? false}
              occurrence={payload.occurrence}
              onWheel={onWheel}
              generateContentSpanBarRef={generateContentSpanBarRef}
              isEmbeddedSpanTree={isEmbeddedSpanTree}
            />
          );
          acc.spanNumber = spanNumber + 1;

          acc.outOfViewSpansAbove = [];
          acc.filteredSpansAbove = [];

          return acc;
        }

        const key = getSpanID(span, `span-${spanNumber}`);
        const isLast = payload.isLastSibling;
        const isRoot = type === 'root_span';
        const spanBarColor: string = pickBarColor(getSpanOperation(span));
        const numOfSpanChildren = payload.numOfSpanChildren;

        acc.outOfViewSpansAbove = [];
        acc.filteredSpansAbove = [];

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

        const isAffectedSpan =
          !('type' in span) &&
          isEmbeddedSpanTree &&
          waterfallModel.affectedSpanIds?.includes(span.span_id);

        let spanBarType: SpanBarType | undefined = undefined;

        if (type === 'gap') {
          spanBarType = SpanBarType.GAP;
        }

        if (isAffectedSpan) {
          spanBarType = SpanBarType.AFFECTED;
        }

        acc.spanTree.push(
          <SpanBar
            key={key}
            organization={organization}
            event={waterfallModel.event}
            spanBarColor={spanBarColor}
            spanBarType={spanBarType}
            span={span}
            showSpanTree={!waterfallModel.hiddenSpanSubTrees.has(getSpanID(span))}
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
            toggleSiblingSpanGroup={toggleSiblingSpanGroup}
            fetchEmbeddedChildrenState={payload.fetchEmbeddedChildrenState}
            toggleSpanGroup={toggleSpanGroup}
            numOfSpans={numOfSpans}
            groupType={groupType}
            groupOccurrence={payload.groupOccurrence}
            isEmbeddedTransactionTimeAdjusted={payload.isEmbeddedTransactionTimeAdjusted}
            onWheel={onWheel}
            generateContentSpanBarRef={generateContentSpanBarRef}
            markSpanOutOfView={markSpanOutOfView}
            markSpanInView={markSpanInView}
            storeSpanBar={storeSpanBar}
            didAnchoredSpanMount={false}
          />
        );

        // If this is an embedded span tree, we will manually mark these spans as in view.
        // This is necessary because generally these spans are dependant on intersection observers which will
        // mark them in view, but these observers are not reliable when the span tree is in a condensed state.
        // Marking them here will ensure that the horizontally positioning is correctly set when the tree is loaded.
        if (isAffectedSpan) {
          markSpanInView(span.span_id, treeDepth);
        }

        acc.spanNumber = spanNumber + 1;
        return acc;
      },
      {
        filteredSpansAbove: [],
        outOfViewSpansAbove: [],
        spanTree: [],
        spanNumber: 1, // 1-based indexing
      }
    );

    const infoMessage = this.generateInfoMessage({
      isCurrentSpanHidden: false,
      outOfViewSpansAbove,
      isCurrentSpanFilteredOut: false,
      filteredSpansAbove,
    });

    if (infoMessage) {
      spanTree.push(infoMessage);
    }

    return spanTree;
  };

  renderRow(params: ListRowProps, spanTree: JSX.Element[]) {
    const {index, isVisible, key, parent, style, columnIndex} = params;

    return (
      <CellMeasurer
        key={key}
        cache={cache}
        parent={parent}
        columnIndex={columnIndex}
        rowIndex={index}
      >
        {({measure}) => {
          return (
            <AnchorLinkManager.Consumer>
              {({didAnchoredSpanMount, markAnchoredSpanIsMounted}) => (
                <div style={style}>
                  {spanTree[index].type === SpanBar ? (
                    <SpanBar
                      {...spanTree[index].props}
                      measure={measure}
                      didAnchoredSpanMount={didAnchoredSpanMount}
                      markAnchoredSpanIsMounted={markAnchoredSpanIsMounted}
                    />
                  ) : (
                    spanTree[index]
                  )}
                </div>
              )}
            </AnchorLinkManager.Consumer>
          );
        }}
      </CellMeasurer>
    );
  }

  // Overscan is necessary to ensure a smooth horizontal autoscrolling experience.
  // This function will allow the spanTree to mount spans which are not immediately visible
  // in the view. If they are mounted too late, the horizontal autoscroll will look super glitchy
  overscanIndicesGetter(params: OverscanIndicesGetterParams) {
    const {startIndex, stopIndex, overscanCellsCount, cellCount} = params;
    return {
      overscanStartIndex: Math.max(0, startIndex - overscanCellsCount),
      overscanStopIndex: Math.min(cellCount - 1, stopIndex + overscanCellsCount),
    };
  }

  render() {
    const spanTree = this.generateSpanTree();
    const infoMessage = spanTree[spanTree.length - 1];
    if (!infoMessage) {
      spanTree.pop();
    }

    const limitExceededMessage = this.generateLimitExceededMessage();
    limitExceededMessage && spanTree.push(limitExceededMessage);

    return (
      <TraceViewContainer ref={this.props.traceViewRef}>
        <WindowScroller>
          {({height, isScrolling, onChildScroll, scrollTop}) => {
            return (
              <ReactVirtualizedList
                autoHeight
                isScrolling={isScrolling}
                onScroll={onChildScroll}
                scrollTop={scrollTop}
                deferredMeasurementCache={cache}
                width={this.props.traceViewRef.current?.clientWidth ?? 1000} // TODO: You may need to use AutoSizer to get the real width
                height={height}
                rowHeight={cache.rowHeight}
                rowCount={spanTree.length}
                rowRenderer={props => this.renderRow(props, spanTree)}
                // TODO: Ok this overscanRowCount is too big. You can probably fix this by having it so that when spanBars are mounted, we set
                // their left property immediately. Or maybe something will work out with using isVisible for the view manager.
                overscanRowCount={10}
                overscanIndicesGetter={this.overscanIndicesGetter}
                ref={listRef}
              />
            );
          }}
        </WindowScroller>
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
