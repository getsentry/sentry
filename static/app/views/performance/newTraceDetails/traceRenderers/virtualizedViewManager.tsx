import {mat3, vec2} from 'gl-matrix';
import * as qs from 'query-string';

import {browserHistory} from 'sentry/utils/browserHistory';
import getDuration from 'sentry/utils/duration/getDuration';
import clamp from 'sentry/utils/number/clamp';
import {
  cancelAnimationTimeout,
  requestAnimationTimeout,
} from 'sentry/utils/profiling/hooks/useVirtualizedTree/virtualizedTreeUtils';

import {isMissingInstrumentationNode} from '../traceGuards';
import {TraceTree} from '../traceModels/traceTree';
import type {TraceTreeNode} from '../traceModels/traceTreeNode';
import {TraceRowWidthMeasurer} from '../traceRenderers/traceRowWidthMeasurer';
import {TraceTextMeasurer} from '../traceRenderers/traceTextMeasurer';
import type {TraceView} from '../traceRenderers/traceView';

import type {TraceScheduler} from './traceScheduler';

const DIVIDER_WIDTH = 6;

function easeOutSine(x: number): number {
  return Math.sin((x * Math.PI) / 2);
}

function getHorizontalDelta(x: number, y: number): number {
  if (x >= 0 && y >= 0) {
    return Math.max(x, y);
  }

  return Math.min(x, y);
}

type ViewColumn = {
  column_nodes: TraceTreeNode<TraceTree.NodeValue>[];
  column_refs: (HTMLElement | undefined)[];
  translate: [number, number];
  width: number;
};

type VerticalIndicator = {
  ref: HTMLElement | null;
  timestamp: number | undefined;
};
/**
 * Tracks the state of the virtualized view and manages the resizing of the columns.
 * Children components should call the appropriate register*Ref methods to register their
 * HTML elements.
 */
export type ViewManagerScrollAnchor = 'top' | 'center if outside' | 'center';

export class VirtualizedViewManager {
  row_measurer: TraceRowWidthMeasurer<TraceTreeNode<TraceTree.NodeValue>> =
    new TraceRowWidthMeasurer();
  indicator_label_measurer: TraceRowWidthMeasurer<TraceTree['indicators'][0]> =
    new TraceRowWidthMeasurer();
  text_measurer: TraceTextMeasurer = new TraceTextMeasurer();

  resize_observer: ResizeObserver | null = null;
  list: VirtualizedList | null = null;

  scrolling_source: 'list' | 'fake scrollbar' | null = null;
  start_virtualized_index: number = 0;

  // HTML refs that we need to keep track of such
  // that rendering can be done programmatically
  reset_zoom_button: HTMLButtonElement | null = null;
  divider: HTMLElement | null = null;
  container: HTMLElement | null = null;
  horizontal_scrollbar_container: HTMLElement | null = null;
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
  vertical_indicators: {[key: string]: VerticalIndicator} = {};
  span_bars: ({color: string; ref: HTMLElement; space: [number, number]} | undefined)[] =
    [];
  span_patterns: ({ref: HTMLElement; space: [number, number]} | undefined)[][] = [];
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

  row_depth_padding: number = 22;

  private scrollbar_width: number = 0;
  // the transformation matrix that is used to render scaled elements to the DOM
  private span_to_px: mat3 = mat3.create();
  private readonly ROW_PADDING_PX = 16;
  private readonly span_matrix: [number, number, number, number, number, number] = [
    1, 0, 0, 1, 0, 0,
  ];

  timers: {
    onFovChange: {id: number} | null;
    onListHorizontalScroll: {id: number} | null;
    onRowIntoView: number | null;
    onScrollEndSync: {id: number} | null;
    onWheelEnd: number | null;
    onZoomIntoSpace: number | null;
  } = {
    onZoomIntoSpace: null,
    onWheelEnd: null,
    onListHorizontalScroll: null,
    onRowIntoView: null,
    onScrollEndSync: null,
    onFovChange: null,
  };

  // Column configuration
  columns: Record<'list' | 'span_list', ViewColumn>;
  scheduler: TraceScheduler;
  view: TraceView;

  constructor(
    columns: {
      list: Pick<ViewColumn, 'width'>;
      span_list: Pick<ViewColumn, 'width'>;
    },
    trace_scheduler: TraceScheduler,
    trace_view: TraceView
  ) {
    this.columns = {
      list: {...columns.list, column_nodes: [], column_refs: [], translate: [0, 0]},
      span_list: {
        ...columns.span_list,
        column_nodes: [],
        column_refs: [],
        translate: [0, 0],
      },
    };
    this.scheduler = trace_scheduler;
    this.view = trace_view;

    this.registerResetZoomRef = this.registerResetZoomRef.bind(this);
    this.registerContainerRef = this.registerContainerRef.bind(this);
    this.registerHorizontalScrollBarContainerRef =
      this.registerHorizontalScrollBarContainerRef.bind(this);
    this.registerDividerRef = this.registerDividerRef.bind(this);
    this.registerIndicatorContainerRef = this.registerIndicatorContainerRef.bind(this);

    this.onDividerMouseDown = this.onDividerMouseDown.bind(this);
    this.onDividerMouseUp = this.onDividerMouseUp.bind(this);
    this.onDividerMouseMove = this.onDividerMouseMove.bind(this);
    this.onSyncedScrollbarScroll = this.onSyncedScrollbarScroll.bind(this);
    this.onWheel = this.onWheel.bind(this);
    this.onWheelEnd = this.onWheelEnd.bind(this);
    this.onWheelStart = this.onWheelStart.bind(this);
    this.onNewMaxRowWidth = this.onNewMaxRowWidth.bind(this);
    this.onHorizontalScrollbarScroll = this.onHorizontalScrollbarScroll.bind(this);
  }

  dividerStartVec: [number, number] | null = null;
  previousDividerClientVec: [number, number] | null = null;

  onDividerMouseDown(event: MouseEvent) {
    if (!this.container) {
      return;
    }

    this.dividerStartVec = [event.clientX, event.clientY];
    this.previousDividerClientVec = [event.clientX, event.clientY];

    document.body.style.cursor = 'ew-resize !important';
    document.body.style.userSelect = 'none';

    document.addEventListener('mouseup', this.onDividerMouseUp, {passive: true});
    document.addEventListener('mousemove', this.onDividerMouseMove, {
      passive: true,
    });
  }

