import type {List} from 'react-virtualized';
import * as Sentry from '@sentry/react';
import {mat3, vec2} from 'gl-matrix';

import type {Client} from 'sentry/api';
import type {Organization} from 'sentry/types';
import clamp from 'sentry/utils/number/clamp';
import {lightTheme as theme} from 'sentry/utils/theme';
import {
  isAutogroupedNode,
  isMissingInstrumentationNode,
  isParentAutogroupedNode,
  isSiblingAutogroupedNode,
  isSpanNode,
  isTraceErrorNode,
  isTransactionNode,
} from 'sentry/views/performance/newTraceDetails/guards';
import {
  type TraceTree,
  TraceTreeNode,
} from 'sentry/views/performance/newTraceDetails/traceTree';

const DIVIDER_WIDTH = 6;

function easeOutSine(x: number): number {
  return Math.sin((x * Math.PI) / 2);
}

function onPreventBackForwardNavigation(event: WheelEvent) {
  if (event.deltaX !== 0) {
    event.preventDefault();
  }
}

type ViewColumn = {
  column_nodes: TraceTreeNode<TraceTree.NodeValue>[];
  column_refs: (HTMLElement | undefined)[];
  translate: [number, number];
  width: number;
};

class View {
  public x: number;
  public y: number;
  public width: number;
  public height: number;

  constructor(x: number, y: number, width: number, height: number) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  static From(view: View): View {
    return new View(view.x, view.y, view.width, view.height);
  }
  static Empty(): View {
    return new View(0, 0, 1000, 1);
  }

  serialize() {
    return [this.x, this.y, this.width, this.height];
  }

  between(to: View): mat3 {
    return mat3.fromValues(
      to.width / this.width,
      0,
      0,
      to.height / this.height,
      0,
      0,
      to.x - this.x * (to.width / this.width),
      to.y - this.y * (to.height / this.height),
      1
    );
  }

  transform(mat: mat3): [number, number, number, number] {
    const x = this.x * mat[0] + this.y * mat[3] + mat[6];
    const y = this.x * mat[1] + this.y * mat[4] + mat[7];
    const width = this.width * mat[0] + this.height * mat[3];
    const height = this.width * mat[1] + this.height * mat[4];
    return [x, y, width, height];
  }

  get center() {
    return this.x + this.width / 2;
  }

  get left() {
    return this.x;
  }
  get right() {
    return this.x + this.width;
  }
  get top() {
    return this.y;
  }
  get bottom() {
    return this.y + this.height;
  }
}

/**
 * Tracks the state of the virtualized view and manages the resizing of the columns.
 * Children components should call the appropriate register*Ref methods to register their
 * HTML elements.
 */
export class VirtualizedViewManager {
  // Represents the space of the entire trace, for example
  // a trace starting at 0 and ending at 1000 would have a space of [0, 1000]
  to_origin: number = 0;
  trace_space: View = View.Empty();
  // The view defines what the user is currently looking at, it is a subset
  // of the trace space. For example, if the user is currently looking at the
  // trace from 500 to 1000, the view would be represented by [x, width] = [500, 500]
  trace_view: View = View.Empty();
  // Represents the pixel space of the entire trace - this is the container
  // that we render to. For example, if the container is 1000px wide, the
  // pixel space would be [0, 1000]
  trace_physical_space: View = View.Empty();
  container_physical_space: View = View.Empty();

  row_measurer: DOMWidthMeasurer<TraceTreeNode<TraceTree.NodeValue>> =
    new DOMWidthMeasurer();
  indicator_label_measurer: DOMWidthMeasurer<TraceTree['indicators'][0]> =
    new DOMWidthMeasurer();
  text_measurer: TextMeasurer = new TextMeasurer();

  resize_observer: ResizeObserver | null = null;
  list: List | null = null;

  // HTML refs that we need to keep track of such
  // that rendering can be done programmatically
  divider: HTMLElement | null = null;
  container: HTMLElement | null = null;
  indicator_container: HTMLElement | null = null;

  indicators: ({indicator: TraceTree['indicators'][0]; ref: HTMLElement} | undefined)[] =
    [];
  span_bars: ({ref: HTMLElement; space: [number, number]} | undefined)[] = [];
  span_text: ({ref: HTMLElement; space: [number, number]; text: string} | undefined)[] =
    [];

