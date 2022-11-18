import React, {Component} from 'react';
import {
  AutoSizer,
  CellMeasurer,
  CellMeasurerCache,
  List as ReactVirtualizedList,
  ListRowProps,
  OverscanIndicesGetterParams,
  WindowScroller,
} from 'react-virtualized';
import styled from '@emotion/styled';
import differenceWith from 'lodash/differenceWith';
import isEqual from 'lodash/isEqual';

import {ROW_HEIGHT, SpanBarType} from 'sentry/components/performance/waterfall/constants';
import {MessageRow} from 'sentry/components/performance/waterfall/messageRow';
import {pickBarColor} from 'sentry/components/performance/waterfall/utils';
import {t, tct} from 'sentry/locale';
import {Organization} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';

import {DragManagerChildrenProps} from './dragManager';
import {ScrollbarManagerChildrenProps, withScrollbarManager} from './scrollbarManager';
import SpanBar from './spanBar';
import * as SpanContext from './spanContext';
import {SpanDescendantGroupBar} from './spanDescendantGroupBar';
import SpanSiblingGroupBar from './spanSiblingGroupBar';
import {
  EnhancedProcessedSpanType,
  EnhancedSpan,
  FilterSpans,
  GroupType,
  ParsedTraceType,
  SpanTreeNode,
  SpanTreeNodeType,
  SpanType,
} from './types';
import {
  getSpanID,
  getSpanOperation,
  isGapSpan,
  setSpansOnTransaction,
  spanTargetHash,
} from './utils';
import WaterfallModel from './waterfallModel';

