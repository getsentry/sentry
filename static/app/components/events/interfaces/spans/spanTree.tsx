import {Component, createRef, useEffect, useRef} from 'react';
import type {ListRowProps, OverscanIndicesGetterParams} from 'react-virtualized';
import {
  AutoSizer,
  CellMeasurer,
  CellMeasurerCache,
  List as ReactVirtualizedList,
  WindowScroller,
} from 'react-virtualized';
import styled from '@emotion/styled';
import {withProfiler} from '@sentry/react';
import differenceWith from 'lodash/differenceWith';
import isEqual from 'lodash/isEqual';
import throttle from 'lodash/throttle';

import {ROW_HEIGHT, SpanBarType} from 'sentry/components/performance/waterfall/constants';
import {MessageRow} from 'sentry/components/performance/waterfall/messageRow';
import {pickBarColor} from 'sentry/components/performance/waterfall/utils';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {setGroupedEntityTag} from 'sentry/utils/performanceForSentry';

import type {DragManagerChildrenProps} from './dragManager';
import type {ActiveOperationFilter} from './filter';
import type {ScrollbarManagerChildrenProps} from './scrollbarManager';
import {withScrollbarManager} from './scrollbarManager';
import {ProfiledSpanBar} from './spanBar';
import type * as SpanContext from './spanContext';
import {SpanDescendantGroupBar} from './spanDescendantGroupBar';
import SpanSiblingGroupBar from './spanSiblingGroupBar';
import type {
  EnhancedProcessedSpanType,
  EnhancedSpan,
  FilterSpans,
  ParsedTraceType,
  SpanTreeNode,
  SpanType,
} from './types';
import {GroupType, SpanTreeNodeType} from './types';
import {getSpanID, getSpanOperation, isGapSpan, spanTargetHash} from './utils';
import type WaterfallModel from './waterfallModel';

type PropType = ScrollbarManagerChildrenProps & {
  dragProps: DragManagerChildrenProps;
  filterSpans: FilterSpans | undefined;
  isEmbedded: boolean;
  operationNameFilters: ActiveOperationFilter;
  organization: Organization;
  spanContextProps: SpanContext.SpanContextProps;
  spans: EnhancedProcessedSpanType[];
  traceViewHeaderRef: React.RefObject<HTMLDivElement>;
  traceViewRef: React.RefObject<HTMLDivElement>;
  waterfallModel: WaterfallModel;
  focusedSpanIds?: Set<string>;
};

type StateType = {
  headerPos: number;
  spanRows: Record<string, {spanRow: React.RefObject<HTMLDivElement>; treeDepth: number}>;
};

const listRef = createRef<ReactVirtualizedList>();

class SpanTree extends Component<PropType> {
  state: StateType = {
    headerPos: 0,
    // Stores each visible span row ref along with its tree depth. This is used to calculate the
    // horizontal auto-scroll positioning
    spanRows: {},
  };

  componentDidMount() {
    setGroupedEntityTag('spans.total', 1000, this.props.spans.length);

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
      !isEqual(prevProps.dragProps, this.props.dragProps) ||
      !isEqual(prevProps.operationNameFilters, this.props.operationNameFilters)
    ) {
      this.cache.clearAll();
      listRef.current?.recomputeRowHeights();
      return;
    }

