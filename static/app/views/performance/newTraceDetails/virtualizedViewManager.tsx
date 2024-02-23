import type {List} from 'react-virtualized';
import * as Sentry from '@sentry/react';

import type {Client} from 'sentry/api';
import type {Organization} from 'sentry/types';
import clamp from 'sentry/utils/number/clamp';
import {
  isAutogroupedNode,
  isParentAutogroupedNode,
  isSiblingAutogroupedNode,
  isSpanNode,
  isTransactionNode,
} from 'sentry/views/performance/newTraceDetails/guards';
import {
  type TraceTree,
  TraceTreeNode,
} from 'sentry/views/performance/newTraceDetails/traceTree';

const DIVIDER_WIDTH = 6;

type ViewColumn = {
  column_nodes: TraceTreeNode<TraceTree.NodeValue>[];
  column_refs: (HTMLElement | undefined)[];
  translate: [number, number];
  width: number;
};

type Matrix2D = [number, number, number, number, number, number];

/**
 * Tracks the state of the virtualized view and manages the resizing of the columns.
 * Children components should call `registerColumnRef` and `registerDividerRef` to register
 * their respective refs.
 */
export class VirtualizedViewManager {
  width: number = 0;
  virtualizedList: List | null = null;

  container: HTMLElement | null = null;
  divider: HTMLElement | null = null;
  resizeObserver: ResizeObserver | null = null;

  dividerStartVec: [number, number] | null = null;
  measurer: RowMeasurer = new RowMeasurer();

  spanDrawMatrix: Matrix2D = [1, 0, 0, 1, 0, 0];
  spanScalingFactor: number = 1;
  minSpanScalingFactor: number = 0.02;

  spanSpace: [number, number] = [0, 1000];
  spanView: [number, number] = [0, 1000];

  columns: {
    list: ViewColumn;
    span_list: ViewColumn;
  };

  indicators: ({indicator: TraceTree['indicators'][0]; ref: HTMLElement} | undefined)[] =
    [];
  span_bars: ({ref: HTMLElement; space: [number, number]} | undefined)[] = [];

  constructor(columns: {
    list: Pick<ViewColumn, 'width'>;
    span_list: Pick<ViewColumn, 'width'>;
  }) {
    this.columns = {
      list: {...columns.list, column_nodes: [], column_refs: [], translate: [0, 0]},
      span_list: {
        ...columns.span_list,
        column_nodes: [],
        column_refs: [],
        translate: [0, 0],
      },
    };

    this.onSyncedScrollbarScroll = this.onSyncedScrollbarScroll.bind(this);
    this.onDividerMouseDown = this.onDividerMouseDown.bind(this);
    this.onDividerMouseUp = this.onDividerMouseUp.bind(this);
    this.onDividerMouseMove = this.onDividerMouseMove.bind(this);
  }

  onContainerRef(container: HTMLElement | null) {
    if (container) {
      this.initialize(container);
    } else {
      this.teardown();
    }
  }

  onDividerMouseDown(event: MouseEvent) {
    if (!this.container) {
      return;
    }

    this.dividerStartVec = [event.clientX, event.clientY];
    this.container.style.userSelect = 'none';

    this.container.addEventListener('mouseup', this.onDividerMouseUp, {passive: true});
    this.container.addEventListener('mousemove', this.onDividerMouseMove, {
      passive: true,
    });
  }

  onDividerMouseUp(event: MouseEvent) {
    if (!this.container || !this.dividerStartVec) {
      return;
    }

    const distance = event.clientX - this.dividerStartVec[0];
    const distancePercentage = distance / this.width;

    this.columns.list.width = this.columns.list.width + distancePercentage;
    this.columns.span_list.width = this.columns.span_list.width - distancePercentage;

    this.container.style.userSelect = 'auto';
    this.dividerStartVec = null;

    this.container.removeEventListener('mouseup', this.onDividerMouseUp);
    this.container.removeEventListener('mousemove', this.onDividerMouseMove);
  }