  // Holds the span to px matrix so we dont keep recalculating it
  span_to_px: mat3 = mat3.create();
  row_depth_padding: number = 22;

  // Column configuration
  columns: {
    list: ViewColumn;
    span_list: ViewColumn;
  };

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

    this.onDividerMouseDown = this.onDividerMouseDown.bind(this);
    this.onDividerMouseUp = this.onDividerMouseUp.bind(this);
    this.onDividerMouseMove = this.onDividerMouseMove.bind(this);
    this.onSyncedScrollbarScroll = this.onSyncedScrollbarScroll.bind(this);
    this.onWheelZoom = this.onWheelZoom.bind(this);
  }

  initializeTraceSpace(space: [x: number, y: number, width: number, height: number]) {
    this.to_origin = space[0];

    this.trace_space = new View(0, 0, space[2], space[3]);
    this.trace_view = new View(0, 0, space[2], space[3]);

    this.recomputeSpanToPxMatrix();
  }

  initializePhysicalSpace(width: number, height: number) {
    this.container_physical_space = new View(0, 0, width, height);
    this.trace_physical_space = new View(
      0,
      0,
      width * this.columns.span_list.width,
      height
    );

    this.recomputeSpanToPxMatrix();
  }

  onContainerRef(container: HTMLElement | null) {
    if (container) {
      this.initialize(container);
    } else {
      this.teardown();
    }
  }

  dividerStartVec: [number, number] | null = null;
  previousDividerClientVec: [number, number] | null = null;
  onDividerMouseDown(event: MouseEvent) {
    if (!this.container) {
      return;
    }

    this.dividerStartVec = [event.clientX, event.clientY];
    this.previousDividerClientVec = [event.clientX, event.clientY];
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
    const distancePercentage = distance / this.container_physical_space.width;

    this.columns.list.width = this.columns.list.width + distancePercentage;
    this.columns.span_list.width = this.columns.span_list.width - distancePercentage;

    this.container.style.userSelect = 'auto';

    this.dividerStartVec = null;
    this.previousDividerClientVec = null;

    this.container.removeEventListener('mouseup', this.onDividerMouseUp);
    this.container.removeEventListener('mousemove', this.onDividerMouseMove);
  }

  onDividerMouseMove(event: MouseEvent) {
    if (!this.dividerStartVec || !this.divider || !this.previousDividerClientVec) {
      return;
    }

    const distance = event.clientX - this.dividerStartVec[0];
    const distancePercentage = distance / this.container_physical_space.width;

    this.trace_physical_space.width =
      (this.columns.span_list.width - distancePercentage) *
      this.container_physical_space.width;

    const physical_distance = this.previousDividerClientVec[0] - event.clientX;
    const config_distance_pct = physical_distance / this.trace_physical_space.width;
    const config_distance = this.trace_view.width * config_distance_pct;

    this.setTraceView({
      x: this.trace_view.x - config_distance,
      width: this.trace_view.width + config_distance,
    });

    this.draw({
      list: this.columns.list.width + distancePercentage,
      span_list: this.columns.span_list.width - distancePercentage,
    });

    this.previousDividerClientVec = [event.clientX, event.clientY];
  }

  registerList(list: List | null) {
    this.list = list;
  }

  registerIndicatorContainerRef(ref: HTMLElement | null) {
    if (ref) {
      ref.style.width = this.columns.span_list.width * 100 + '%';
    }
    this.indicator_container = ref;
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
    ref.addEventListener('mousedown', this.onDividerMouseDown, {passive: true});
  }

  registerSpanBarRef(ref: HTMLElement | null, space: [number, number], index: number) {
    this.span_bars[index] = ref ? {ref, space} : undefined;
  }

  registerSpanBarTextRef(
    ref: HTMLElement | null,
    text: string,
    space: [number, number],
    index: number
  ) {
    this.span_text[index] = ref ? {ref, text, space} : undefined;
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
          this.row_measurer.measure(node, scrollableElement as HTMLElement);
          ref.addEventListener('wheel', this.onSyncedScrollbarScroll, {passive: true});
        }
      }
    }

    if (column === 'span_list') {
      const element = this.columns[column].column_refs[index];
      if (ref === undefined && element) {
        element.removeEventListener('wheel', this.onWheelZoom);
      } else if (ref) {
        ref.addEventListener('wheel', this.onWheelZoom, {passive: false});
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
      const element = this.indicators[index]?.ref;
      if (element) {
        element.removeEventListener('wheel', this.onWheelZoom);
      }
      this.indicators[index] = undefined;
    } else {
      this.indicators[index] = {ref, indicator};
    }

    if (ref) {
      const label = ref.children[0] as HTMLElement | undefined;
      if (label) {
        this.indicator_label_measurer.measure(indicator, label);
      }

      ref.addEventListener('wheel', this.onWheelZoom, {passive: false});
      ref.style.transform = `translateX(${this.computeTransformXFromTimestamp(
        indicator.start
      )}px)`;
    }
  }

  getConfigSpaceCursor(cursor: {x: number; y: number}): [number, number] {
    const left_percentage = cursor.x / this.trace_physical_space.width;
    const left_view = left_percentage * this.trace_view.width;

    return [this.trace_view.x + left_view, 0];
  }

  onWheelZoom(event: WheelEvent) {
    if (event.metaKey) {
      event.preventDefault();

      if (!this.onWheelEndRaf) {
        this.onWheelStart();
        this.enqueueOnWheelEndRaf();
        return;
      }

      const scale = 1 - event.deltaY * 0.01 * -1;
      const configSpaceCursor = this.getConfigSpaceCursor({
        x: event.offsetX,
        y: event.offsetY,
      });

      const center = vec2.fromValues(configSpaceCursor[0], 0);
      const centerScaleMatrix = mat3.create();

      mat3.fromTranslation(centerScaleMatrix, center);
      mat3.scale(centerScaleMatrix, centerScaleMatrix, vec2.fromValues(scale, 1));
      mat3.translate(
        centerScaleMatrix,
        centerScaleMatrix,
        vec2.fromValues(-center[0], 0)
      );

      const newView = this.trace_view.transform(centerScaleMatrix);
      this.setTraceView({
        x: newView[0],
        width: newView[2],
      });
      this.draw();
    } else {
      const physical_delta_pct = event.deltaX / this.trace_physical_space.width;
      const view_delta = physical_delta_pct * this.trace_view.width;
      this.setTraceView({
        x: this.trace_view.x + view_delta,
      });
      this.draw();
    }
  }

  zoomIntoSpaceRaf: number | null = null;
  onZoomIntoSpace(space: [number, number]) {
    const distance_x = space[0] - this.to_origin - this.trace_view.x;
    const distance_width = this.trace_view.width - space[1];

    const start_x = this.trace_view.x;
    const start_width = this.trace_view.width;

    const start = performance.now();
    const rafCallback = (now: number) => {
      const elapsed = now - start;
      const progress = elapsed / 300;

      const eased = easeOutSine(progress);

      const x = start_x + distance_x * eased;
      const width = start_width - distance_width * eased;

      this.setTraceView({x, width});
      this.draw();

      if (progress < 1) {
        this.zoomIntoSpaceRaf = window.requestAnimationFrame(rafCallback);
      } else {
        this.zoomIntoSpaceRaf = null;
        this.setTraceView({x: space[0] - this.to_origin, width: space[1]});
        this.draw();
      }
    };

    this.zoomIntoSpaceRaf = window.requestAnimationFrame(rafCallback);
  }

  onWheelEndRaf: number | null = null;
  enqueueOnWheelEndRaf() {
    if (this.onWheelEndRaf !== null) {
      window.cancelAnimationFrame(this.onWheelEndRaf);
    }

    const start = performance.now();
    const rafCallback = (now: number) => {
      const elapsed = now - start;
      if (elapsed > 150) {
        this.onWheelEnd();
      } else {
        this.onWheelEndRaf = window.requestAnimationFrame(rafCallback);
      }
    };

    this.onWheelEndRaf = window.requestAnimationFrame(rafCallback);
  }

  onWheelStart() {
    for (let i = 0; i < this.columns.span_list.column_refs.length; i++) {
      const span_list = this.columns.span_list.column_refs[i];
      if (span_list?.children?.[0]) {
        (span_list.children[0] as HTMLElement).style.pointerEvents = 'none';
      }
      const span_text = this.span_text[i];
      if (span_text) {
        span_text.ref.style.pointerEvents = 'none';
      }
    }

    for (let i = 0; i < this.indicators.length; i++) {
      const indicator = this.indicators[i];
      if (indicator?.ref) {
        indicator.ref.style.pointerEvents = 'none';
      }
    }
  }

  onWheelEnd() {
    this.onWheelEndRaf = null;

    for (let i = 0; i < this.columns.span_list.column_refs.length; i++) {
      const span_list = this.columns.span_list.column_refs[i];
      if (span_list?.children?.[0]) {
        (span_list.children[0] as HTMLElement).style.pointerEvents = 'auto';
      }
      const span_text = this.span_text[i];
      if (span_text) {
        span_text.ref.style.pointerEvents = 'auto';
      }
    }
    for (let i = 0; i < this.indicators.length; i++) {
      const indicator = this.indicators[i];
      if (indicator?.ref) {
        indicator.ref.style.pointerEvents = 'auto';
      }
    }
  }

  setTraceView(view: {width?: number; x?: number}) {
    const x = view.x ?? this.trace_view.x;
    const width = view.width ?? this.trace_view.width;

    this.trace_view.x = clamp(x, 0, this.trace_space.width - width);
    this.trace_view.width = clamp(width, 0, this.trace_space.width - this.trace_view.x);
    this.recomputeSpanToPxMatrix();
  }

  scrollSyncRaf: number | null = null;
  onSyncedScrollbarScroll(event: WheelEvent) {
    if (this.bringRowIntoViewAnimation !== null) {
      window.cancelAnimationFrame(this.bringRowIntoViewAnimation);
      this.bringRowIntoViewAnimation = null;
    }

    this.enqueueOnScrollEndOutOfBoundsCheck();
    const columnWidth = this.columns.list.width * this.container_physical_space.width;

    this.columns.list.translate[0] = clamp(
      this.columns.list.translate[0] - event.deltaX,
      -(this.row_measurer.max - columnWidth + 16), // 16px margin so we dont scroll right to the last px
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

    const offset = this.list?.Grid?.props.overscanRowCount ?? 0;
    const renderCount = this.columns.span_list.column_refs.length;

    for (let i = offset + 1; i < renderCount - offset; i++) {
      const width = this.row_measurer.cache.get(this.columns.list.column_nodes[i]);
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
        translation + innerMostNode.depth * this.row_depth_padding >
        this.columns.list.width * this.container_physical_space.width
      ) {
        this.scrollRowIntoViewHorizontally(innerMostNode);
      }
    }
  }

  scrollRowIntoViewHorizontally(node: TraceTreeNode<any>, duration: number = 600) {
    const VISUAL_OFFSET = this.row_depth_padding / 2;
    const target = Math.min(-node.depth * this.row_depth_padding + VISUAL_OFFSET, 0);
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
      const eased = easeOutSine(progress);

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
    if (this.container !== container && this.resize_observer !== null) {
      this.teardown();
    }

    this.container = container;
    this.container.addEventListener('wheel', onPreventBackForwardNavigation, {
      passive: false,
    });

    this.resize_observer = new ResizeObserver(entries => {
      const entry = entries[0];
      if (!entry) {
        throw new Error('ResizeObserver entry is undefined');
      }

      this.initializePhysicalSpace(entry.contentRect.width, entry.contentRect.height);
      this.draw();
    });

    this.resize_observer.observe(container);
  }

  recomputeSpanToPxMatrix() {
    const traceViewToSpace = this.trace_space.between(this.trace_view);
    const tracePhysicalToView = this.trace_physical_space.between(this.trace_space);
    this.span_to_px = mat3.multiply(
      this.span_to_px,
      traceViewToSpace,
      tracePhysicalToView
    );
  }

  readonly span_matrix: [number, number, number, number, number, number] = [
    1, 0, 0, 1, 0, 0,
  ];
  computeSpanCSSMatrixTransform(
    space: [number, number]
  ): [number, number, number, number, number, number] {
    const scale = space[1] / this.trace_view.width;

    this.span_matrix[0] = Math.max(
      scale,
      (1 * this.span_to_px[0]) / this.trace_view.width
    );
    this.span_matrix[3] = 1;
    this.span_matrix[4] =
      (space[0] - this.to_origin) / this.span_to_px[0] -
      this.trace_view.x / this.span_to_px[0];

    return this.span_matrix;
  }

  scrollToPath(
    tree: TraceTree,
    scrollQueue: TraceTree.NodePath[],
    rerender: () => void,
    {api, organization}: {api: Client; organization: Organization}
  ): Promise<{index: number; node: TraceTreeNode<TraceTree.NodeValue>} | null | null> {
    const segments = [...scrollQueue];
    const list = this.list;

    if (!list) {
      return Promise.resolve(null);
    }

    if (segments.length === 1 && segments[0] === 'trace:root') {
      rerender();
      list.scrollToRow(0);
      return Promise.resolve({index: 0, node: tree.root.children[0]});
    }

    // Keep parent reference as we traverse the tree so that we can only
    // perform searching in the current level and not the entire tree
    let parent: TraceTreeNode<TraceTree.NodeValue> = tree.root;

    const scrollToRow = async (): Promise<{
      index: number;
      node: TraceTreeNode<TraceTree.NodeValue>;
    } | null | null> => {
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
        if (
          nextSegment?.startsWith('span:') ||
          nextSegment?.startsWith('ag:') ||
          nextSegment?.startsWith('ms:')
        ) {
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
      list.scrollToRow(index);
      return {index, node: current};
    };

    return scrollToRow();
  }

  computeTransformXFromTimestamp(timestamp: number): number {
    return (timestamp - this.to_origin - this.trace_view.x) / this.span_to_px[0];
  }

  computeSpanTextPlacement(span_space: [number, number], text: string): [number, number] {
    const TEXT_PADDING = 2;
    const anchor_left = span_space[0] > this.to_origin + this.trace_space.width * 0.8;

    const width = this.text_measurer.measure(text);

    // precomput all anchor points aot, so we make the control flow more readable.
    // this wastes some cycles, but it's not a big deal as computers are fast when
    // it comes to simple arithmetic.
    const right_outside =
      this.computeTransformXFromTimestamp(span_space[0] + span_space[1]) + TEXT_PADDING;
    const right_inside =
      this.computeTransformXFromTimestamp(span_space[0] + span_space[1]) -
      width -
      TEXT_PADDING;
    const left_outside =
      this.computeTransformXFromTimestamp(span_space[0]) - TEXT_PADDING - width;
    const left_inside = this.computeTransformXFromTimestamp(span_space[0]) + TEXT_PADDING;
    const window_right =
      this.computeTransformXFromTimestamp(
        this.to_origin + this.trace_view.left + this.trace_view.width
      ) -
      width -
      TEXT_PADDING;
    const window_left =
      this.computeTransformXFromTimestamp(this.to_origin + this.trace_view.left) +
      TEXT_PADDING;

    const view_left = this.trace_view.x;
    const view_right = view_left + this.trace_view.width;

    const span_left = span_space[0] - this.to_origin;
    const span_right = span_left + span_space[1];

    const space_right = view_right - span_right;
    const space_left = span_left - view_left;

    // Span is completely outside of the view on the left side
    if (span_right < this.trace_view.x) {
      return anchor_left ? [1, right_inside] : [0, right_outside];
    }

    // Span is completely outside of the view on the right side
    if (span_left > this.trace_view.right) {
      return anchor_left ? [0, left_outside] : [1, left_inside];
    }

    // Span "spans" the entire view
    if (span_left <= this.trace_view.x && span_right >= this.trace_view.right) {
      return anchor_left ? [1, window_left] : [1, window_right];
    }

    const full_span_px_width = span_space[1] / this.span_to_px[0];

    if (anchor_left) {
      // While we have space on the left, place the text there
      if (space_left > 0) {
        return [0, left_outside];
      }

      const distance = span_right - this.trace_view.left;
      const visible_width = distance / this.span_to_px[0] - TEXT_PADDING;

      // If the text fits inside the visible portion of the span, anchor it to the left
      // side of the window so that it is visible while the user pans the view
      if (visible_width - TEXT_PADDING >= width) {
        return [1, window_left];
      }

      // If the text doesnt fit inside the visible portion of the span,
      // anchor it to the inside right place in the span.
      return [1, right_inside];
    }
    // While we have space on the right, place the text there
    if (space_right > 0) {
      return [0, right_outside];
    }

    // If text fits inside the span
    if (full_span_px_width > width) {
      const distance = span_right - this.trace_view.right;
      const visible_width =
        (span_space[1] - distance) / this.span_to_px[0] - TEXT_PADDING;

      // If the text fits inside the visible portion of the span, anchor it to the right
      // side of the window so that it is visible while the user pans the view
      if (visible_width - TEXT_PADDING >= width) {
        return [1, window_right];
      }

      // If the text doesnt fit inside the visible portion of the span,
      // anchor it to the inside left of the span
      return [1, left_inside];
    }
    return [0, right_outside];
  }

  draw(options: {list?: number; span_list?: number} = {}) {
    const list_width = options.list ?? this.columns.list.width;
    const span_list_width = options.span_list ?? this.columns.span_list.width;

    if (this.divider) {
      this.divider.style.transform = `translateX(${
        list_width * this.container_physical_space.width - DIVIDER_WIDTH / 2 - 1
      }px)`;
    }
    if (this.indicator_container) {
      this.indicator_container.style.width = span_list_width * 100 + '%';
    }

    const listWidth = list_width * 100 + '%';
    const spanWidth = span_list_width * 100 + '%';

    // JavaScript "arrays" are nice in the sense that they are really just dicts,
    // allowing us to store negative indices. This sometimes happens as the list
    // virtualizes the rows and we end up with a negative index as they are being
    // rendered off screen.
    for (let i = 0; i < this.columns.list.column_refs.length; i++) {
      while (this.span_bars[i] === undefined && i < this.columns.list.column_refs.length)
        i++;

      const list = this.columns.list.column_refs[i];
      if (list) list.style.width = listWidth;
      const span = this.columns.span_list.column_refs[i];
      if (span) span.style.width = spanWidth;

      const span_bar = this.span_bars[i];
      if (span_bar) {
        const span_transform = this.computeSpanCSSMatrixTransform(span_bar.space);
        span_bar.ref.style.transform = `matrix(${span_transform.join(',')}`;
      }
      const span_text = this.span_text[i];
      if (span_text) {
        const [inside, text_transform] = this.computeSpanTextPlacement(
          span_text.space,
          span_text.text
        );

        if (text_transform === null) {
          continue;
        }

        span_text.ref.style.color = inside ? 'white' : '';
        span_text.ref.style.transform = `translateX(${text_transform}px)`;
      }
    }

    let start_indicator = 0;
    let end_indicator = this.indicators.length;

    while (start_indicator < this.indicators.length - 1) {
      const indicator = this.indicators[start_indicator];
      if (!indicator?.indicator) {
        start_indicator++;
        continue;
      }

      if (indicator.indicator.start < this.to_origin + this.trace_view.left) {
        start_indicator++;
        continue;
      }

      break;
    }

    while (end_indicator > start_indicator) {
      const last_indicator = this.indicators[end_indicator - 1];
      if (!last_indicator) {
        end_indicator--;
        continue;
      }
      if (last_indicator.indicator.start > this.to_origin + this.trace_view.right) {
        end_indicator--;
        continue;
      }
      break;
    }

    start_indicator = Math.max(0, start_indicator - 1);
    end_indicator = Math.min(this.indicators.length - 1, end_indicator);

    for (let i = 0; i < this.indicators.length; i++) {
      const entry = this.indicators[i];
      if (!entry) {
        continue;
      }

      if (i < start_indicator || i > end_indicator) {
        entry.ref.style.opacity = '0';
        continue;
      }

      const transform = this.computeTransformXFromTimestamp(entry.indicator.start);
      const label = entry.ref.children[0] as HTMLElement | undefined;

      const indicator_max = this.trace_physical_space.width + 1;
      const indicator_min = -1;

      const label_width = this.indicator_label_measurer.cache.get(entry.indicator);
      const clamped_transform = clamp(transform, -1, indicator_max);

      if (label_width === undefined) {
        entry.ref.style.transform = `translate(${clamp(transform, indicator_min, indicator_max)}px, 0)`;
        continue;
      }

      if (label) {
        const PADDING = 2;
        const label_window_left = PADDING;
        const label_window_right = -label_width - PADDING;

        if (transform < -1) {
          label.style.transform = `translateX(${label_window_left}px)`;
        } else if (transform >= indicator_max) {
          label.style.transform = `translateX(${label_window_right}px)`;
        } else {
          const space_left = transform - PADDING - label_width / 2;
          const space_right = transform + label_width / 2;

          if (space_left < 0) {
            const left = -label_width / 2 + Math.abs(space_left);
            label.style.transform = `translateX(${left - 1}px)`;
          } else if (space_right > this.trace_physical_space.width) {
            const right =
              -label_width / 2 - (space_right - this.trace_physical_space.width) - 1;
            label.style.transform = `translateX(${right}px)`;
          } else {
            label.style.transform = `translateX(${-label_width / 2}px)`;
          }
        }
      }

      entry.ref.style.opacity = '1';
      entry.ref.style.zIndex = i === start_indicator || i === end_indicator ? '1' : '2';
      entry.ref.style.transform = `translate(${clamped_transform}px, 0)`;
    }
  }

  teardown() {
    if (this.container) {
      this.container.removeEventListener('wheel', onPreventBackForwardNavigation);
    }
    if (this.resize_observer) {
      this.resize_observer.disconnect();
    }
  }
}

