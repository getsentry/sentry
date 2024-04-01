import {useLayoutEffect, useRef, useState} from 'react';
import * as Sentry from '@sentry/react';
import {mat3, vec2} from 'gl-matrix';

import type {Client} from 'sentry/api';
import type {Organization} from 'sentry/types';
import {getDuration} from 'sentry/utils/formatters';
import clamp from 'sentry/utils/number/clamp';
import {requestAnimationTimeout} from 'sentry/utils/profiling/hooks/useVirtualizedTree/virtualizedTreeUtils';
import {lightTheme as theme} from 'sentry/utils/theme';
import {
  isAutogroupedNode,
  isMissingInstrumentationNode,
  isNoDataNode,
  isParentAutogroupedNode,
  isSiblingAutogroupedNode,
  isSpanNode,
  isTraceErrorNode,
  isTraceNode,
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

export function computeTimelineIntervals(
  view: View,
  targetInterval: number,
  results: (number | undefined)[]
): void {
  const minInterval = Math.pow(10, Math.floor(Math.log10(targetInterval)));
  let interval = minInterval;

  if (targetInterval / interval > 5) {
    interval *= 5;
  } else if (targetInterval / interval > 2) {
    interval *= 2;
  }

  let x = Math.ceil(view.x / interval) * interval;
  let idx = -1;
  if (x > 0) {
    x -= interval;
  }
  while (x <= view.right) {
    results[++idx] = x;
    x += interval;
  }

  while (idx < results.length - 1 && results[idx + 1] !== undefined) {
    results[++idx] = undefined;
  }
}

type ArgumentTypes<F> = F extends (...args: infer A) => any ? A : never;
type EventStore = {
  [K in keyof VirtualizedViewManagerEvents]: Set<VirtualizedViewManagerEvents[K]>;
};
interface VirtualizedViewManagerEvents {
  ['divider resize end']: (list_width: number) => void;
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

  events: EventStore = {
    ['divider resize end']: new Set<VirtualizedViewManagerEvents['divider resize end']>(),
  };

  row_measurer: DOMWidthMeasurer<TraceTreeNode<TraceTree.NodeValue>> =
    new DOMWidthMeasurer();
  indicator_label_measurer: DOMWidthMeasurer<TraceTree['indicators'][0]> =
    new DOMWidthMeasurer();
  text_measurer: TextMeasurer = new TextMeasurer();

  resize_observer: ResizeObserver | null = null;
  list: VirtualizedList | null = null;

  isScrolling: boolean = false;
  start_virtualized_index: number = 0;

  // HTML refs that we need to keep track of such
  // that rendering can be done programmatically
  divider: HTMLElement | null = null;
  container: HTMLElement | null = null;
  indicator_container: HTMLElement | null = null;

  intervals: (number | undefined)[] = [];
  // We want to render an indicator every 100px, but because we dont track resizing
  // of the container, we need to precompute the number of intervals we need to render.
  // We'll oversize the count by 3x, assuming no user will ever resize the window to 3x the
  // original size.
  interval_bars = new Array(Math.ceil(window.innerWidth / 100) * 3).fill(0);
  indicators: ({indicator: TraceTree['indicators'][0]; ref: HTMLElement} | undefined)[] =
    [];
  timeline_indicators: (HTMLElement | undefined)[] = [];
  span_bars: ({ref: HTMLElement; space: [number, number]} | undefined)[] = [];
  invisible_bars: ({ref: HTMLElement; space: [number, number]} | undefined)[] = [];
  span_arrows: (
    | {
        position: 0 | 1;
        ref: HTMLElement;
        space: [number, number];
        visible: boolean;
      }
    | undefined
  )[] = [];
  span_text: ({ref: HTMLElement; space: [number, number]; text: string} | undefined)[] =
    [];

  // Holds the span to px matrix so we dont keep recalculating it
  span_to_px: mat3 = mat3.create();
  row_depth_padding: number = 22;

  // Smallest of time that can be displayed across the entire view.
  private readonly MAX_ZOOM_PRECISION = 1;

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
    this.onWheelEnd = this.onWheelEnd.bind(this);
    this.onWheelStart = this.onWheelStart.bind(this);
  }

  on<K extends keyof VirtualizedViewManagerEvents>(
    eventName: K,
    cb: VirtualizedViewManagerEvents[K]
  ): void {
    const set = this.events[eventName] as unknown as Set<VirtualizedViewManagerEvents[K]>;
    if (set.has(cb)) {
      return;
    }
    set.add(cb);
  }

  off<K extends keyof VirtualizedViewManagerEvents>(
    eventName: K,
    cb: VirtualizedViewManagerEvents[K]
  ): void {
    const set = this.events[eventName] as unknown as Set<VirtualizedViewManagerEvents[K]>;

    if (set.has(cb)) {
      set.delete(cb);
    }
  }

  dispatch<K extends keyof VirtualizedViewManagerEvents>(
    event: K,
    ...args: ArgumentTypes<VirtualizedViewManagerEvents[K]>
  ): void {
    for (const handler of this.events[event]) {
      // @ts-expect-error
      handler(...args);
    }
  }

  initializeTraceSpace(space: [x: number, y: number, width: number, height: number]) {
    this.to_origin = space[0];

    this.trace_space = new View(0, 0, space[2], space[3]);
    this.trace_view = new View(0, 0, space[2], space[3]);

    this.recomputeTimelineIntervals();
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

    this.recomputeTimelineIntervals();
    this.recomputeSpanToPxMatrix();
  }

  onContainerRef(container: HTMLElement | null) {
    if (container) {
      this.initialize(container);
    } else {
      this.teardown();
    }
  }

  dividerScale: 1 | undefined = undefined;
  dividerStartVec: [number, number] | null = null;
  previousDividerClientVec: [number, number] | null = null;
  onDividerMouseDown(event: MouseEvent) {
    if (!this.container) {
      return;
    }

    this.dividerScale = this.trace_view.width === this.trace_space.width ? 1 : undefined;
    this.dividerStartVec = [event.clientX, event.clientY];
    this.previousDividerClientVec = [event.clientX, event.clientY];
    this.container.style.userSelect = 'none';

    document.addEventListener('mouseup', this.onDividerMouseUp, {passive: true});
    document.addEventListener('mousemove', this.onDividerMouseMove, {
      passive: true,
    });
  }

  onDividerMouseUp(event: MouseEvent) {
    if (!this.container || !this.dividerStartVec) {
      return;
    }

    this.dividerScale = undefined;
    const distance = event.clientX - this.dividerStartVec[0];
    const distancePercentage = distance / this.container_physical_space.width;

    this.columns.list.width = this.columns.list.width + distancePercentage;
    this.columns.span_list.width = this.columns.span_list.width - distancePercentage;

    this.container.style.userSelect = 'auto';

    this.dividerStartVec = null;
    this.previousDividerClientVec = null;

    this.enqueueOnScrollEndOutOfBoundsCheck();
    document.removeEventListener('mouseup', this.onDividerMouseUp);
    document.removeEventListener('mousemove', this.onDividerMouseMove);

    this.dispatch('divider resize end', this.columns.list.width);
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

    if (this.dividerScale) {
      // just recompute the draw matrix and let the view scale itself
      this.recomputeSpanToPxMatrix();
    } else {
      this.setTraceView({
        x: this.trace_view.x - config_distance,
        width: this.trace_view.width + config_distance,
      });
    }
    this.recomputeTimelineIntervals();
    this.draw({
      list: this.columns.list.width + distancePercentage,
      span_list: this.columns.span_list.width - distancePercentage,
    });

    this.previousDividerClientVec = [event.clientX, event.clientY];
  }

  private scrollbar_width: number = 0;
  onScrollbarWidthChange(width: number) {
    if (width === this.scrollbar_width) {
      return;
    }
    this.scrollbar_width = width;
    this.draw();
  }

  registerList(list: VirtualizedList | null) {
    this.list = list;
  }

  registerIndicatorContainerRef(ref: HTMLElement | null) {
    if (ref) {
      const correction =
        (this.scrollbar_width / this.container_physical_space.width) *
        this.columns.span_list.width;
      ref.style.transform = `translateX(${-this.scrollbar_width}px)`;
      ref.style.width = (this.columns.span_list.width - correction) * 100 + '%';
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

  registerInvisibleBarRef(
    ref: HTMLElement | null,
    space: [number, number],
    index: number
  ) {
    this.invisible_bars[index] = ref ? {ref, space} : undefined;
  }
  registerArrowRef(ref: HTMLElement | null, space: [number, number], index: number) {
    this.span_arrows[index] = ref ? {ref, space, visible: false, position: 0} : undefined;
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
    if (column === 'list') {
      const element = this.columns[column].column_refs[index];
      if (ref === undefined && element) {
        element.removeEventListener('wheel', this.onSyncedScrollbarScroll);
      } else if (ref) {
        const scrollableElement = ref.children[0] as HTMLElement | undefined;
        if (scrollableElement) {
          scrollableElement.style.transform = `translateX(${this.columns.list.translate[0]}px)`;
          this.row_measurer.enqueueMeasure(node, scrollableElement as HTMLElement);
          ref.addEventListener('wheel', this.onSyncedScrollbarScroll, {passive: false});
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
        this.indicator_label_measurer.enqueueMeasure(indicator, label);
      }

      ref.addEventListener('wheel', this.onWheelZoom, {passive: false});
      ref.style.transform = `translateX(${this.computeTransformXFromTimestamp(
        indicator.start
      )}px)`;
    }
  }

  registerTimelineIndicatorRef(ref: HTMLElement | null, index: number) {
    if (ref) {
      this.timeline_indicators[index] = ref;
    } else {
      this.timeline_indicators[index] = undefined;
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
      }
      this.enqueueOnWheelEndRaf();

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
      if (!this.onWheelEndRaf) {
        this.onWheelStart();
      }
      this.enqueueOnWheelEndRaf();
      const scrollingHorizontally = Math.abs(event.deltaX) >= Math.abs(event.deltaY);

      if (event.deltaX !== 0 && event.deltaX !== -0 && scrollingHorizontally) {
        event.preventDefault();
      }

      if (scrollingHorizontally) {
        const physical_delta_pct = event.deltaX / this.trace_physical_space.width;
        const view_delta = physical_delta_pct * this.trace_view.width;

        this.setTraceView({
          x: this.trace_view.x + view_delta,
        });
        this.draw();
      }
    }
  }

  onBringRowIntoView(space: [number, number]) {
    if (this.zoomIntoSpaceRaf !== null) {
      window.cancelAnimationFrame(this.zoomIntoSpaceRaf);
      this.zoomIntoSpaceRaf = null;
    }

    if (space[0] - this.to_origin > this.trace_view.x) {
      this.onZoomIntoSpace([
        space[0] + space[1] / 2 - this.trace_view.width / 2,
        this.trace_view.width,
      ]);
    } else if (space[0] - this.to_origin < this.trace_view.x) {
      this.onZoomIntoSpace([
        space[0] + space[1] / 2 - this.trace_view.width / 2,
        this.trace_view.width,
      ]);
    }
  }

  animateViewTo(node_space: [number, number]) {
    const start = node_space[0];
    const width = node_space[1] > 0 ? node_space[1] : this.trace_view.width;
    const margin = 0.2 * width;

    this.setTraceView({x: start - margin - this.to_origin, width: width + margin * 2});
    this.draw();
  }

  zoomIntoSpaceRaf: number | null = null;
  onZoomIntoSpace(space: [number, number]) {
    let distance_x = space[0] - this.to_origin - this.trace_view.x;
    let final_x = space[0] - this.to_origin;
    let final_width = space[1];
    const distance_width = this.trace_view.width - space[1];

    if (space[1] < this.MAX_ZOOM_PRECISION) {
      distance_x -= this.MAX_ZOOM_PRECISION / 2 - space[1] / 2;
      final_x -= this.MAX_ZOOM_PRECISION / 2 - space[1] / 2;
      final_width = this.MAX_ZOOM_PRECISION;
    }

    const start_x = this.trace_view.x;
    const start_width = this.trace_view.width;

    const max_distance = Math.max(Math.abs(distance_x), Math.abs(distance_width));
    const p = max_distance !== 0 ? Math.log10(max_distance) - 1 : 1;
    // We need to clamp the duration to prevent the animation from being too slow,
    // sometimes the distances are very large as traces can be hours in duration
    const duration = clamp(200 + 100 * Math.abs(p * p), 200, 600);

    const start = performance.now();
    const rafCallback = (now: number) => {
      const elapsed = now - start;
      const progress = elapsed / duration;

      const eased = easeOutSine(progress);

      const x = start_x + distance_x * eased;
      const width = start_width - distance_width * eased;

      this.setTraceView({x, width});
      this.draw();

      if (progress < 1) {
        this.zoomIntoSpaceRaf = window.requestAnimationFrame(rafCallback);
      } else {
        this.zoomIntoSpaceRaf = null;
        this.setTraceView({x: final_x, width: final_width});
        this.draw();
      }
    };

    this.zoomIntoSpaceRaf = window.requestAnimationFrame(rafCallback);
  }

  resetZoom() {
    this.onZoomIntoSpace([this.to_origin, this.trace_space.width]);
  }

  onWheelEndRaf: number | null = null;
  enqueueOnWheelEndRaf() {
    if (this.onWheelEndRaf !== null) {
      window.cancelAnimationFrame(this.onWheelEndRaf);
    }

    const start = performance.now();
    const rafCallback = (now: number) => {
      const elapsed = now - start;
      if (elapsed > 200) {
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
    // In cases where a trace might have a single error, there is no concept of a timeline
    if (this.trace_view.width === 0) {
      return;
    }
    const x = view.x ?? this.trace_view.x;
    const width = view.width ?? this.trace_view.width;

    this.trace_view.x = clamp(x, 0, this.trace_space.width - width);
    this.trace_view.width = clamp(
      width,
      this.MAX_ZOOM_PRECISION,
      this.trace_space.width - this.trace_view.x
    );

    this.recomputeTimelineIntervals();
    this.recomputeSpanToPxMatrix();
  }

  scrollSyncRaf: number | null = null;
  onSyncedScrollbarScroll(event: WheelEvent) {
    if (this.isScrolling) {
      return;
    }

    const scrollingHorizontally = Math.abs(event.deltaX) >= Math.abs(event.deltaY);
    if (event.deltaX !== 0 && event.deltaX !== -0 && scrollingHorizontally) {
      event.preventDefault();
    } else {
      return;
    }

    if (this.bringRowIntoViewAnimation !== null) {
      window.cancelAnimationFrame(this.bringRowIntoViewAnimation);
      this.bringRowIntoViewAnimation = null;
    }

    this.enqueueOnScrollEndOutOfBoundsCheck();

    const newTransform = this.clampRowTransform(
      this.columns.list.translate[0] - event.deltaX
    );

    if (newTransform === this.columns.list.translate[0]) {
      return;
    }

    this.columns.list.translate[0] = newTransform;

    if (this.scrollSyncRaf) {
      window.cancelAnimationFrame(this.scrollSyncRaf);
    }

    this.scrollSyncRaf = window.requestAnimationFrame(() => {
      for (let i = 0; i < this.columns.list.column_refs.length; i++) {
        const list = this.columns.list.column_refs[i];
        if (list?.children?.[0]) {
          (list.children[0] as HTMLElement).style.transform =
            `translateX(${this.columns.list.translate[0]}px)`;
        }
      }
    });
  }

  clampRowTransform(transform: number): number {
    const columnWidth = this.columns.list.width * this.container_physical_space.width;
    const max = this.row_measurer.max - columnWidth + 16;

    if (this.row_measurer.max < columnWidth) {
      return 0;
    }

    // Sometimes the wheel event glitches or jumps to a very high value
    if (transform > 0) {
      return 0;
    }
    if (transform < -max) {
      return -max;
    }

    return transform;
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

    for (let i = 5; i < this.columns.span_list.column_refs.length - 5; i++) {
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

  isOutsideOfViewOnKeyDown(node: TraceTreeNode<any>, offset_px: number): boolean {
    const width = this.row_measurer.cache.get(node);
    if (width === undefined) {
      // this is unlikely to happen, but we should trigger a sync measure event if it does
      return false;
    }
    const translation = this.columns.list.translate[0];

    return (
      translation + node.depth * this.row_depth_padding < 0 ||
      translation + node.depth * this.row_depth_padding + offset_px >
        this.columns.list.width * this.container_physical_space.width
    );
  }

  scrollRowIntoViewHorizontally(
    node: TraceTreeNode<any>,
    duration: number = 600,
    offset_px: number = 0,
    position: 'exact' | 'measured' = 'measured'
  ) {
    const depth_px = -node.depth * this.row_depth_padding + offset_px;
    const newTransform =
      position === 'exact' ? depth_px : this.clampRowTransform(depth_px);

    this.animateScrollColumnTo(newTransform, duration);
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

  computeRelativeLeftPositionFromOrigin(
    timestamp: number,
    entire_space: [number, number]
  ) {
    return (timestamp - entire_space[0]) / entire_space[1];
  }

  recomputeTimelineIntervals() {
    if (this.trace_view.width === 0) {
      this.intervals[0] = 0;
      this.intervals[1] = 0;
      for (let i = 2; i < this.intervals.length; i++) {
        this.intervals[i] = undefined;
      }
      return;
    }
    const tracePhysicalToView = this.trace_physical_space.between(this.trace_view);
    const time_at_100 =
      tracePhysicalToView[0] * (100 * window.devicePixelRatio) +
      tracePhysicalToView[6] -
      this.trace_view.x;

    computeTimelineIntervals(this.trace_view, time_at_100, this.intervals);
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

  scrollToEventID(
    eventId: string,
    tree: TraceTree,
    rerender: () => void,
    {api, organization}: {api: Client; organization: Organization}
  ): Promise<{index: number; node: TraceTreeNode<TraceTree.NodeValue>} | null | null> {
    const node = findInTreeByEventId(tree.root, eventId);

    if (!node) {
      return Promise.resolve(null);
    }

    return this.scrollToPath(tree, node.path, rerender, {api, organization}).then(
      async result => {
        // When users are coming off an eventID link, we want to fetch the children
        // of the node that the eventID points to. This is because the eventID link
        // only points to the transaction, but we want to fetch the children of the
        // transaction to show the user the list of spans in that transaction
        if (result?.node?.canFetch) {
          await tree.zoomIn(result.node, true, {api, organization}).catch(_e => {
            Sentry.captureMessage('Failed to fetch children of eventId on mount');
          });
          return result;
        }

        return null;
      }
    );
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
      this.scrollToRow(0);
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
      let current = findInTreeFromSegment(parent, path!);

      if (!current) {
        // Some parts of the codebase link to span:span_id, txn:event_id, where span_id is
        // actally stored on the txn:event_id node. Since we cant tell from the link itself
        // that this is happening, we will perform a final check to see if we've actually already
        // arrived to the node in the previous search call.
        if (path) {
          const [type, id] = path.split(':');

          if (
            type === 'span' &&
            isTransactionNode(parent) &&
            parent.value.span_id === id
          ) {
            current = parent;
          }
        }

        if (!current) {
          Sentry.captureMessage('Failed to scroll to node in trace tree');
          return null;
        }
      }

      // Reassing the parent to the current node so that
      // searching narrows down to the current level
      // and we dont need to search the entire tree each time
      parent = current;

      if (isTransactionNode(current)) {
        const nextSegment = segments[segments.length - 1];
        if (
          nextSegment?.startsWith('span:') ||
          nextSegment?.startsWith('empty:') ||
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
      this.scrollToRow(index);
      return {index, node: current};
    };

    return scrollToRow();
  }

  scrollToRow(index: number) {
    if (!this.list) {
      return;
    }
    this.list.scrollToRow(index);
  }

  computeTransformXFromTimestamp(timestamp: number): number {
    return (timestamp - this.to_origin - this.trace_view.x) / this.span_to_px[0];
  }

  computeSpanTextPlacement(span_space: [number, number], text: string): [number, number] {
    const TEXT_PADDING = 2;
    const anchor_left = span_space[0] > this.to_origin + this.trace_space.width * 0.8;

    const width = this.text_measurer.measure(text);

    // precompute all anchor points aot, so we make the control flow more readable.
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
      if (
        // If the right edge of the span is within 10% to the right edge of the space,
        // try and fit the text inside the span if possible. In case the span is too short
        // to fit the text, anchor_left case above will take care of anchoring it to the left
        // of the view.

        // Note: the accurate way for us to determine if the text fits to the right side
        // of the view would have been to compute the scaling matrix for a non zoomed view at 0,0
        // origin and check if it fits into the distance of space right edge - span right edge. In practice
        // however, it seems that a magical number works just fine.
        span_right > this.trace_space.right * 0.9 &&
        space_right / this.span_to_px[0] < width
      ) {
        return [1, right_inside];
      }
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
        list_width * (this.container_physical_space.width - this.scrollbar_width) -
        DIVIDER_WIDTH / 2 -
        1
      }px)`;
    }
    if (this.indicator_container) {
      const correction =
        (this.scrollbar_width / this.container_physical_space.width) * span_list_width;
      this.indicator_container.style.transform = `translateX(${-this.scrollbar_width}px)`;
      this.indicator_container.style.width = (span_list_width - correction) * 100 + '%';
    }

    for (let i = 0; i < this.columns.list.column_refs.length; i++) {
      const list = this.columns.list.column_refs[i];
      if (list) list.style.width = list_width * 100 + '%';
      const span = this.columns.span_list.column_refs[i];
      if (span) span.style.width = span_list_width * 100 + '%';

      const span_bar = this.span_bars[i];
      const span_arrow = this.span_arrows[i];

      if (span_bar) {
        const span_transform = this.computeSpanCSSMatrixTransform(span_bar.space);
        span_bar.ref.style.transform = `matrix(${span_transform.join(',')}`;
        span_bar.ref.style.setProperty(
          '--inverse-span-scale',
          1 / span_transform[0] + ''
        );
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
        if (span_arrow && span_bar) {
          const outside_left =
            span_bar.space[0] - this.to_origin + span_bar.space[1] < this.trace_view.x;
          const outside_right =
            span_bar.space[0] - this.to_origin > this.trace_view.right;
          const visible = outside_left || outside_right;

          if (visible !== span_arrow.visible) {
            span_arrow.visible = visible;
            span_arrow.position = outside_left ? 0 : 1;

            if (visible) {
              span_arrow.ref.className = `TraceArrow Visible ${span_arrow.position === 0 ? 'Left' : 'Right'}`;
            } else {
              span_arrow.ref.className = 'TraceArrow';
            }
          }
        }
      }
    }

    for (let i = 0; i < this.invisible_bars.length; i++) {
      const invisible_bar = this.invisible_bars[i];
      if (invisible_bar) {
        invisible_bar.ref.style.transform = `translateX(${this.computeTransformXFromTimestamp(invisible_bar.space[0])}px)`;
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

    // Renders timeline indicators and labels
    for (let i = 0; i < this.timeline_indicators.length; i++) {
      const indicator = this.timeline_indicators[i];

      // Special case for when the timeline is empty - we want to show the first and last
      // timeline indicators as 0ms instead of just a single 0ms indicator as it gives better
      // context to the user that start and end are both 0ms. If we were to draw a single 0ms
      // indicator, it leaves ambiguity for the user to think that the end might be missing
      if (i === 0 && this.intervals[0] === 0 && this.intervals[1] === 0) {
        const first = this.timeline_indicators[0];
        const last = this.timeline_indicators[1];

        if (first && last) {
          first.style.opacity = '1';
          last.style.opacity = '1';
          first.style.transform = `translateX(0)`;

          // 43 px offset is the width of a 0.00ms label, since we usually anchor the label to the right
          // side of the indicator, we need to offset it by the width of the label to make it look like
          // it is at the end of the timeline
          last.style.transform = `translateX(${this.trace_physical_space.width - 43}px)`;
          const firstLabel = first.children[0] as HTMLElement | undefined;
          if (firstLabel) {
            firstLabel.textContent = '0.00ms';
          }
          const lastLabel = last.children[0] as HTMLElement | undefined;
          const lastLine = last.children[1] as HTMLElement | undefined;
          if (lastLine && lastLabel) {
            lastLabel.textContent = '0.00ms';
            lastLine.style.opacity = '0';
            i = 1;
          }
          continue;
        }
      }

      if (indicator) {
        const interval = this.intervals[i];

        if (interval === undefined) {
          indicator.style.opacity = '0';
          continue;
        }

        const placement = this.computeTransformXFromTimestamp(this.to_origin + interval);

        indicator.style.opacity = '1';
        indicator.style.transform = `translateX(${placement}px)`;
        const label = indicator.children[0] as HTMLElement | undefined;
        const duration = getDuration(interval / 1000, 2, true);

        if (label && label?.textContent !== duration) {
          label.textContent = duration;
        }
      }
    }
  }

  teardown() {
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

export class VirtualizedList {
  container: HTMLElement | null = null;

  scrollHeight: number = 0;
  scrollTop: number = 0;

  scrollToRow(index: number, anchor?: 'top') {
    if (!this.container) {
      return;
    }

    if (anchor === 'top') {
      this.container.scrollTop = index * 24;
      return;
    }

    const position = index * 24;
    const top = this.container.scrollTop;
    const height = this.scrollHeight;

    if (position < top) {
      // Row is above the view
      this.container.scrollTop = index * 24;
    } else if (position > top + height) {
      // Row is under the view
      this.container.scrollTop = index * 24 - height + 24;
    } else {
      return;
    }
  }
}

function maybeToggleScrollbar(
  container: HTMLElement,
  containerHeight: number,
  scrollHeight: number,
  manager: VirtualizedViewManager
) {
  if (scrollHeight > containerHeight) {
    container.style.overflowY = 'scroll';
    container.style.scrollbarGutter = 'stable';
    manager.onScrollbarWidthChange(container.offsetWidth - container.clientWidth);
  } else {
    container.style.overflowY = 'auto';
    container.style.scrollbarGutter = 'auto';
    manager.onScrollbarWidthChange(0);
  }
}

interface UseVirtualizedListProps {
  container: HTMLElement | null;
  items: ReadonlyArray<TraceTreeNode<TraceTree.NodeValue>>;
  manager: VirtualizedViewManager;
  render: (item: VirtualizedRow) => React.ReactNode;
}

interface UseVirtualizedListResult {
  list: VirtualizedList;
  rendered: React.ReactNode[];
  virtualized: VirtualizedRow[];
}

export const useVirtualizedList = (
  props: UseVirtualizedListProps
): UseVirtualizedListResult => {
  const list = useRef<VirtualizedList | null>();

  const scrollTopRef = useRef<number>(0);
  const scrollHeightRef = useRef<number>(0);
  const scrollContainerRef = useRef<HTMLElement | null>(null);

  const renderCache = useRef<Map<number, React.ReactNode>>();
  const styleCache = useRef<Map<number, React.CSSProperties>>();
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  if (!styleCache.current) {
    styleCache.current = new Map();
  }
  if (!renderCache.current) {
    renderCache.current = new Map();
  }

  const [items, setItems] = useState<{
    rendered: React.ReactNode[];
    virtualized: VirtualizedRow[];
  }>({rendered: [], virtualized: []});

  if (!list.current) {
    list.current = new VirtualizedList();
    props.manager.registerList(list.current);
  }

  const renderRef = useRef<(item: VirtualizedRow) => React.ReactNode>(props.render);
  renderRef.current = props.render;
  const itemsRef = useRef<ReadonlyArray<TraceTreeNode<TraceTree.NodeValue>>>(props.items);
  itemsRef.current = props.items;
  const managerRef = useRef<VirtualizedViewManager>(props.manager);
  managerRef.current = props.manager;

  useLayoutEffect(() => {
    if (!props.container) {
      return;
    }
    const scrollContainer = props.container.children[0] as HTMLElement | null;
    if (!scrollContainer) {
      throw new Error(
        'Virtualized list container has to render a scroll container as its first child.'
      );
    }
  }, [props.container, props.items.length]);

  useLayoutEffect(() => {
    if (!props.container || !list.current) {
      return;
    }

    list.current.container = props.container;

    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
    }

    const resizeObserver = new ResizeObserver(elements => {
      // We only care about changes to the height of the scroll container,
      // if it has not changed then do not update the scroll height.
      styleCache.current?.clear();
      renderCache.current?.clear();

      scrollHeightRef.current = elements[0].contentRect.height;
      if (list.current) {
        list.current.scrollHeight = scrollHeightRef.current;
      }

      maybeToggleScrollbar(
        elements[0].target as HTMLElement,
        scrollHeightRef.current,
        itemsRef.current.length * 24,
        managerRef.current
      );

      const recomputedItems = findRenderedItems({
        scrollTop: scrollTopRef.current,
        items: itemsRef.current,
        overscroll: 5,
        rowHeight: 24,
        scrollHeight: scrollHeightRef.current,
        styleCache: styleCache.current!,
        renderCache: renderCache.current!,
        render: renderRef.current,
        manager: managerRef.current,
      });
      setItems(recomputedItems);
    });

    resizeObserver.observe(props.container);
    resizeObserverRef.current = resizeObserver;
  }, [props.container]);

  const rafId = useRef<number | null>(null);
  const pointerEventsRaf = useRef<{id: number} | null>(null);

  useLayoutEffect(() => {
    if (!list.current || !props.container) {
      return undefined;
    }

    if (props.container && !scrollContainerRef.current) {
      scrollContainerRef.current = props.container.children[0] as HTMLElement | null;
    }

    props.container.style.height = '100%';
    props.container.style.overflow = 'auto';
    props.container.style.position = 'relative';
    props.container.style.willChange = 'transform';
    props.container.style.overscrollBehavior = 'none';

    scrollContainerRef.current!.style.overflow = 'hidden';
    scrollContainerRef.current!.style.position = 'relative';
    scrollContainerRef.current!.style.willChange = 'transform';
    scrollContainerRef.current!.style.height = `${props.items.length * 24}px`;

    maybeToggleScrollbar(
      props.container,
      scrollHeightRef.current,
      props.items.length * 24,
      props.manager
    );

    const onScroll = event => {
      if (!list.current) {
        return;
      }

      if (rafId.current !== null) {
        window.cancelAnimationFrame(rafId.current);
      }

      managerRef.current.isScrolling = true;
      managerRef.current.enqueueOnScrollEndOutOfBoundsCheck();

      rafId.current = window.requestAnimationFrame(() => {
        scrollTopRef.current = Math.max(0, event.target?.scrollTop ?? 0);

        const recomputedItems = findRenderedItems({
          scrollTop: scrollTopRef.current,
          items: props.items,
          overscroll: 5,
          rowHeight: 24,
          scrollHeight: scrollHeightRef.current,
          styleCache: styleCache.current!,
          renderCache: renderCache.current!,
          render: renderRef.current,
          manager: managerRef.current,
        });
        setItems(recomputedItems);
      });

      if (!pointerEventsRaf.current && scrollContainerRef.current) {
        scrollContainerRef.current.style.pointerEvents = 'none';
      }

      if (pointerEventsRaf.current) {
        window.cancelAnimationFrame(pointerEventsRaf.current.id);
      }

      pointerEventsRaf.current = requestAnimationTimeout(() => {
        styleCache.current?.clear();
        renderCache.current?.clear();

        managerRef.current.isScrolling = false;

        const recomputedItems = findRenderedItems({
          scrollTop: scrollTopRef.current,
          items: props.items,
          overscroll: 5,
          rowHeight: 24,
          scrollHeight: scrollHeightRef.current,
          styleCache: styleCache.current!,
          renderCache: renderCache.current!,
          render: renderRef.current,
          manager: managerRef.current,
        });
        setItems(recomputedItems);

        if (list.current && scrollContainerRef.current) {
          scrollContainerRef.current.style.pointerEvents = 'auto';
          pointerEventsRaf.current = null;
        }
      }, 50);
    };
    props.container.addEventListener('scroll', onScroll, {passive: true});

    return () => {
      props.container?.removeEventListener('scroll', onScroll);
    };
  }, [props.container, props.items, props.items.length, props.manager]);

  useLayoutEffect(() => {
    if (!list.current || !styleCache.current || !renderCache.current) {
      return;
    }

    styleCache.current.clear();
    renderCache.current.clear();

    const recomputedItems = findRenderedItems({
      scrollTop: scrollTopRef.current,
      items: props.items,
      overscroll: 5,
      rowHeight: 24,
      scrollHeight: scrollHeightRef.current,
      styleCache: styleCache.current!,
      renderCache: renderCache.current,
      render: renderRef.current,
      manager: managerRef.current,
    });

    setItems(recomputedItems);
  }, [props.items, props.items.length, props.render]);

  return {
    virtualized: items.virtualized,
    rendered: items.rendered,
    list: list.current!,
  };
};

export interface VirtualizedRow {
  index: number;
  item: TraceTreeNode<TraceTree.NodeValue>;
  key: number;
  style: React.CSSProperties;
}

function findRenderedItems({
  items,
  overscroll,
  rowHeight,
  scrollHeight,
  scrollTop,
  styleCache,
  renderCache,
  render,
  manager,
}: {
  items: ReadonlyArray<TraceTreeNode<TraceTree.NodeValue>>;
  manager: VirtualizedViewManager;
  overscroll: number;
  render: (arg: VirtualizedRow) => React.ReactNode;
  renderCache: Map<number, React.ReactNode>;
  rowHeight: number;
  scrollHeight: number;
  scrollTop: number;
  styleCache: Map<number, React.CSSProperties>;
}): {rendered: React.ReactNode[]; virtualized: VirtualizedRow[]} {
  // This is overscroll height for single direction, when computing the total,
  // we need to multiply this by 2 because we overscroll in both directions.
  const OVERSCROLL_HEIGHT = overscroll * rowHeight;
  const virtualized: VirtualizedRow[] = [];
  const rendered: React.ReactNode[] = [];

  // Clamp viewport to scrollHeight bounds [0, length * rowHeight] because some browsers may fire
  // scrollTop with negative values when the user scrolls up past the top of the list (overscroll behavior)
  const viewport = {
    top: Math.max(scrollTop - OVERSCROLL_HEIGHT, 0),
    bottom: Math.min(
      scrollTop + scrollHeight + OVERSCROLL_HEIGHT,
      items.length * rowHeight
    ),
  };

  // Points to the position inside the visible array
  let visibleItemIndex = 0;
  // Points to the currently iterated item
  let indexPointer = findOptimisticStartIndex({
    items,
    viewport,
    scrollTop,
    rowHeight,
    overscroll,
  });

  manager.start_virtualized_index = indexPointer;

  // Max number of visible items in our list
  const MAX_VISIBLE_ITEMS = Math.ceil((scrollHeight + OVERSCROLL_HEIGHT * 2) / rowHeight);
  const ALL_ITEMS = items.length;

  // While number of visible items is less than max visible items, and we haven't reached the end of the list
  while (visibleItemIndex < MAX_VISIBLE_ITEMS && indexPointer < ALL_ITEMS) {
    const elementTop = indexPointer * rowHeight;
    const elementBottom = elementTop + rowHeight;

    // An element is inside a viewport if the top of the element is below the top of the viewport
    // and the bottom of the element is above the bottom of the viewport
    if (elementTop >= viewport.top && elementBottom <= viewport.bottom) {
      let style = styleCache.get(indexPointer);
      if (!style) {
        style = {position: 'absolute', top: elementTop};
        styleCache.set(indexPointer, style);
      }

      const virtualizedRow: VirtualizedRow = {
        key: indexPointer,
        style,
        index: indexPointer,
        item: items[indexPointer],
      };

      virtualized[visibleItemIndex] = virtualizedRow;

      const renderedRow = renderCache.get(indexPointer) || render(virtualizedRow);
      rendered[visibleItemIndex] = renderedRow;
      renderCache.set(indexPointer, renderedRow);
      visibleItemIndex++;
    }
    indexPointer++;
  }

  return {rendered, virtualized};
}

export function findOptimisticStartIndex({
  items,
  overscroll,
  rowHeight,
  scrollTop,
  viewport,
}: {
  items: ReadonlyArray<TraceTreeNode<TraceTree.NodeValue>>;
  overscroll: number;
  rowHeight: number;
  scrollTop: number;
  viewport: {bottom: number; top: number};
}): number {
  if (!items.length || viewport.top === 0) {
    return 0;
  }
  return Math.max(Math.floor(scrollTop / rowHeight) - overscroll, 0);
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

    if (type === 'empty' && isNoDataNode(node)) {
      return true;
    }

    return false;
  });
}

function hasEventWithEventId(
  node: TraceTreeNode<TraceTree.NodeValue>,
  eventId: string
): boolean {
  // Skip trace nodes since they accumulate all errors and performance issues
  // in the trace and is not an event.
  if (isTraceNode(node)) {
    return false;
  }

  // Search in errors
  if (node.errors.size > 0) {
    for (const e of node.errors) {
      if (e.event_id === eventId) {
        return true;
      }
    }
  }

  // Search in performance issues
  if (node.performance_issues.size > 0) {
    for (const p of node.performance_issues) {
      if (p.event_id === eventId) {
        return true;
      }
    }
  }

  // Check if we are maybe looking for the profile_id
  if (node.value && 'profile_id' in node.value && node.value.profile_id === eventId) {
    return true;
  }

  return false;
}

function findInTreeByEventId(start: TraceTreeNode<TraceTree.NodeValue>, eventId: string) {
  return TraceTreeNode.Find(start, node => {
    if (isTransactionNode(node)) {
      if (node.value.event_id === eventId) {
        return true;
      }
    } else if (isSpanNode(node)) {
      return node.value.span_id === eventId;
    } else if (isTraceErrorNode(node)) {
      return node.value.event_id === eventId;
    }

    return hasEventWithEventId(node, eventId);
  });
}