  onDividerMouseUp(event: MouseEvent) {
    if (!this.container || !this.dividerStartVec) {
      return;
    }

    const distance = event.clientX - this.dividerStartVec[0];
    const distancePercentage = distance / this.view.trace_container_physical_space.width;

    const list = clamp(this.columns.list.width + distancePercentage, 0.1, 0.9);
    const span_list = clamp(this.columns.span_list.width - distancePercentage, 0.1, 0.9);

    this.columns.list.width = list;
    this.columns.span_list.width = span_list;

    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    this.dividerStartVec = null;
    this.previousDividerClientVec = null;

    this.enqueueOnScrollEndOutOfBoundsCheck();
    document.removeEventListener('mouseup', this.onDividerMouseUp);
    document.removeEventListener('mousemove', this.onDividerMouseMove);

    this.scheduler.dispatch('divider resize end', this.columns.list.width);
  }

  onDividerMouseMove(event: MouseEvent) {
    if (!this.dividerStartVec || !this.divider || !this.previousDividerClientVec) {
      return;
    }

    const distance = event.clientX - this.dividerStartVec[0];
    const distancePercentage = distance / this.view.trace_container_physical_space.width;

    const list = clamp(this.columns.list.width + distancePercentage, 0, 1);
    const span_list = clamp(this.columns.span_list.width - distancePercentage, 0, 1);

    if (span_list * this.view.trace_container_physical_space.width <= 100) {
      return;
    }
    if (list * this.view.trace_container_physical_space.width <= 100) {
      return;
    }

    this.view.trace_physical_space.width =
      span_list * this.view.trace_container_physical_space.width;

    this.scheduler.dispatch('set trace view', {
      x: this.view.trace_view.x,
      width: this.view.trace_view.width,
    });

    this.scheduler.dispatch('divider resize', {
      list,
      span_list,
    });
    this.previousDividerClientVec = [event.clientX, event.clientY];
  }

  onScrollbarWidthChange(width: number) {
    if (width === this.scrollbar_width) {
      return;
    }
    this.scrollbar_width = width;
  }

  registerContainerRef(container: HTMLElement | null) {
    if (container) {
      this.initialize(container);
    } else {
      this.teardown();
    }
  }

  registerResetZoomRef(ref: HTMLButtonElement | null) {
    this.reset_zoom_button = ref;
  }

  registerGhostRowRef(column: string, ref: HTMLElement | null) {
    if (column === 'list' && ref) {
      const scrollableElement = ref.children[0] as HTMLElement | undefined;
      if (scrollableElement) {
        ref.addEventListener('wheel', this.onSyncedScrollbarScroll, {passive: false});
      }
    }

    if (column === 'span_list' && ref) {
      ref.addEventListener('wheel', this.onWheel, {passive: false});
    }
  }

  registerList(list: VirtualizedList | null) {
    this.list = list;
  }