  onDividerMouseMove(event: MouseEvent) {
    if (!this.dividerStartVec || !this.divider) {
      return;
    }

    const distance = event.clientX - this.dividerStartVec[0];
    const distancePercentage = distance / this.width;

    this.computeSpanDrawMatrix(
      this.width,
      this.columns.span_list.width - distancePercentage
    );

    this.divider.style.transform = `translateX(${
      this.width * (this.columns.list.width + distancePercentage) - DIVIDER_WIDTH / 2
    }px)`;

    const listWidth = this.columns.list.width * 100 + distancePercentage * 100 + '%';
    const spanWidth = this.columns.span_list.width * 100 - distancePercentage * 100 + '%';

    for (let i = 0; i < this.columns.list.column_refs.length; i++) {
      const list = this.columns.list.column_refs[i];
      if (list) {
        list.style.width = listWidth;
      }
      const span = this.columns.span_list.column_refs[i];
      if (span) {
        span.style.width = spanWidth;
      }
      const span_bar = this.span_bars[i];
      if (span_bar) {
        span_bar.ref.style.transform = `matrix(${this.computeSpanMatrixTransform(
          span_bar.space
        ).join(',')}`;
      }
    }

    for (let i = 0; i < this.indicators.length; i++) {
      const entry = this.indicators[i];
      if (!entry) {
        continue;
      }
      entry.ref.style.left = listWidth;
      entry.ref.style.transform = `translateX(${this.computeTransformXFromTimestamp(
        entry.indicator.start
      )}px)`;
    }
  }

  registerVirtualizedList(list: List | null) {
    this.virtualizedList = list;
  }

  registerDividerRef(ref: HTMLElement | null) {
    if (!ref) {
      if (this.divider) {
        this.divider.removeEventListener('mousedown', this.onDividerMouseDown);
      }
      this.divider = null;
      return;
    }

    this.divider = ref;
    this.divider.style.width = `${DIVIDER_WIDTH}px`;
    this.divider.style.transform = `translateX(${
      this.width * (this.columns.list.width - (2 * DIVIDER_WIDTH) / this.width)
    }px)`;

    ref.addEventListener('mousedown', this.onDividerMouseDown, {passive: true});
  }

  registerSpanBarRef(ref: HTMLElement | null, space: [number, number], index: number) {
    this.span_bars[index] = ref ? {ref, space} : undefined;
  }

  registerColumnRef(
    column: string,
    ref: HTMLElement | null,
    index: number,
    node: TraceTreeNode<any>
  ) {
    if (!this.columns[column]) {
      throw new TypeError('Invalid column');
    }

    if (typeof index !== 'number' || isNaN(index)) {
      throw new TypeError('Invalid index');
    }

    if (column === 'list') {
      const element = this.columns[column].column_refs[index];
      if (ref === undefined && element) {
        element.removeEventListener('wheel', this.onSyncedScrollbarScroll);
      } else if (ref) {
        const scrollableElement = ref.children[0];
        if (scrollableElement) {
          this.measurer.measure(node, scrollableElement as HTMLElement);
          ref.addEventListener('wheel', this.onSyncedScrollbarScroll, {passive: true});
        }
      }
    }

    this.columns[column].column_refs[index] = ref ?? undefined;
    this.columns[column].column_nodes[index] = node ?? undefined;
  }

  registerIndicatorRef(
    ref: HTMLElement | null,
    index: number,
    indicator: TraceTree['indicators'][0]
  ) {
    if (!ref) {
      this.indicators[index] = undefined;
    } else {
      this.indicators[index] = {ref, indicator};
    }

    if (ref) {
      ref.style.left = this.columns.list.width * 100 + '%';
      ref.style.transform = `translateX(${this.computeTransformXFromTimestamp(
        indicator.start
      )}px)`;
    }
  }