type PropType = ScrollbarManagerChildrenProps & {
  dragProps: DragManagerChildrenProps;
  filterSpans: FilterSpans | undefined;
  organization: Organization;
  spanContextProps: SpanContext.SpanContextProps;
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
  componentDidMount() {
    setSpansOnTransaction(this.props.spans.length);

    if (location.hash) {
      const {spans} = this.props;

      // This reducer searches for the index of the anchored span.
      // It's possible that one of the spans within an autogroup is anchored, so we need to search
      // for the index within the autogroupings as well.
      const {finalIndex, isIndexFound} = spans.reduce(
        (
          acc: {
            finalIndex: number;
            isIndexFound: boolean;
          },
          span,
          currIndex
        ) => {
          if ('type' in span.span || acc.isIndexFound) {
            return acc;
          }

          if (spanTargetHash(span.span.span_id) === location.hash) {
            acc.finalIndex = currIndex;
            acc.isIndexFound = true;
          }

          if (span.type === 'span_group_siblings') {
            if (!span.spanSiblingGrouping) {
              return acc;
            }

            const indexWithinGroup = span.spanSiblingGrouping.findIndex(
              s => spanTargetHash(s.span.span_id) === location.hash
            );

            if (indexWithinGroup === -1) {
              return acc;
            }

            acc.finalIndex = currIndex + indexWithinGroup;
            acc.isIndexFound = true;
            return acc;
          }

          if (span.type === 'span_group_chain') {
            if (!span.spanNestedGrouping) {
              return acc;
            }

            const indexWithinGroup = span.spanNestedGrouping.findIndex(
              s => spanTargetHash(s.span.span_id) === location.hash
            );

            if (indexWithinGroup === -1) {
              return acc;
            }

            acc.finalIndex = currIndex + indexWithinGroup;
            acc.isIndexFound = true;
            return acc;
          }

          return acc;
        },
        {finalIndex: -1, isIndexFound: false}
      );

      if (!isIndexFound) {
        return;
      }

      // This is just an estimate of where the anchored span is located. We can't get its precise location here, since
      // we need it to mount and use its boundingbox to determine that, but since the list is virtualized, there's no guarantee that
      // this span is mounted initially. The actual scroll positioning will be determined within the SpanBar instance that is anchored,
      // since this scroll estimation will allow that span to mount
      window.scrollTo(0, window.scrollY + ROW_HEIGHT * finalIndex);
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
    // If the filters or minimap drag props have changed, we can't pinpoint the exact
    // spans that we need to recalculate the heights for, so recompute them all
    if (
      !isEqual(prevProps.filterSpans, this.props.filterSpans) ||
      !isEqual(prevProps.dragProps, this.props.dragProps)
    ) {
      cache.clearAll();
      listRef.current?.recomputeRowHeights();
      return;
    }

    // When the spans change, we can be more efficient with recomputing heights.
    // Measuring cells is an expensive operation, so efficiency here is key.
    // We will look specifically at the cells that need to have their heights recalculated, and clear
    // their respective slots in the cache.
    if (prevProps.spans.length !== this.props.spans.length) {
      // When the structure of the span tree is changed in an update, this can be due to the following reasons:
      // - A subtree was collapsed or expanded
      // - An autogroup was collapsed or expanded
      // - An embedded transaction was collapsed or expanded

      // Notice how in each case, there are two subcases: collapsing and expanding
      // In the collapse case, spans are *removed* from the tree, whereas expansion *adds* spans to the tree
      // We will have to determine which of these cases occurred, and then use that info to determine which specific cells
      // need to be recomputed.

      const comparator = (
        span1: EnhancedProcessedSpanType,
        span2: EnhancedProcessedSpanType
      ) => {
        if (isGapSpan(span1.span) || isGapSpan(span2.span)) {
          return isEqual(span1.span, span2.span);
        }

        return span1.span.span_id === span2.span.span_id;
      };

      // Case 1: Spans were removed due to a subtree or group collapsing
      if (prevProps.spans.length > this.props.spans.length) {
        // diffLeft will tell us all spans that have been removed in this update.
        const diffLeft = new Set(
          differenceWith(prevProps.spans, this.props.spans, comparator)
        );

        prevProps.spans.forEach((span, index) => {
          // We only want to clear the cache for spans that are expanded.
          if (this.props.spanContextProps.isSpanExpanded(span.span)) {
            cache.clear(index, 0);
          }
        });

        // This loop will ensure that any expanded spans after the spans which were removed
        // will have their cache slots cleared, since the new spans which will occupy those slots will not be expanded.
        this.props.spans.forEach(({span}, index) => {
          if (this.props.spanContextProps.isSpanExpanded(span)) {
            // Since spans were removed, the index in the new state is offset by the num of spans removed
            cache.clear(index + diffLeft.size, 0);
          }
        });
      }
      // Case 2: Spans were added due to a subtree or group expanding
      else {
        // diffRight will tell us all spans that have been added in this update.
        const diffRight = new Set(
          differenceWith(this.props.spans, prevProps.spans, comparator)
        );

        prevProps.spans.forEach(({span}, index) => {
          // We only want to clear the cache for spans that are added.
          if (this.props.spanContextProps.isSpanExpanded(span)) {
            cache.clear(index, 0);
          }
        });

        this.props.spans.forEach(({span}, index) => {
          if (this.props.spanContextProps.isSpanExpanded(span)) {
            cache.clear(index, 0);
          }
        });

        // This loop will ensure that any expanded spans after the spans which were removed
        // will have their cache slots cleared, since the new spans which will occupy those slots will not be expanded.
        prevProps.spans.forEach((span, index) => {
          if (
            !diffRight.has(span) &&
            this.props.spanContextProps.isSpanExpanded(span.span)
          ) {
            // Since spans were removed, the index in the new state is offset by the num of spans removed
            cache.clear(index + diffRight.size, 0);
          }
        });
      }

      listRef.current?.forceUpdateGrid();
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
                this.props.updateScrollState();
                // We must clear the cache at this point, since the code in componentDidUpdate is unable to effectively
                // determine the specific cache slots to clear when hidden spans are expanded
                cache.clearAll();
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
  };

  // TODO: Clean this up so spanTree contains objects instead of React nodes
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
      getScrollLeftValue,
    } = this.props;

    const generateBounds = waterfallModel.generateBounds({
      viewStart: dragProps.viewWindowStart,
      viewEnd: dragProps.viewWindowEnd,
    });

    type AccType = {
      filteredSpansAbove: EnhancedProcessedSpanType[];
      outOfViewSpansAbove: EnhancedProcessedSpanType[];
      spanNumber: number;
      spanTree: SpanTreeNode[];
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
            acc.spanTree.push({type: SpanTreeNodeType.MESSAGE, element: infoMessage});
          }
        }

        const spanNumber = acc.spanNumber;
        const {span, treeDepth, continuingTreeDepths} = payload;

        if (payload.type === 'span_group_chain') {
          acc.spanTree.push({
            type: SpanTreeNodeType.DESCENDANT_GROUP,
            props: {
              event: waterfallModel.event,
              span,
              generateBounds,
              treeDepth,
              continuingTreeDepths,
              spanNumber,
              spanGrouping: payload.spanNestedGrouping as EnhancedSpan[],
              toggleSpanGroup: payload.toggleNestedSpanGroup as () => void,
              onWheel,
              generateContentSpanBarRef,
              getScrollLeftValue,
            },
          });
          acc.spanNumber = spanNumber + 1;

          acc.outOfViewSpansAbove = [];
          acc.filteredSpansAbove = [];

          return acc;
        }

        if (payload.type === 'span_group_siblings') {
          acc.spanTree.push({
            type: SpanTreeNodeType.SIBLING_GROUP,
            props: {
              event: waterfallModel.event,
              span,
              generateBounds,
              treeDepth,
              continuingTreeDepths,
              spanNumber,
              spanGrouping: payload.spanSiblingGrouping as EnhancedSpan[],
              toggleSiblingSpanGroup: payload.toggleSiblingSpanGroup,
              isLastSibling: payload.isLastSibling ?? false,
              occurrence: payload.occurrence,
              onWheel,
              generateContentSpanBarRef,
              isEmbeddedSpanTree,
              getScrollLeftValue,
            },
          });

          acc.spanNumber = spanNumber + 1;

          acc.outOfViewSpansAbove = [];
          acc.filteredSpansAbove = [];

          return acc;
        }

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

        acc.spanTree.push({
          type: SpanTreeNodeType.SPAN,
          props: {
            organization,
            event: waterfallModel.event,
            spanBarColor,
            spanBarType,
            span,
            showSpanTree: !waterfallModel.hiddenSpanSubTrees.has(getSpanID(span)),
            numOfSpanChildren,
            trace: waterfallModel.parsedTrace,
            generateBounds,
            toggleSpanTree: this.toggleSpanTree(getSpanID(span)),
            treeDepth,
            continuingTreeDepths,
            spanNumber,
            isLast,
            isRoot,
            showEmbeddedChildren: payload.showEmbeddedChildren,
            toggleEmbeddedChildren: payload.toggleEmbeddedChildren,
            toggleSiblingSpanGroup,
            fetchEmbeddedChildrenState: payload.fetchEmbeddedChildrenState,
            toggleSpanGroup,
            numOfSpans,
            groupType,
            groupOccurrence: payload.groupOccurrence,
            isEmbeddedTransactionTimeAdjusted: payload.isEmbeddedTransactionTimeAdjusted,
            onWheel,
            generateContentSpanBarRef,
            markSpanOutOfView,
            markSpanInView,
            storeSpanBar,
            getScrollLeftValue,
          },
        });

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
      spanTree.push({type: SpanTreeNodeType.MESSAGE, element: infoMessage});
    }

    return spanTree;
  };

  renderSpanNode(
    node: SpanTreeNode,
    extraProps: {
      cellMeasurerCache: CellMeasurerCache;
      listRef: React.RefObject<ReactVirtualizedList>;
      measure: () => void;
    } & SpanContext.SpanContextProps
  ) {
    switch (node.type) {
      case SpanTreeNodeType.SPAN:
        return (
          <SpanBar
            key={getSpanID(node.props.span, `span-${node.props.spanNumber}`)}
            {...node.props}
            {...extraProps}
          />
        );
      case SpanTreeNodeType.DESCENDANT_GROUP:
        return (
          <SpanDescendantGroupBar
            key={`${node.props.spanNumber}-span-group`}
            {...node.props}
            didAnchoredSpanMount={extraProps.didAnchoredSpanMount}
          />
        );
      case SpanTreeNodeType.SIBLING_GROUP:
        return (
          <SpanSiblingGroupBar
            key={`${node.props.spanNumber}-span-sibling`}
            {...node.props}
            didAnchoredSpanMount={extraProps.didAnchoredSpanMount}
          />
        );
      case SpanTreeNodeType.MESSAGE:
        return node.element;
      default:
        return null;
    }
  }

  renderRow(params: ListRowProps, spanTree: SpanTreeNode[]) {
    const {index, key, parent, style, columnIndex} = params;

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
            <div style={style}>
              {this.renderSpanNode(spanTree[index], {
                measure,
                listRef,
                cellMeasurerCache: cache,
                ...this.props.spanContextProps,
              })}
            </div>
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
    limitExceededMessage &&
      spanTree.push({type: SpanTreeNodeType.MESSAGE, element: limitExceededMessage});

    return (
      <TraceViewContainer ref={this.props.traceViewRef}>
        <WindowScroller>
          {({height, isScrolling, onChildScroll, scrollTop}) => (
            <AutoSizer disableHeight>
              {({width}) => (
                <ReactVirtualizedList
                  autoHeight
                  isScrolling={isScrolling}
                  onScroll={onChildScroll}
                  scrollTop={scrollTop}
                  deferredMeasurementCache={cache}
                  height={height}
                  width={width}
                  rowHeight={cache.rowHeight}
                  rowCount={spanTree.length}
                  rowRenderer={props => this.renderRow(props, spanTree)}
                  overscanRowCount={10}
                  overscanIndicesGetter={this.overscanIndicesGetter}
                  ref={listRef}
                />
              )}
            </AutoSizer>
          )}
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
