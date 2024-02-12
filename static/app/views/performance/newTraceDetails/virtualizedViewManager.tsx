const DIVIDER_WIDTH = 6;

type ViewColumn = {
  column_refs: HTMLDivElement[];
  width: number;
};

/**
 * Tracks the state of the virtualized view and manages the resizing of the columns.
 * Children components should call `registerColumnRef` and `registerDividerRef` to register
 * their respective refs.
 */
export class VirtualizedViewManager {
  width: number = 0;

  container: HTMLDivElement | null = null;
  dividerRef: HTMLDivElement | null = null;
  resizeObserver: ResizeObserver | null = null;

  dividerStartVec: [number, number] | null = null;

  columns: {
    list: ViewColumn;
    span_list: ViewColumn;
  };

  constructor(columns: {
    list: ViewColumn;
    span_list: ViewColumn;
  }) {
    this.columns = columns;

    this.onDividerMouseDown = this.onDividerMouseDown.bind(this);
    this.onDividerMouseUp = this.onDividerMouseUp.bind(this);
    this.onDividerMouseMove = this.onDividerMouseMove.bind(this);
  }

  onContainerRef(container: HTMLDivElement | null) {
    if (container) {
      this.initialize(container);
    } else {
      this.teardown();
    }
  }

  registerDividerRef(ref: HTMLDivElement | null) {
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

    this.dividerRef.style.transform = `translateX(${
      this.width * (this.columns.list.width + distancePercentage) - DIVIDER_WIDTH / 2
    }px)`;

    const listWidth = this.columns.list.width * 100 + distancePercentage * 100 + '%';
    const spanWidth = this.columns.span_list.width * 100 - distancePercentage * 100 + '%';
    for (let i = 0; i < this.columns.list.column_refs.length; i++) {
      this.columns.list.column_refs[i].style.width = listWidth;
      this.columns.span_list.column_refs[i].style.width = spanWidth;
    }
  }

  registerColumnRef(column: string, ref: HTMLDivElement | null, index: number) {
    if (!ref) {
      return;
    }

    if (!this.columns[column]) {
      throw new TypeError('Invalid column');
    }

    this.columns[column].column_refs[index] = ref;
  }

  initialize(container: HTMLDivElement) {
    this.teardown();

    this.container = container;
    this.resizeObserver = new ResizeObserver(entries => {
      const entry = entries[0];
      if (!entry) {
        throw new Error('ResizeObserver entry is undefined');
      }

      this.width = entry.contentRect.width;

      if (this.dividerRef) {
        this.dividerRef.style.transform = `translateX(${
          this.width * this.columns.list.width - DIVIDER_WIDTH / 2
        }px)`;
      }
    });

    this.resizeObserver.observe(container);
  }

  teardown() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }
}