  scrollSyncRaf: number | null = null;
  onSyncedScrollbarScroll(event: WheelEvent) {
    if (this.bringRowIntoViewAnimation !== null) {
      window.cancelAnimationFrame(this.bringRowIntoViewAnimation);
      this.bringRowIntoViewAnimation = null;
    }

    this.enqueueOnScrollEndOutOfBoundsCheck();
    const columnWidth = this.columns.list.width * this.width;

    this.columns.list.translate[0] = clamp(
      this.columns.list.translate[0] - event.deltaX,
      -(this.measurer.max - columnWidth + 16), // 16px margin so we dont scroll right to the last px
      0
    );

    for (let i = 0; i < this.columns.list.column_refs.length; i++) {
      const list = this.columns.list.column_refs[i];
      if (list?.children?.[0]) {
        (list.children[0] as HTMLElement).style.transform =
          `translateX(${this.columns.list.translate[0]}px)`;
      }
    }

    // Eventually sync the column translation to the container
    if (this.scrollSyncRaf) {
      window.cancelAnimationFrame(this.scrollSyncRaf);
    }
    this.scrollSyncRaf = window.requestAnimationFrame(() => {
      // @TODO if user is outside of the container, scroll the container to the left
      this.container?.style.setProperty(
        '--column-translate-x',
        this.columns.list.translate[0] + 'px'
      );
    });
  }

  scrollEndSyncRaf: number | null = null;
  enqueueOnScrollEndOutOfBoundsCheck() {
    if (this.scrollEndSyncRaf !== null) {
      window.cancelAnimationFrame(this.scrollEndSyncRaf);
    }

    const start = performance.now();
    const rafCallback = (now: number) => {
      const elapsed = now - start;
      if (elapsed > 300) {
        this.onScrollEndOutOfBoundsCheck();
      } else {
        this.scrollEndSyncRaf = window.requestAnimationFrame(rafCallback);
      }
    };

    this.scrollEndSyncRaf = window.requestAnimationFrame(rafCallback);
  }

  onScrollEndOutOfBoundsCheck() {
    this.scrollEndSyncRaf = null;

    const translation = this.columns.list.translate[0];
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    let innerMostNode: TraceTreeNode<any> | undefined;

    const offset = this.virtualizedList?.Grid?.props.overscanRowCount ?? 0;
    const renderCount = this.columns.span_list.column_refs.length;

    for (let i = offset + 1; i < renderCount - offset; i++) {
      const width = this.measurer.cache.get(this.columns.list.column_nodes[i]);
      if (width === undefined) {
        // this is unlikely to happen, but we should trigger a sync measure event if it does
        continue;
      }

      min = Math.min(min, width);
      max = Math.max(max, width);
      innerMostNode =
        !innerMostNode || this.columns.list.column_nodes[i].depth < innerMostNode.depth
          ? this.columns.list.column_nodes[i]
          : innerMostNode;
    }

    if (innerMostNode) {
      if (translation + max < 0) {
        this.scrollRowIntoViewHorizontally(innerMostNode);
      } else if (
        translation + innerMostNode.depth * 24 >
        this.columns.list.width * this.width
      ) {
        this.scrollRowIntoViewHorizontally(innerMostNode);
      }
    }
  }

  scrollRowIntoViewHorizontally(node: TraceTreeNode<any>, duration: number = 600) {
    const VISUAL_OFFSET = 24 / 2;
    const target = Math.min(-node.depth * 24 + VISUAL_OFFSET, 0);
    this.animateScrollColumnTo(target, duration);
  }

  bringRowIntoViewAnimation: number | null = null;
  animateScrollColumnTo(x: number, duration: number) {
    const start = performance.now();

    const startPosition = this.columns.list.translate[0];
    const distance = x - startPosition;

    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = duration > 0 ? elapsed / duration : 1;
      const eased = easeOutQuad(progress);

      const pos = startPosition + distance * eased;

      for (let i = 0; i < this.columns.list.column_refs.length; i++) {
        const list = this.columns.list.column_refs[i];
        if (list?.children?.[0]) {
          (list.children[0] as HTMLElement).style.transform = `translateX(${pos}px)`;
        }
      }

      if (progress < 1) {
        this.columns.list.translate[0] = pos;
        this.bringRowIntoViewAnimation = window.requestAnimationFrame(animate);
      } else {
        this.columns.list.translate[0] = x;
      }
    };