  registerIndicatorContainerRef(ref: HTMLElement | null) {
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

  registerSpanBarRef(
    ref: HTMLElement | null,
    space: [number, number],
    color: string,
    index: number
  ) {
    if (ref) {
      this.span_bars[index] = {ref, space, color};
    }

    if (ref) {
      this.drawSpanBar(this.span_bars[index]!);
      this.span_bars[index]!.ref.style.backgroundColor = color;
    }
  }

  registerArrowRef(ref: HTMLElement | null, space: [number, number], index: number) {
    if (ref) {
      this.span_arrows[index] = {ref, space, visible: false, position: 0};
    }
  }

  registerSpanBarTextRef(
    ref: HTMLElement | null,
    text: string,
    space: [number, number],
    index: number
  ) {
    if (ref) {
      this.span_text[index] = {ref, text, space};
      this.drawSpanText(this.span_text[index]!, this.columns.list.column_nodes[index]);
    }
  }

  registerInvisibleBarRef(
    ref: HTMLElement | null,
    space: [number, number],
    index: number
  ) {
    if (ref) {
      this.invisible_bars[index] = ref ? {ref, space} : undefined;

      const span_transform = this.computeSpanCSSMatrixTransform(space);
      ref.style.transform = `matrix(${span_transform.join(',')}`;
      const inverseScale = Math.round((1 / span_transform[0]) * 1e4) / 1e4;
      ref.style.setProperty(
        '--inverse-span-scale',
        // @ts-expect-error this is a number
        isNaN(inverseScale) ? 1 : inverseScale
      );
    }
  }

  registerColumnRef(
    column: string,
    ref: HTMLElement | null,
    index: number,
    node: TraceTreeNode<any>
  ) {
    if (column === 'list' && ref) {
      const scrollableElement = ref.children[0] as HTMLElement | undefined;

      if (scrollableElement) {
        scrollableElement.style.transform = `translateX(${this.columns.list.translate[0]}px)`;
        this.row_measurer.enqueueMeasure(node, scrollableElement as HTMLElement);
        ref.addEventListener('wheel', this.onSyncedScrollbarScroll, {passive: false});
      }
    }

    if (column === 'span_list' && ref) {
      ref.addEventListener('wheel', this.onWheel, {passive: false});
    }

    if (ref && node) {
      this.columns[column].column_refs[index] = ref;
      this.columns[column].column_nodes[index] = node;
    }
  }

  registerIndicatorRef(
    ref: HTMLElement | null,
    index: number,
    indicator: TraceTree['indicators'][0]
  ) {
    if (!ref) {
      const element = this.indicators[index]?.ref;
      if (element) {
        element.removeEventListener('wheel', this.onWheel);
      }
    } else {
      this.indicators[index] = {ref, indicator};
    }

    if (ref) {
      const label = ref.children[0] as HTMLElement | undefined;
      if (label) {
        this.indicator_label_measurer.enqueueMeasure(indicator, label);
      }

      ref.addEventListener('wheel', this.onWheel, {passive: false});
      ref.style.transform = `translateX(${this.transformXFromTimestamp(
        indicator.start
      )}px)`;
    }
  }

  registerTimelineIndicatorRef(ref: HTMLElement | null, index: number) {
    if (ref) {
      this.timeline_indicators[index] = ref;
      this.drawTimelineInterval(ref, index);
    }
  }

  registerVerticalIndicator(key: string, indicator: VerticalIndicator) {
    if (indicator.ref) {
      this.vertical_indicators[key] = indicator;
      this.drawVerticalIndicator(indicator);
    }
  }

  registerHorizontalScrollBarContainerRef(ref: HTMLElement | null) {
    if (ref) {
      ref.style.width = Math.round(this.columns.list.width * 100) + '%';
      ref.addEventListener('scroll', this.onHorizontalScrollbarScroll, {passive: false});
    } else {
      if (this.horizontal_scrollbar_container) {
        this.horizontal_scrollbar_container.removeEventListener(
          'scroll',
          this.onHorizontalScrollbarScroll
        );
      }
    }

    this.horizontal_scrollbar_container = ref;
  }

  onWheel(event: WheelEvent) {
    if (event.metaKey || event.ctrlKey) {
      event.preventDefault();
      // If this is the first zoom event, then read the clientX and offset it from the container element as offset
      // is relative to the **target element**. In subsequent events, we can use the offsetX property as
      // the pointer-events are going to be disabled and we will receive the correct offsetX value
      let offsetX = 0;
      if (!this.timers.onWheelEnd) {
        offsetX =
          (event.currentTarget as HTMLElement | null)?.getBoundingClientRect()?.left ?? 0;
        this.onWheelStart();
      }
      this.enqueueOnWheelEndRaf();

      const scale = 1 - event.deltaY * 0.01 * -1;
      const x = offsetX > 0 ? event.clientX - offsetX : event.offsetX;
      const configSpaceCursor = this.view.getConfigSpaceCursor({
        x,
        y: 0,
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

      const newView = this.view.trace_view.transform(centerScaleMatrix);

      // When users zoom in, the matrix will compute a width value that is lower than the min,
      // which results in the value of x being incorrectly set and the view moving to the right.
      // To prevent this, we will only update the x position if the new width is greater than the min zoom precision.
      this.scheduler.dispatch('set trace view', {
        x:
          newView[2] < this.view.MAX_ZOOM_PRECISION_MS
            ? this.view.trace_view.x
            : newView[0],
        width: newView[2],
      });
    } else {
      if (!this.timers.onWheelEnd) {
        this.onWheelStart();
      }
      this.enqueueOnWheelEndRaf();

      // Holding shift key allows for horizontal scrolling
      const distance = event.shiftKey
        ? getHorizontalDelta(event.deltaX, event.deltaY)
        : event.deltaX;

      if (
        event.shiftKey ||
        (!event.shiftKey && Math.abs(event.deltaX) > Math.abs(event.deltaY))
      ) {
        event.preventDefault();
      }

      const physical_delta_pct = distance / this.view.trace_physical_space.width;
      const view_delta = physical_delta_pct * this.view.trace_view.width;

      this.scheduler.dispatch('set trace view', {
        x: this.view.trace_view.x + view_delta,
      });
    }
  }

  onBringRowIntoView(space: [number, number]) {
    if (this.timers.onZoomIntoSpace !== null) {
      window.cancelAnimationFrame(this.timers.onZoomIntoSpace);
      this.timers.onZoomIntoSpace = null;
    }

    if (space[0] - this.view.to_origin > this.view.trace_view.x) {
      this.onZoomIntoSpace([
        space[0] + space[1] / 2 - this.view.trace_view.width / 2,
        this.view.trace_view.width,
      ]);
    } else if (space[0] - this.view.to_origin < this.view.trace_view.x) {
      this.onZoomIntoSpace([
        space[0] + space[1] / 2 - this.view.trace_view.width / 2,
        this.view.trace_view.width,
      ]);
    }
  }

  animateViewTo(node_space: [number, number]) {
    const start = node_space[0];
    const width = node_space[1] > 0 ? node_space[1] : this.view.trace_view.width;
    const margin = 0.2 * width;

    this.scheduler.dispatch('set trace view', {
      x: start - margin - this.view.to_origin,
      width: width + margin * 2,
    });
  }

  onZoomIntoSpace(space: [number, number]) {
    let final_x = space[0] - this.view.to_origin;
    let final_width = space[1];

    if (space[1] < this.view.MAX_ZOOM_PRECISION_MS) {
      final_x -= this.view.MAX_ZOOM_PRECISION_MS / 2 - space[1] / 2;
      final_width = this.view.MAX_ZOOM_PRECISION_MS;
    }

    // If the view is not small, then zoom into the span and keep
    // an offset on each side. This ensures we dont need
    // to move the duration label insdie the bar and can preserve
    // some context around the star/end time of a span
    if (this.view.trace_physical_space.width > 300) {
      const mat = this.view.getSpanToPxForSpace([final_x, final_width]);
      const offsetInConfigSpace = 74 * mat[0];

      final_x -= offsetInConfigSpace;
      final_width += offsetInConfigSpace * 2;
    }

    const start_x = this.view.trace_view.x;
    const start_width = this.view.trace_view.width;
    const distance_x = final_x - this.view.trace_view.x;
    const distance_width = this.view.trace_view.width - final_width;

    const max_distance = Math.max(Math.abs(distance_x), Math.abs(distance_width));
    const p = max_distance !== 0 ? Math.log10(max_distance) : 1;
    // We need to clamp the duration to prevent the animation from being too slow,
    // sometimes the distances are very large as traces can be hours in duration
    const duration = clamp(200 + 70 * Math.abs(p), 200, 600);

    const start = performance.now();
    const rafCallback = (now: number) => {
      const elapsed = now - start;
      const progress = elapsed / duration;
      const eased = easeOutSine(progress);

      if (progress <= 1) {
        const x = start_x + distance_x * eased;
        const width = start_width - distance_width * eased;
        this.scheduler.dispatch('set trace view', {
          x,
          width,
        });
        this.timers.onZoomIntoSpace = window.requestAnimationFrame(rafCallback);
      } else {
        this.timers.onZoomIntoSpace = null;
        this.scheduler.dispatch('set trace view', {
          x: final_x,
          width: final_width,
        });
      }
    };

    this.timers.onZoomIntoSpace = window.requestAnimationFrame(rafCallback);
  }

  resetZoom() {
    this.onZoomIntoSpace([this.view.to_origin, this.view.trace_space.width]);
  }

  enqueueOnWheelEndRaf() {
    if (this.timers.onWheelEnd !== null) {
      window.cancelAnimationFrame(this.timers.onWheelEnd);
    }

    const start = performance.now();
    const rafCallback = (now: number) => {
      const elapsed = now - start;
      if (elapsed > 100) {
        this.onWheelEnd();
      } else {
        this.timers.onWheelEnd = window.requestAnimationFrame(rafCallback);
      }
    };

    this.timers.onWheelEnd = window.requestAnimationFrame(rafCallback);
  }

  onWheelStart() {
    document.body.style.overscrollBehavior = 'none';
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
    document.body.style.overscrollBehavior = '';
    this.timers.onWheelEnd = null;

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

  maybeInitializeTraceViewFromQS(fov: string): void {
    const [x, width] = fov.split(',').map(parseFloat);

    if (isNaN(x) || isNaN(width)) {
      return;
    }

    if (width <= 0 || width > this.view.trace_space.width) {
      return;
    }

    if (x < 0 || x > this.view.trace_space.width) {
      return;
    }

    this.scheduler.dispatch('set trace view', {x, width});
  }

  enqueueFOVQueryParamSync(view: TraceView) {
    if (this.timers.onFovChange !== null) {
      window.cancelAnimationFrame(this.timers.onFovChange.id);
    }

    this.timers.onFovChange = requestAnimationTimeout(() => {
      browserHistory.replace({
        pathname: location.pathname,
        query: {
          ...qs.parse(location.search),
          fov: `${view.trace_view.x},${view.trace_view.width}`,
        },
      });
      this.timers.onFovChange = null;
    }, 500);
  }
  onNewMaxRowWidth(max) {
    this.syncHorizontalScrollbar(max);
  }

  syncHorizontalScrollbar(max: number) {
    const child = this.horizontal_scrollbar_container?.children[0] as
      | HTMLElement
      | undefined;

    if (child) {
      child.style.width =
        Math.round(max - this.scrollbar_width + this.ROW_PADDING_PX) + 'px';
    }
  }

  syncResetZoomButton() {
    if (!this.reset_zoom_button) {
      return;
    }
    this.reset_zoom_button.disabled =
      this.view.trace_view.width === this.view.trace_space.width;
  }

  maybeSyncViewWithVerticalIndicator(key: string) {
    const indicator = this.vertical_indicators[key];
    if (!indicator || typeof indicator.timestamp !== 'number') {
      return;
    }

    const timestamp = indicator.timestamp - this.view.to_origin;
    this.scheduler.dispatch('set trace view', {
      x: timestamp - this.view.trace_view.width / 2,
      width: this.view.trace_view.width,
    });
  }

  onHorizontalScrollbarScrollStart(): void {
    document.body.style.overscrollBehavior = 'none';
  }

  onHorizontalScrollbarScrollEnd(): void {
    document.body.style.overscrollBehavior = '';
  }

  onHorizontalScrollbarScroll(_event: Event) {
    if (!this.scrolling_source) {
      this.scrolling_source = 'fake scrollbar';
    }

    if (this.scrolling_source !== 'fake scrollbar') {
      return;
    }

    const scrollLeft = this.horizontal_scrollbar_container?.scrollLeft;
    if (typeof scrollLeft !== 'number') {
      return;
    }

    if (!this.timers.onListHorizontalScroll) {
      this.onHorizontalScrollbarScrollStart();
    }

    this.enqueueOnScrollEndOutOfBoundsCheck();
    this.columns.list.translate[0] = this.clampRowTransform(-scrollLeft);

    const rows = Array.from(
      document.querySelectorAll('.TraceRow .TraceLeftColumn > div')
    ) as HTMLElement[];

    for (const row of rows) {
      row.style.transform = `translateX(${this.columns.list.translate[0]}px)`;
    }

    if (this.timers.onListHorizontalScroll) {
      cancelAnimationTimeout(this.timers.onListHorizontalScroll);
      this.timers.onListHorizontalScroll = null;
    }

    this.timers.onListHorizontalScroll = requestAnimationTimeout(() => {
      this.onHorizontalScrollbarScrollEnd();
      this.timers.onListHorizontalScroll = null;
    }, 100);
  }

  onSyncedScrollbarScroll(event: WheelEvent) {
    if (!this.scrolling_source) {
      this.scrolling_source = 'list';
    }

    if (this.scrolling_source !== 'list') {
      return;
    }

    // Holding shift key allows for horizontal scrolling
    const distance = event.shiftKey ? event.deltaY : event.deltaX;

    if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
      // Prevents firing back/forward navigation
      event.preventDefault();
    } else {
      return;
    }

    if (this.timers.onRowIntoView !== null) {
      window.cancelAnimationFrame(this.timers.onRowIntoView);
      this.timers.onRowIntoView = null;
    }

    if (!this.timers.onListHorizontalScroll) {
      this.onHorizontalScrollbarScrollStart();
    }

    this.enqueueOnScrollEndOutOfBoundsCheck();

    const newTransform = this.clampRowTransform(
      this.columns.list.translate[0] - distance
    );

    if (newTransform === this.columns.list.translate[0]) {
      return;
    }

    this.columns.list.translate[0] = newTransform;

    const rows = Array.from(
      document.querySelectorAll('.TraceRow .TraceLeftColumn > div')
    ) as HTMLElement[];

    for (const row of rows) {
      row.style.transform = `translateX(${this.columns.list.translate[0]}px)`;
    }
    if (this.horizontal_scrollbar_container) {
      this.horizontal_scrollbar_container.scrollLeft = -Math.round(
        this.columns.list.translate[0]
      );
    }

    if (this.timers.onListHorizontalScroll) {
      cancelAnimationTimeout(this.timers.onListHorizontalScroll);
      this.timers.onListHorizontalScroll = null;
    }

    this.timers.onListHorizontalScroll = requestAnimationTimeout(() => {
      this.onHorizontalScrollbarScrollEnd();
      this.timers.onListHorizontalScroll = null;
    }, 100);
  }

  clampRowTransform(transform: number): number {
    const columnWidth =
      this.columns.list.width * this.view.trace_container_physical_space.width;
    const max = this.row_measurer.max - columnWidth + this.ROW_PADDING_PX;

    if (this.row_measurer.queue.length > 0) {
      this.row_measurer.drain();
    }

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

  recomputeSpanToPXMatrix() {
    const traceViewToSpace = this.view.trace_space.between(this.view.trace_view);
    const tracePhysicalToView = this.view.trace_physical_space.between(
      this.view.trace_space
    );

    this.span_to_px = mat3.multiply(
      this.span_to_px,
      traceViewToSpace,
      tracePhysicalToView
    );
  }

  computeSpanCSSMatrixTransform(
    space: [number, number]
  ): [number, number, number, number, number, number] {
    const scale = space[1] / this.view.trace_view.width;
    this.span_matrix[0] = Math.max(
      scale,
      this.span_to_px[0] / this.view.trace_view.width
    );
    this.span_matrix[4] =
      (space[0] - this.view.to_origin) / this.span_to_px[0] -
      this.view.trace_view.x / this.span_to_px[0];

    // if span ends less than 1px before the end of the view, we move it back by 1px and prevent it from being clipped
    if (
      space[0] - this.view.to_origin > this.view.trace_space.width / 2 &&
      (this.view.to_origin + this.view.trace_space.width - space[0] - space[1]) /
        this.span_to_px[0] <=
        1
    ) {
      // 1px for the span and 1px for the border
      this.span_matrix[4] = this.span_matrix[4] - 2;
    }
    return this.span_matrix;
  }

  transformXFromTimestamp(timestamp: number): number {
    return (
      (timestamp - this.view.to_origin - this.view.trace_view.x) / this.span_to_px[0]
    );
  }

  enqueueOnScrollEndOutOfBoundsCheck() {
    if (this.timers.onRowIntoView !== null) {
      // Dont enqueue updates while view is scrolling
      return;
    }

    window.cancelAnimationFrame(this.timers.onScrollEndSync?.id ?? 0);

    this.timers.onScrollEndSync = requestAnimationTimeout(() => {
      this.onScrollEndOutOfBoundsCheck();
    }, 300);
  }

  onScrollEndOutOfBoundsCheck() {
    this.timers.onScrollEndSync = null;
    this.scrolling_source = null;

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
        !innerMostNode ||
        TraceTree.Depth(this.columns.list.column_nodes[i]) <
          TraceTree.Depth(innerMostNode)
          ? this.columns.list.column_nodes[i]
          : innerMostNode;
    }

    if (innerMostNode) {
      if (translation + max < 0) {
        this.scrollRowIntoViewHorizontally(innerMostNode);
      } else if (
        translation + TraceTree.Depth(innerMostNode) * this.row_depth_padding >
        this.columns.list.width * this.view.trace_container_physical_space.width
      ) {
        this.scrollRowIntoViewHorizontally(innerMostNode);
      }
    }
  }

  isOutsideOfView(node: TraceTreeNode<any>): boolean {
    const width = this.row_measurer.cache.get(node);

    if (width === undefined) {
      return false;
    }

    const translation = this.columns.list.translate[0];

    return (
      translation + TraceTree.Depth(node) * this.row_depth_padding < 0 ||
      translation + TraceTree.Depth(node) * this.row_depth_padding >
        (this.columns.list.width * this.view.trace_container_physical_space.width) / 2
    );
  }

  scrollRowIntoViewHorizontally(
    node: TraceTreeNode<any>,
    duration: number = 600,
    offset_px: number = 0,
    position: 'exact' | 'measured' = 'measured'
  ) {
    const depth_px = -TraceTree.Depth(node) * this.row_depth_padding + offset_px;
    const newTransform =
      position === 'exact' ? depth_px : this.clampRowTransform(depth_px);

    this.animateScrollColumnTo(newTransform, duration);
  }

  animateScrollColumnTo(x: number, duration: number) {
    if (duration === 0) {
      this.columns.list.translate[0] = x;

      const rows = Array.from(
        document.querySelectorAll('.TraceRow .TraceLeftColumn > div')
      ) as HTMLElement[];

      for (const row of rows) {
        row.style.transform = `translateX(${this.columns.list.translate[0]}px)`;
      }

      if (this.horizontal_scrollbar_container) {
        this.horizontal_scrollbar_container.scrollLeft = -x;
      }
      dispatchJestScrollUpdate(this.horizontal_scrollbar_container!);
      return;
    }

    const start = performance.now();
    const startPosition = this.columns.list.translate[0];
    const distance = x - startPosition;

    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = duration > 0 ? elapsed / duration : 1;
      const eased = easeOutSine(progress);

      const pos = startPosition + distance * eased;

      const rows = Array.from(
        document.querySelectorAll('.TraceRow .TraceLeftColumn > div')
      ) as HTMLElement[];

      for (const row of rows) {
        row.style.transform = `translateX(${this.columns.list.translate[0]}px)`;
      }

      if (progress < 1) {
        this.columns.list.translate[0] = pos;
        this.timers.onRowIntoView = window.requestAnimationFrame(animate);
      } else {
        this.timers.onRowIntoView = null;
        if (this.horizontal_scrollbar_container) {
          this.horizontal_scrollbar_container.scrollLeft = -x;
        }
        this.columns.list.translate[0] = x;
      }

      dispatchJestScrollUpdate(this.horizontal_scrollbar_container!);
    };

    this.timers.onRowIntoView = window.requestAnimationFrame(animate);
  }

  initialize(container: HTMLElement) {
    if (this.container !== container && this.resize_observer !== null) {
      this.teardown();
      return;
    }

    this.container = container;
    this.drawContainers(this.container, {
      list_width: this.columns.list.width,
      span_list_width: this.columns.span_list.width,
    });

    this.row_measurer.on('max', this.onNewMaxRowWidth);
    this.resize_observer = new ResizeObserver(entries => {
      const entry = entries[0];
      if (!entry) {
        throw new Error('ResizeObserver entry is undefined');
      }

      this.scheduler.dispatch('set container physical space', [
        0,
        0,
        entry.contentRect.width,
        entry.contentRect.height,
      ]);
    });

    this.resize_observer.observe(container);
  }

  computeRelativeLeftPositionFromOrigin(
    timestamp: number,
    entire_space: [number, number]
  ) {
    return (timestamp - entire_space[0]) / entire_space[1];
  }

  recomputeTimelineIntervals() {
    if (this.view.trace_view.width === 0) {
      this.intervals[0] = 0;
      this.intervals[1] = 0;
      for (let i = 2; i < this.intervals.length; i++) {
        this.intervals[i] = undefined;
      }
      return;
    }
    const tracePhysicalToView = this.view.trace_physical_space.between(
      this.view.trace_view
    );
    const time_at_100 =
      tracePhysicalToView[0] * (110 * window.devicePixelRatio) +
      tracePhysicalToView[6] -
      this.view.trace_view.x;

    computeTimelineIntervals(this.view, time_at_100, this.intervals);
  }

  scrollToRow(index: number, anchor?: ViewManagerScrollAnchor) {
    if (!this.list) {
      return;
    }
    this.list.scrollToRow(index, anchor);
  }

  computeSpanTextPlacement(
    node: TraceTreeNode<TraceTree.NodeValue>,
    span_space: [number, number],
    text: string
  ): [number, number] {
    const TEXT_PADDING = 3;

    const icon_width_config_space = (18 * this.span_to_px[0]) / 2;
    const text_anchor_left =
      span_space[0] > this.view.to_origin + this.view.trace_space.width * 0.5;
    const text_width = this.text_measurer.measure(text);

    const timestamps = getIconTimestamps(node, span_space, icon_width_config_space);
    const text_left = Math.min(span_space[0], timestamps[0]);
    const text_right = Math.max(span_space[0] + span_space[1], timestamps[1]);

    // precompute all anchor points aot, so we make the control flow more readable.
    /// |---| text
    const right_outside = this.transformXFromTimestamp(text_right) + TEXT_PADDING;
    // |---text|
    const right_inside =
      this.transformXFromTimestamp(span_space[0] + span_space[1]) -
      text_width -
      TEXT_PADDING;
    // |text---|
    const left_inside = this.transformXFromTimestamp(span_space[0]) + TEXT_PADDING;
    /// text |---|
    const left_outside =
      this.transformXFromTimestamp(text_left) - TEXT_PADDING - text_width;

    // Right edge of the window (when span extends beyond the view)
    const window_right =
      this.transformXFromTimestamp(
        this.view.to_origin + this.view.trace_view.left + this.view.trace_view.width
      ) -
      text_width -
      TEXT_PADDING;
    const window_left =
      this.transformXFromTimestamp(this.view.to_origin + this.view.trace_view.left) +
      TEXT_PADDING;

    const view_left = this.view.trace_view.x;
    const view_right = view_left + this.view.trace_view.width;

    const span_left = span_space[0] - this.view.to_origin;
    const span_right = span_left + span_space[1];

    const space_right = view_right - span_right;
    const space_left = span_left - view_left;

    // Span is completely outside of the view on the left side
    if (span_right < this.view.trace_view.x) {
      return text_anchor_left ? [1, right_inside] : [0, right_outside];
    }

    // Span is completely outside of the view on the right side
    if (span_left > this.view.trace_view.right) {
      return text_anchor_left ? [0, left_outside] : [1, left_inside];
    }

    // Span "spans" the entire view
    if (span_left <= this.view.trace_view.x && span_right >= this.view.trace_view.right) {
      return text_anchor_left ? [1, window_left] : [1, window_right];
    }

    const full_span_px_width = span_space[1] / this.span_to_px[0];

    if (text_anchor_left) {
      // While we have space on the left, place the text there
      if (space_left > 0) {
        return [0, left_outside];
      }

      const distance = span_right - this.view.trace_view.left;
      const visible_width = distance / this.span_to_px[0] - TEXT_PADDING;

      // If the text fits inside the visible portion of the span, anchor it to the left
      // side of the window so that it is visible while the user pans the view
      if (visible_width - TEXT_PADDING >= text_width) {
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
        // to fit the text, text_left case above will take care of anchoring it to the left
        // of the view.

        // Note: the accurate way for us to determine if the text fits to the right side
        // of the view would have been to compute the scaling matrix for a non zoomed view at 0,0
        // origin and check if it fits into the distance of space right edge - span right edge. In practice
        // however, it seems that a magical number works just fine.
        span_right > this.view.trace_space.right * 0.9 &&
        space_right / this.span_to_px[0] < text_width
      ) {
        if (full_span_px_width > text_width) {
          return [1, right_inside];
        }
        return [0, left_outside];
      }
      return [0, right_outside];
    }

    // If text fits inside the span
    if (full_span_px_width > text_width) {
      const distance = span_right - this.view.trace_view.right;
      const visible_width =
        (span_space[1] - distance) / this.span_to_px[0] - TEXT_PADDING;

      // If the text fits inside the visible portion of the span, anchor it to the right
      // side of the window so that it is visible while the user pans the view
      if (visible_width - TEXT_PADDING >= text_width) {
        return [1, window_right];
      }

      // If the text doesnt fit inside the visible portion of the span,
      // anchor it to the inside left of the span
      return [1, left_inside];
    }

    return [0, right_outside];
  }

  last_indicator_width = 0;
  draw(options: {list?: number; span_list?: number} = {}) {
    this.recomputeTimelineIntervals();
    this.recomputeSpanToPXMatrix();

    const list_width = options.list ?? this.columns.list.width;
    const span_list_width = options.span_list ?? this.columns.span_list.width;

    this.drawContainers(this.container, {
      list_width,
      span_list_width,
    });

    // 60px error margin. ~52px is roughly the width of 500.00ms, we add a bit more, to be safe.
    const error_margin = 60 * this.span_to_px[0];

    for (let i = 0; i < this.columns.list.column_refs.length; i++) {
      const span = this.span_bars[i];

      if (!span) {
        continue;
      }

      const outside_left =
        span.space[0] - this.view.to_origin + span.space[1] <
        this.view.trace_view.x - error_margin;
      const outside_right =
        span.space[0] - this.view.to_origin - error_margin > this.view.trace_view.right;

      if (outside_left || outside_right) {
        this.hideSpanBar(this.span_bars[i], this.span_text[i]);
        this.drawSpanArrow(this.span_arrows[i], true, outside_left ? 0 : 1);
        continue;
      }

      this.drawSpanBar(this.span_bars[i]);
      this.drawSpanText(this.span_text[i], this.columns.list.column_nodes[i]);
      this.drawSpanArrow(this.span_arrows[i], false, 0);
    }

    this.drawInvisibleBars();

    let start_indicator = 0;
    let end_indicator = this.indicators.length;

    while (start_indicator < this.indicators.length - 1) {
      const indicator = this.indicators[start_indicator];
      if (!indicator?.indicator) {
        start_indicator++;
        continue;
      }

      if (indicator.indicator.start < this.view.to_origin + this.view.trace_view.left) {
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
      if (
        last_indicator.indicator.start >
        this.view.to_origin + this.view.trace_view.right
      ) {
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

      const transform = this.transformXFromTimestamp(entry.indicator.start);
      const label = entry.ref.children[0] as HTMLElement | undefined;

      const indicator_max = this.view.trace_physical_space.width + 1;
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
          } else if (space_right > this.view.trace_physical_space.width) {
            const right =
              -label_width / 2 - (space_right - this.view.trace_physical_space.width) - 1;
            label.style.transform = `translateX(${right}px)`;
          } else {
            label.style.transform = `translateX(${-label_width / 2}px)`;
          }
        }
      }

      entry.ref.style.opacity = '1';
      entry.ref.style.transform = `translate(${clamped_transform}px, 0)`;
    }

    this.drawVerticalIndicators();
    this.drawTimelineIntervals();
  }

  // DRAW METHODS

  hideSpanBar(span_bar: this['span_bars'][0], span_text: this['span_text'][0]) {
    span_bar && (span_bar.ref.style.transform = 'translate(-10000px, -10000px)');
    span_text && (span_text.ref.style.transform = 'translate(-10000px, -10000px)');
  }

  hideSpanArrow(span_arrow: this['span_arrows'][0]) {
    if (!span_arrow) {
      return;
    }
    span_arrow.ref.className = 'TraceArrow';
    span_arrow.visible = false;
    span_arrow.ref.style.opacity = '0';
  }

  drawSpanBar(span_bar: this['span_bars'][0]) {
    if (!span_bar) {
      return;
    }

    const span_transform = this.computeSpanCSSMatrixTransform(span_bar?.space);
    span_bar.ref.style.transform = `matrix(${span_transform.join(',')}`;
    const inverseScale = Math.round((1 / span_transform[0]) * 1e4) / 1e4;
    span_bar.ref.style.setProperty(
      '--inverse-span-scale',
      // @ts-expect-error we set number value type on purpose
      isNaN(inverseScale) ? 1 : inverseScale
    );
  }

  drawSpanText(span_text: this['span_text'][0], node: TraceTreeNode<any> | undefined) {
    if (!span_text) {
      return;
    }

    const [inside, text_transform] = this.computeSpanTextPlacement(
      node!,
      span_text.space,
      span_text.text
    );

    if (text_transform === null) {
      return;
    }

    // We don't color the text white for missing instrumentation nodes
    // as the text will be invisible on the light background.
    span_text.ref.style.color =
      inside && node && !isMissingInstrumentationNode(node) ? 'white' : '';
    span_text.ref.style.transform = `translateX(${text_transform}px)`;
  }

  drawSpanArrow(span_arrow: this['span_arrows'][0], visible: boolean, position: 0 | 1) {
    if (!span_arrow) {
      return;
    }

    if (visible !== span_arrow.visible) {
      span_arrow.visible = visible;
      span_arrow.position = position;

      if (visible) {
        span_arrow.ref.className = `TraceArrow Visible ${span_arrow.position === 0 ? 'Left' : 'Right'}`;
      } else {
        span_arrow.ref.className = 'TraceArrow';
      }
    }
  }

  drawVerticalIndicators() {
    for (const key in this.vertical_indicators) {
      this.drawVerticalIndicator(this.vertical_indicators[key]);
    }
  }

  drawVerticalIndicator(indicator: VerticalIndicator) {
    if (!indicator.ref) {
      return;
    }

    if (indicator.timestamp === undefined) {
      indicator.ref.style.opacity = '0';
      return;
    }

    const placement = this.transformXFromTimestamp(indicator.timestamp);
    indicator.ref.style.opacity = '1';
    indicator.ref.style.transform = `translateX(${placement}px)`;
  }

  drawTimelineInterval(ref: HTMLElement | undefined, index: number) {
    if (!ref) {
      return;
    }

    const interval = this.intervals[index];
    if (interval === undefined) {
      ref.style.opacity = '0';
      return;
    }

    const placement = this.transformXFromTimestamp(this.view.to_origin + interval);

    ref.style.opacity = '1';
    ref.style.transform = `translateX(${placement}px)`;
    const label = ref.children[0] as HTMLElement | undefined;
    const duration = getDuration(interval / 1000, 2, true);

    if (label && label?.textContent !== duration) {
      label.textContent = duration;
    }
  }

  drawTimelineIntervals() {
    if (this.intervals[0] === 0 && this.intervals[1] === 0) {
      this.drawEmptyTimelineIntervals();

      for (let i = 2; i < this.timeline_indicators.length; i++) {
        const indicator = this.timeline_indicators[i];
        if (indicator) {
          indicator.style.opacity = '0';
        }
      }
      return;
    }
    for (let i = 0; i < this.timeline_indicators.length; i++) {
      this.drawTimelineInterval(this.timeline_indicators[i], i);
    }
  }

  // Special case for when the timeline is empty - we want to show the first and last
  // timeline indicators as 0ms instead of just a single 0ms indicator as it gives better
  // context to the user that start and end are both 0ms. If we were to draw a single 0ms
  // indicator, it leaves ambiguity for the user to think that the end might be missing
  drawEmptyTimelineIntervals() {
    const first = this.timeline_indicators[0];
    const last = this.timeline_indicators[1];

    if (first && last) {
      first.style.opacity = '1';
      last.style.opacity = '1';
      first.style.transform = `translateX(0)`;

      // 43 px offset is the width of a 0.00ms label, since we usually anchor the label to the right
      // side of the indicator, we need to offset it by the width of the label to make it look like
      // it is at the end of the timeline
      last.style.transform = `translateX(${this.view.trace_physical_space.width - 43}px)`;
      const firstLabel = first.children[0] as HTMLElement | undefined;
      if (firstLabel) {
        firstLabel.textContent = '0.00ms';
      }
      const lastLabel = last.children[0] as HTMLElement | undefined;
      const lastLine = last.children[1] as HTMLElement | undefined;
      if (lastLine && lastLabel) {
        lastLabel.textContent = '0.00ms';
        lastLine.style.opacity = '0';
      }
    }
  }

  drawContainers(
    container: HTMLElement | null,
    options: {list_width: number; span_list_width: number}
  ) {
    if (!container) {
      return;
    }

    if (this.last_list_column_width !== options.list_width) {
      container.style.setProperty(
        '--list-column-width',
        // @ts-expect-error we set number value type on purpose
        options.list_width
      );
      this.last_list_column_width = options.list_width;
    }
    if (this.last_span_column_width !== options.span_list_width) {
      container.style.setProperty(
        '--span-column-width',
        // @ts-expect-error we set number value type on purpose
        options.span_list_width
      );
      this.last_span_column_width = options.span_list_width;
    }

    if (this.indicator_container) {
      const correction =
        (this.scrollbar_width / this.view.trace_container_physical_space.width) *
        options.span_list_width;
      this.indicator_container.style.transform = `translateX(${-this.scrollbar_width}px)`;
      const new_indicator_container_width = options.span_list_width - correction;

      if (this.last_indicator_width !== new_indicator_container_width) {
        this.indicator_container.style.width = new_indicator_container_width * 100 + '%';
        this.last_indicator_width = new_indicator_container_width;
      }
    }

    const dividerPosition =
      Math.round(
        (options.list_width *
          (this.view.trace_container_physical_space.width - this.scrollbar_width) -
          DIVIDER_WIDTH / 2 -
          1) *
          10
      ) / 10;

    if (this.horizontal_scrollbar_container) {
      this.horizontal_scrollbar_container.style.width =
        (dividerPosition / this.view.trace_container_physical_space.width) * 100 + '%';
    }

    if (this.divider) {
      this.divider.style.transform = `translate(
        ${dividerPosition}px, 0)`;
    }
  }

  last_list_column_width = 0;
  last_span_column_width = 0;
  drawInvisibleBars() {
    for (let i = 0; i < this.invisible_bars.length; i++) {
      const invisible_bar = this.invisible_bars[i];
      const text = this.span_text[i];

      if (invisible_bar) {
        const span_transform = this.computeSpanCSSMatrixTransform(invisible_bar?.space);
        invisible_bar.ref.style.transform = `matrix(${span_transform.join(',')}`;
        const inverseScale = Math.round((1 / span_transform[0]) * 1e4) / 1e4;
        invisible_bar.ref.style.setProperty(
          '--inverse-span-scale',
          // @ts-expect-error we set number value type on purpose
          isNaN(inverseScale) ? 1 : inverseScale
        );
      }

      if (text) {
        const [inside, text_transform] = this.computeSpanTextPlacement(
          this.columns.list.column_nodes[i],
          text.space,
          text.text
        );

        if (text_transform === null) {
          return;
        }

        text.ref.style.color = inside ? 'white' : '';
        text.ref.style.transform = `translateX(${text_transform}px)`;
      }
    }
  }

  // END DRAW METHODS

  teardown() {
    this.row_measurer.off('max', this.onNewMaxRowWidth);

    if (this.resize_observer) {
      this.resize_observer.disconnect();
      this.resize_observer = null;
      this.container = null;
    }
  }
}

// Computes a min and max icon timestamp. This effectively extends or reduces the hitbox
// of the span to include the icon. We need this because when the icon is close to the edge
// it can extend it and cause overlaps with duration labels
function getIconTimestamps(
  node: TraceTreeNode<any>,
  span_space: [number, number],
  icon_width: number
) {
  let min_icon_timestamp = span_space[0];
  let max_icon_timestamp = span_space[0] + span_space[1];

  if (!node.errors.size && !node.performance_issues.size) {
    return [min_icon_timestamp, max_icon_timestamp];
  }

  for (const issue of node.performance_issues) {
    // Perf issues render icons at the start timestamp
    if (typeof issue.start === 'number') {
      min_icon_timestamp = Math.min(min_icon_timestamp, issue.start * 1e3 - icon_width);
      max_icon_timestamp = Math.max(max_icon_timestamp, issue.start * 1e3 + icon_width);
    }
  }

  for (const err of node.errors) {
    if (typeof err.timestamp === 'number') {
      min_icon_timestamp = Math.min(min_icon_timestamp, err.timestamp * 1e3 - icon_width);
      max_icon_timestamp = Math.max(max_icon_timestamp, err.timestamp * 1e3 + icon_width);
    }
  }

  min_icon_timestamp = clamp(
    min_icon_timestamp,
    span_space[0] - icon_width,
    span_space[0] + span_space[1] + icon_width
  );
  max_icon_timestamp = clamp(
    max_icon_timestamp,
    span_space[0] - icon_width,
    span_space[0] + span_space[1] + icon_width
  );

  return [min_icon_timestamp, max_icon_timestamp];
}

/**
 * Finds timeline intervals based off the current zoom level.
 */
function computeTimelineIntervals(
  view: TraceView,
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

  let x = Math.ceil(view.trace_view.x / interval) * interval;
  let idx = -1;
  if (x > 0) {
    x -= interval;
  }
  while (x <= view.trace_view.right) {
    results[++idx] = x;
    x += interval;
  }

  while (idx < results.length - 1 && results[idx + 1] !== undefined) {
    results[++idx] = undefined;
  }
}

export class VirtualizedList {
  container: HTMLElement | null = null;