    // When the spans change, we can be more efficient with recomputing heights.
    // Measuring cells is an expensive operation, so efficiency here is key.
    // We will look specifically at the cells that need to have their heights recalculated, and clear
    // their respective slots in the cache.
    if (prevProps.spans.length !== this.props.spans.length) {
      // If there are filters applied, it's difficult to find the exact positioning of the spans that
      // changed. It's easier to just clear the cache instead
      if (this.props.operationNameFilters) {
        this.cache.clearAll();
        listRef.current?.recomputeRowHeights();
        return;
      }
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
            this.cache.clear(index, 0);
          }
        });

        // This loop will ensure that any expanded spans after the spans which were removed
        // will have their cache slots cleared, since the new spans which will occupy those slots will not be expanded.
        this.props.spans.forEach(({span}, index) => {
          if (this.props.spanContextProps.isSpanExpanded(span)) {
            // Since spans were removed, the index in the new state is offset by the num of spans removed
            this.cache.clear(index + diffLeft.size, 0);
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
            this.cache.clear(index, 0);
          }
        });

        this.props.spans.forEach(({span}, index) => {
          if (this.props.spanContextProps.isSpanExpanded(span)) {
            this.cache.clear(index, 0);
          }
        });

        // This loop will ensure that any expanded spans after the spans which were added
        // will have their cache slots cleared, since the new spans which will occupy those slots will not be expanded.
        prevProps.spans.forEach((span, index) => {
          if (
            !diffRight.has(span) &&
            this.props.spanContextProps.isSpanExpanded(span.span)
          ) {
            // Since spans were removed, the index in the new state is offset by the num of spans removed
            this.cache.clear(index + diffRight.size, 0);
          }
        });
      }

      listRef.current?.forceUpdateGrid();
    }
  }

  cache = new CellMeasurerCache({
    fixedWidth: true,

    defaultHeight: ROW_HEIGHT,
    minHeight: ROW_HEIGHT,
  });

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
      firstHiddenSpanId = getSpanID(outOfViewSpansAbove[0]!.span);
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
      firstHiddenSpanId = getSpanID(filteredSpansAbove[0]!.span);
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
                trackAnalytics('issue_details.performance.hidden_spans_expanded', {
                  organization,
                });
                waterfallModel.expandHiddenSpans(filteredSpansAbove.slice(0));

                // We must clear the cache at this point, since the code in componentDidUpdate is unable to effectively
                // determine the specific cache slots to clear when hidden spans are expanded
                this.cache.clearAll();
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

  generateSpanTree = () => {
    const {
      waterfallModel,
      spans,
      organization,
      dragProps,
      onWheel,
      addContentSpanBarRef,
      removeContentSpanBarRef,
      storeSpanBar,
      getCurrentLeftPos,
      onDragStart,
      onScroll,
      scrollBarAreaRef,
      updateHorizontalScrollState,
      updateScrollState,
      virtualScrollbarRef,
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
      (acc: AccType, payload: EnhancedProcessedSpanType, index: number) => {
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
          const groupingContainsAffectedSpan = payload.spanNestedGrouping?.find(
            ({span: s}) =>
              !isGapSpan(s) && waterfallModel.affectedSpanIds?.includes(s.span_id)
          );

          acc.spanTree.push({
            type: SpanTreeNodeType.DESCENDANT_GROUP,
            props: {
              event: waterfallModel.event,
              span,
              spanBarType: groupingContainsAffectedSpan
                ? SpanBarType.AUTOGROUPED_AND_AFFECTED
                : SpanBarType.AUTOGROUPED,
              generateBounds,
              getCurrentLeftPos: this.props.getCurrentLeftPos,
              treeDepth,
              continuingTreeDepths,
              spanNumber,
              spanGrouping: payload.spanNestedGrouping as EnhancedSpan[],
              toggleSpanGroup: payload.toggleNestedSpanGroup as () => void,
              onWheel,
              addContentSpanBarRef,
              removeContentSpanBarRef,
            },
          });
          acc.spanNumber = spanNumber + 1;

          acc.outOfViewSpansAbove = [];
          acc.filteredSpansAbove = [];

          return acc;
        }

        if (payload.type === 'span_group_siblings') {
          const groupingContainsAffectedSpan = payload.spanSiblingGrouping?.find(
            ({span: s}) =>
              !isGapSpan(s) && waterfallModel.affectedSpanIds?.includes(s.span_id)
          );

          acc.spanTree.push({
            type: SpanTreeNodeType.SIBLING_GROUP,
            props: {
              event: waterfallModel.event,
              span,
              spanBarType: groupingContainsAffectedSpan
                ? SpanBarType.AUTOGROUPED_AND_AFFECTED
                : SpanBarType.AUTOGROUPED,
              generateBounds,
              getCurrentLeftPos: this.props.getCurrentLeftPos,
              treeDepth,
              continuingTreeDepths,
              spanNumber,
              spanGrouping: payload.spanSiblingGrouping as EnhancedSpan[],
              toggleSiblingSpanGroup: payload.toggleSiblingSpanGroup,
              isLastSibling: payload.isLastSibling ?? false,
              occurrence: payload.occurrence,
              onWheel,
              addContentSpanBarRef,
              removeContentSpanBarRef,
              isEmbeddedSpanTree,
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

        let groupType: any;
        if (toggleSpanGroup) {
          groupType = GroupType.DESCENDANTS;
        } else if (toggleSiblingSpanGroup) {
          groupType = GroupType.SIBLINGS;
        }

        const isAffectedSpan =
          !isGapSpan(span) && waterfallModel.affectedSpanIds?.includes(span.span_id);

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
            getCurrentLeftPos,
            onDragStart,
            onScroll,
            scrollBarAreaRef,
            updateHorizontalScrollState,
            updateScrollState,
            virtualScrollbarRef,
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
            addContentSpanBarRef,
            removeContentSpanBarRef,
            storeSpanBar,
            isSpanInEmbeddedTree: waterfallModel.isEmbeddedSpanTree,
            resetCellMeasureCache: () => this.cache.clear(index, 0),
          },
        });

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

  renderRow(props: ListRowProps, spanTree: SpanTreeNode[]) {
    return (
      <SpanRow
        {...props}
        key={props.key}
        spanTree={spanTree}
        spanContextProps={this.props.spanContextProps}
        cache={this.cache}
        addSpanRowToState={this.addSpanRowToState}
        removeSpanRowFromState={this.removeSpanRowFromState}
      />
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

  addSpanRowToState = (
    spanId: string,
    spanRow: React.RefObject<HTMLDivElement>,
    treeDepth: number
  ) => {
    this.setState((prevState: StateType) => {
      const newSpanRows = {...prevState.spanRows};
      newSpanRows[spanId] = {spanRow, treeDepth};

      return {spanRows: newSpanRows};
    });
  };

  removeSpanRowFromState = (spanId: string) => {
    this.setState((prevState: StateType) => {
      const newSpanRows = {...prevState.spanRows};
      delete newSpanRows[spanId];
      return {spanRows: newSpanRows};
    });
  };

  isSpanRowVisible = (spanRow: React.RefObject<HTMLDivElement>) => {
    const {traceViewHeaderRef} = this.props;

    if (!spanRow.current || !traceViewHeaderRef.current) {
      return false;
    }

    const headerBottom = traceViewHeaderRef.current?.getBoundingClientRect().bottom;
    const viewportBottom = window.innerHeight || document.documentElement.clientHeight;
    const {bottom, top} = spanRow.current.getBoundingClientRect();

    // We determine if a span row is visible if it is above the viewport bottom boundary, below the header, and also below the top of the viewport
    return bottom < viewportBottom && bottom > headerBottom && top > 0;
  };

  throttledOnScroll = throttle(
    () => {
      const spanRowsArray = Object.values(this.state.spanRows);
      const {depthSum, visibleSpanCount, isRootSpanVisible} = spanRowsArray.reduce(
        (acc, {spanRow, treeDepth}) => {
          if (!spanRow.current || !this.isSpanRowVisible(spanRow)) {
            return acc;
          }

          if (treeDepth === 0) {
            acc.isRootSpanVisible = true;
          }

          acc.depthSum += treeDepth;
          acc.visibleSpanCount += 1;

          return acc;
        },
        {
          depthSum: 0,
          visibleSpanCount: 0,
          isRootSpanVisible: false,
        }
      );

      // If the root is visible, we do not want to shift the view around so just pass 0 instead of the average
      const averageDepth =
        isRootSpanVisible || visibleSpanCount === 0
          ? 0
          : Math.round(depthSum / visibleSpanCount);

      this.props.updateHorizontalScrollState(averageDepth);
    },
    500,
    {trailing: true}
  );

  render() {
    const spanTree = this.generateSpanTree();
    const infoMessage = spanTree[spanTree.length - 1];
    if (!infoMessage) {
      spanTree.pop();
    }

    const limitExceededMessage = this.generateLimitExceededMessage();
    if (limitExceededMessage) {
      spanTree.push({type: SpanTreeNodeType.MESSAGE, element: limitExceededMessage});
    }

    return (
      <TraceViewContainer ref={this.props.traceViewRef}>
        <WindowScroller onScroll={this.throttledOnScroll}>
          {({height, isScrolling, onChildScroll, scrollTop}) => (
            <AutoSizer disableHeight>
              {({width}) => (
                <ReactVirtualizedList
                  autoHeight
                  isScrolling={isScrolling}
                  onScroll={onChildScroll}
                  scrollTop={this.props.isEmbedded ? 0 : scrollTop}
                  deferredMeasurementCache={this.cache}
                  height={height}
                  width={width}
                  rowHeight={this.cache.rowHeight}
                  rowCount={spanTree.length}
                  rowRenderer={props => this.renderRow(props, spanTree)}
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

type SpanRowProps = ListRowProps & {
  addSpanRowToState: (
    spanId: string,
    spanRow: React.RefObject<HTMLDivElement>,
    treeDepth: number
  ) => void;
  cache: CellMeasurerCache;
  removeSpanRowFromState: (spanId: string) => void;
  spanContextProps: SpanContext.SpanContextProps;
  spanTree: SpanTreeNode[];
};

function SpanRow(props: SpanRowProps) {
  const {
    index,
    parent,
    style,
    columnIndex,
    spanTree,
    cache,
    spanContextProps,
    addSpanRowToState,
    removeSpanRowFromState,
  } = props;

  const rowRef = useRef<HTMLDivElement>(null);
  const spanNode = spanTree[index]!;

  useEffect(() => {
    // Gap spans do not have IDs, so we can't really store them. This should not be a big deal, since
    // we only need to keep track of spans to calculate an average depth, a few missing spans will not
    // throw off the calculation too hard
    if (spanNode.type !== SpanTreeNodeType.MESSAGE && !isGapSpan(spanNode.props.span)) {
      addSpanRowToState(spanNode.props.span.span_id, rowRef, spanNode.props.treeDepth);
    }

    return () => {
      if (spanNode.type !== SpanTreeNodeType.MESSAGE && !isGapSpan(spanNode.props.span)) {
        removeSpanRowFromState(spanNode.props.span.span_id);
      }
    };
  }, [rowRef, spanNode, addSpanRowToState, removeSpanRowFromState]);

  const renderSpanNode = (
    node: SpanTreeNode,
    extraProps: {
      cellMeasurerCache: CellMeasurerCache;
      listRef: React.RefObject<ReactVirtualizedList>;
      measure: () => void;
    } & SpanContext.SpanContextProps
  ) => {
    switch (node.type) {
      case SpanTreeNodeType.SPAN:
        return (
          <ProfiledSpanBar
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
  };

  return (
    <CellMeasurer
      cache={cache}
      parent={parent}
      columnIndex={columnIndex}
      rowIndex={index}
    >
      {({measure}) => (
        <div style={style} ref={rowRef}>
          {renderSpanNode(spanNode, {
            measure,
            listRef,
            cellMeasurerCache: cache,
            ...spanContextProps,
          })}
        </div>
      )}
    </CellMeasurer>
  );
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

export default withProfiler(withScrollbarManager(SpanTree));