    this.bringRowIntoViewAnimation = window.requestAnimationFrame(animate);
  }

  initialize(container: HTMLElement) {
    this.teardown();

    this.container = container;
    this.container.addEventListener('wheel', this.onPreventBackForwardNavigation, {
      passive: false,
    });

    this.resizeObserver = new ResizeObserver(entries => {
      const entry = entries[0];
      if (!entry) {
        throw new Error('ResizeObserver entry is undefined');
      }

      this.width = entry.contentRect.width;
      this.computeSpanDrawMatrix(this.width, this.columns.span_list.width);

      if (this.divider) {
        this.divider.style.transform = `translateX(${
          this.width * this.columns.list.width - DIVIDER_WIDTH / 2
        }px)`;
      }
    });

    this.resizeObserver.observe(container);
  }

  onPreventBackForwardNavigation(event: WheelEvent) {
    if (event.deltaX !== 0) {
      event.preventDefault();
    }
  }

  initializeSpanSpace(spanSpace: [number, number], spanView?: [number, number]) {
    this.spanSpace = [...spanSpace];
    this.spanView = spanView ?? [...spanSpace];

    this.computeSpanDrawMatrix(this.width, this.columns.span_list.width);
  }

  scrollToPath(
    tree: TraceTree,
    scrollQueue: TraceTree.NodePath[],
    rerender: () => void,
    {api, organization}: {api: Client; organization: Organization}
  ): Promise<TraceTreeNode<TraceTree.NodeValue> | null> {
    const segments = [...scrollQueue];
    const virtualizedList = this.virtualizedList;

    if (!virtualizedList) {
      return Promise.resolve(null);
    }

    // Keep parent reference as we traverse the tree so that we can only
    // perform searching in the current level and not the entire tree
    let parent: TraceTreeNode<TraceTree.NodeValue> = tree.root;

    const scrollToRow = async (): Promise<TraceTreeNode<TraceTree.NodeValue> | null> => {
      const path = segments.pop();
      const current = findInTreeFromSegment(parent, path!);

      if (!current) {
        Sentry.captureMessage('Failed to scroll to node in trace tree');
        return null;
      }

      // Reassing the parent to the current node
      parent = current;

      if (isTransactionNode(current)) {
        const nextSegment = segments[segments.length - 1];
        if (nextSegment?.startsWith('span:') || nextSegment?.startsWith('ag:')) {
          await tree.zoomIn(current, true, {
            api,
            organization,
          });
          return scrollToRow();
        }
      }

      if (isAutogroupedNode(current) && segments.length > 0) {
        tree.expand(current, true);
        return scrollToRow();
      }

      if (segments.length > 0) {
        return scrollToRow();
      }

      // We are at the last path segment (the node that the user clicked on)
      // and we should scroll the view to this node.
      const index = tree.list.findIndex(node => node === current);
      if (index === -1) {
        throw new Error("Couldn't find node in list");
      }

      rerender();
      virtualizedList.scrollToRow(index);
      return current;
    };

    return scrollToRow();
  }

  computeSpanDrawMatrix(width: number, span_column_width: number): Matrix2D {
    // https://developer.mozilla.org/en-US/docs/Web/CSS/transform-function/matrix
    const mat3: Matrix2D = [1, 0, 0, 1, 0, 0];

    if (this.spanSpace[1] === 0 || this.spanView[1] === 0) {
      return mat3;
    }

    const spanColumnWidth = width * span_column_width;
    const viewToSpace = this.spanSpace[1] / this.spanView[1];
    const physicalToView = spanColumnWidth / this.spanView[1];

    // Set X scaling factor to the ratio of the span space to the span view
    mat3[0] = viewToSpace * physicalToView;

    this.spanScalingFactor = viewToSpace;
    this.minSpanScalingFactor = window.devicePixelRatio / this.width;
    this.spanDrawMatrix = mat3;
    return mat3;
  }

  computeTransformXFromTimestamp(timestamp: number): number {
    const x = timestamp - this.spanView[0];
    const translateInPixels = x * this.spanDrawMatrix[0];
    return translateInPixels;
  }

  computeSpanTextPlacement(
    translateX: number,
    span_space: [number, number]
  ): 'left' | 'right' | 'inside left' {
    //  | <-->  |       |
    //  |       | <-->  |
    //  |  <-------->   |
    //  |       |       |
    //  |       |       |
    const half = (this.columns.span_list.width * this.width) / 2;
    const spanWidth = span_space[1] * this.spanDrawMatrix[0];

    if (translateX > half) {
      return 'left';
    }

    if (spanWidth > half) {
      return 'inside left';
    }

    return 'right';
  }

  inverseSpanScaling(span_space: [number, number]): number {
    return 1 / this.computeSpanMatrixTransform(span_space)[0];
  }

  computeSpanMatrixTransform(span_space: [number, number]): Matrix2D {
    const scale = Math.max(
      this.minSpanScalingFactor,
      (span_space[1] / this.spanView[1]) * this.spanScalingFactor
    );

    const x = span_space[0] - this.spanView[0];
    const translateInPixels = x * this.spanDrawMatrix[0];

    return [scale, 0, 0, 1, translateInPixels, 0];
  }

  teardown() {
    if (this.container) {
      this.container.removeEventListener('wheel', this.onPreventBackForwardNavigation);
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }
}

