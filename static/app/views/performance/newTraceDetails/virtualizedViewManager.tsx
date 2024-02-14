import clamp from 'sentry/utils/number/clamp';
import type {TraceTreeNode} from 'sentry/views/performance/newTraceDetails/traceTree';

const DIVIDER_WIDTH = 6;

type ViewColumn = {
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

  container: HTMLElement | null = null;
  dividerRef: HTMLElement | null = null;
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

  span_bars: ({ref: HTMLElement; space: [number, number]} | undefined)[] = [];

  constructor(columns: {
    list: Omit<ViewColumn, 'translate'>;
    span_list: Omit<ViewColumn, 'translate'>;
  }) {
    this.columns = {
      list: {...columns.list, translate: [0, 0]},
      span_list: {...columns.span_list, translate: [0, 0]},
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

  registerDividerRef(ref: HTMLElement | null) {
    if (!ref) {
      if (this.dividerRef) {
        this.dividerRef.removeEventListener('mousedown', this.onDividerMouseDown);
      }
      this.dividerRef = null;
      return;
    }

    this.dividerRef = ref;
    this.dividerRef.style.width = `${DIVIDER_WIDTH}px`;
    this.dividerRef.style.transform = `translateX(${
      this.width * (this.columns.list.width - (2 * DIVIDER_WIDTH) / this.width)
    }px)`;

    ref.addEventListener('mousedown', this.onDividerMouseDown, {passive: true});
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
    if (!this.dividerStartVec || !this.dividerRef) {
      return;
    }

    const distance = event.clientX - this.dividerStartVec[0];
    const distancePercentage = distance / this.width;

    this.computeSpanDrawMatrix(
      this.width,
      this.columns.span_list.width - distancePercentage
    );

    this.dividerRef.style.transform = `translateX(${
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
        span_bar.ref.style.transform = this.computeSpanMatrixTransform(span_bar.space);
      }
    }
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
  }

  scrollSyncRaf: number | null = null;
  onSyncedScrollbarScroll(event: WheelEvent) {
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

  initialize(container: HTMLElement) {
    this.teardown();

    this.container = container;
    this.resizeObserver = new ResizeObserver(entries => {
      const entry = entries[0];
      if (!entry) {
        throw new Error('ResizeObserver entry is undefined');
      }

      this.width = entry.contentRect.width;
      this.computeSpanDrawMatrix(this.width, this.columns.span_list.width);

      if (this.dividerRef) {
        this.dividerRef.style.transform = `translateX(${
          this.width * this.columns.list.width - DIVIDER_WIDTH / 2
        }px)`;
      }
    });

    this.resizeObserver.observe(container);
  }

  initializeSpanSpace(spanSpace: [number, number], spanView?: [number, number]) {
    this.spanSpace = [...spanSpace];
    this.spanView = spanView ?? [...spanSpace];

    this.computeSpanDrawMatrix(this.width, this.columns.span_list.width);
  }

  computeSpanDrawMatrix(width: number, span_column_width: number): Matrix2D {
    // https://developer.mozilla.org/en-US/docs/Web/CSS/transform-function/matrix
    // biome-ignore format: off
    const mat3: Matrix2D = [
      1, 0, 0,
      1, 0, 0,
    ];

    if (this.spanSpace[1] === 0 || this.spanView[1] === 0) {
      return mat3;
    }

    const spanColumnWidth = width * span_column_width;
    const viewToSpace = this.spanSpace[1] / this.spanView[1];
    const physicalToView = spanColumnWidth / this.spanView[1];

    mat3[0] = viewToSpace * physicalToView;

    this.spanScalingFactor = viewToSpace;
    this.minSpanScalingFactor = window.devicePixelRatio / this.width;
    this.spanDrawMatrix = mat3;
    return mat3;
  }

  computeSpanMatrixTransform(span_space: [number, number]): string {
    const scale = Math.max(
      this.minSpanScalingFactor,
      (span_space[1] / this.spanView[1]) * this.spanScalingFactor
    );

    const x = span_space[0] - this.spanView[0];
    const translateInPixels = x * this.spanDrawMatrix[0];

    return `matrix(${scale},0,0,1,${translateInPixels},0)`;
  }

  draw() {}

  teardown() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }
}

class RowMeasurer {
  cache: Map<TraceTreeNode<any>, number> = new Map();
  elements: HTMLElement[] = [];

  measureQueue: [TraceTreeNode<any>, HTMLElement][] = [];
  drainRaf: number | null = null;
  max: number = 0;

  enqueueMeasure(node: TraceTreeNode<any>, element: HTMLElement) {
    if (this.cache.has(node)) {
      return;
    }

    this.measureQueue.push([node, element]);

    if (this.drainRaf !== null) {
      window.cancelAnimationFrame(this.drainRaf);
    }
    this.drainRaf = window.requestAnimationFrame(() => {
      this.drain();
    });
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