  scrollHeight: number = 0;
  scrollTop: number = 0;

  scrollToRow(index: number, anchor?: ViewManagerScrollAnchor) {
    if (!this.container) {
      return;
    }

    let position = index * 24;

    const top = this.container.scrollTop;
    const height = this.scrollHeight;

    if (anchor === 'top') {
      position = index * 24;
    } else if (anchor === 'center') {
      position = position - height / 2;
    } else if (anchor === 'center if outside') {
      if (position < top) {
        // Element is above the view
        position = position - height / 2;
      } else if (position > top + height) {
        // Element below the view
        position = position - height / 2;
      } else {
        // Element is inside the view
        return;
      }
    } else {
      // If no anchor is provided, we default to 'auto'
      if (position < top) {
        position = position;
      } else if (position > top + height) {
        position = index * 24 - height + 24;
      } else {
        return;
      }
    }

    this.container.scrollTop = position;
    dispatchJestScrollUpdate(this.container);
  }
}

// Jest does not implement scroll updates, however since we have the
// middleware to handle scroll updates, we can dispatch a scroll event ourselves
function dispatchJestScrollUpdate(container: HTMLElement) {
  if (!container) {
    return;
  }
  if (process.env.NODE_ENV !== 'test') {
    return;
  }
  // since we do not tightly control how browsers handle event dispatching, dispatch it async
  window.requestAnimationFrame(() => {
    container.dispatchEvent(new CustomEvent('scroll'));
  });
}