function easeOutQuad(x: number): number {
  return 1 - (1 - x) * (1 - x);
}

class RowMeasurer {
  cache: Map<TraceTreeNode<any>, number> = new Map();
  elements: HTMLElement[] = [];

  measureQueue: [TraceTreeNode<any>, HTMLElement][] = [];
  drainRaf: number | null = null;
  max: number = 0;

  constructor() {
    this.drain = this.drain.bind(this);
  }

  enqueueMeasure(node: TraceTreeNode<any>, element: HTMLElement) {
    if (this.cache.has(node)) {
      return;
    }

    this.measureQueue.push([node, element]);

    if (this.drainRaf !== null) {
      window.cancelAnimationFrame(this.drainRaf);
    }
    this.drainRaf = window.requestAnimationFrame(this.drain);
  }

  drain() {
    for (const [node, element] of this.measureQueue) {
      this.measure(node, element);
    }
  }

  measure(node: TraceTreeNode<any>, element: HTMLElement): number {
    const cache = this.cache.get(node);
    if (cache !== undefined) {
      return cache;
    }

    const width = element.getBoundingClientRect().width;
    if (width > this.max) {
      this.max = width;
    }
    this.cache.set(node, width);
    return width;
  }
}

function findInTreeFromSegment(
  start: TraceTreeNode<TraceTree.NodeValue>,
  segment: TraceTree.NodePath
): TraceTreeNode<TraceTree.NodeValue> | null {
  const [type, id] = segment.split(':');

  if (!type || !id) {
    throw new TypeError('Node path must be in the format of `type:id`');
  }

  return TraceTreeNode.Find(start, node => {
    if (type === 'txn' && isTransactionNode(node)) {
      return node.value.event_id === id;
    }

    if (type === 'span' && isSpanNode(node)) {
      return node.value.span_id === id;
    }

    if (type === 'ag' && isAutogroupedNode(node)) {
      if (isParentAutogroupedNode(node)) {
        return node.head.value.span_id === id || node.tail.value.span_id === id;
      }
      if (isSiblingAutogroupedNode(node)) {
        const child = node.children[0];
        if (isSpanNode(child)) {
          return child.value.span_id === id;
        }
      }
    }

    return false;
  });
}