// The backing cache should be a proper LRU cache,
// so we dont end up storing an infinite amount of elements
class DOMWidthMeasurer<T> {
  cache: Map<T, number> = new Map();
  elements: HTMLElement[] = [];

  queue: [T, HTMLElement][] = [];
  drainRaf: number | null = null;
  max: number = 0;

  constructor() {
    this.drain = this.drain.bind(this);
  }

  enqueueMeasure(node: T, element: HTMLElement) {
    if (this.cache.has(node)) {
      return;
    }

    this.queue.push([node, element]);

    if (this.drainRaf !== null) {
      window.cancelAnimationFrame(this.drainRaf);
    }
    this.drainRaf = window.requestAnimationFrame(this.drain);
  }

  drain() {
    for (const [node, element] of this.queue) {
      this.measure(node, element);
    }
  }

  measure(node: T, element: HTMLElement): number {
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

// The backing cache should be a proper LRU cache,
// so we dont end up storing an infinite amount of elements
class TextMeasurer {
  queue: string[] = [];
  drainRaf: number | null = null;
  cache: Map<string, number> = new Map();

  ctx: CanvasRenderingContext2D;

  number: number = 0;
  dot: number = 0;
  duration: Record<string, number> = {};

  constructor() {
    this.drain = this.drain.bind(this);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Canvas 2d context is not available');
    }

    canvas.width = 50 * window.devicePixelRatio ?? 1;
    canvas.height = 50 * window.devicePixelRatio ?? 1;
    this.ctx = ctx;

    ctx.font = '11px' + theme.text.family;

    this.dot = this.ctx.measureText('.').width;
    for (let i = 0; i < 10; i++) {
      const measurement = this.ctx.measureText(i.toString());
      this.number = Math.max(this.number, measurement.width);
    }

    for (const duration of ['ns', 'ms', 's', 'm', 'h', 'd']) {
      this.duration[duration] = this.ctx.measureText(duration).width;
    }
  }

  drain() {
    for (const string of this.queue) {
      this.measure(string);
    }
  }

  computeStringLength(string: string): number {
    let width = 0;
    for (let i = 0; i < string.length; i++) {
      switch (string[i]) {
        case '.':
          width += this.dot;
          break;
        case '0':
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
          width += this.number;
          break;
        default:
          const remaining = string.slice(i);
          if (this.duration[remaining]) {
            width += this.duration[remaining];
            return width;
          }
      }
    }
    return width;
  }

  measure(string: string): number {
    const cached_width = this.cache.get(string);
    if (cached_width !== undefined) {
      return cached_width;
    }

    const width = this.computeStringLength(string);
    this.cache.set(string, width);
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

    if (type === 'ms' && isMissingInstrumentationNode(node)) {
      return node.previous.value.span_id === id || node.next.value.span_id === id;
    }

    if (type === 'error' && isTraceErrorNode(node)) {
      return node.value.event_id === id;
    }

    return false;
  });
}
