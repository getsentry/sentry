import {mat3} from 'gl-matrix';

import clamp from 'sentry/utils/number/clamp';

// Computes the transformation matrix that is used to render scaled
// elements to the DOM and draw the view.

export class TraceView {
  // Represents the space of the entire trace, for example
  // a trace starting at 0 and ending at 1000 would have a space of [0, 1000]
  to_origin: number = 0;
  trace_space: DOMView = DOMView.Empty();
  // The view defines what the user is currently looking at, it is a subset
  // of the trace space. For example, if the user is currently looking at the
  // trace from 500 to 1000, the view would be represented by [x, width] = [500, 500]
  trace_view: DOMView = DOMView.Empty();
  // Represents the pixel space of the entire trace - this is the container
  // that we render to. For example, if the container is 1000px wide, the
  // pixel space would be [0, 1000]
  trace_physical_space: DOMView = DOMView.Empty();
  // the encapsulating container that the entire view is rendered to
  trace_container_physical_space: DOMView = DOMView.Empty();

  span_to_px: mat3 = mat3.create();

  private readonly MAX_ZOOM_PRECISION_MS = 1;
  private readonly span_matrix: [number, number, number, number, number, number] = [
    1, 0, 0, 1, 0, 0,
  ];

  initConfigSpace() {
    this.trace_space = new DOMView(0, 0, this.to_origin, 1);
  }

  // @todo: both init methods should recompute intervals
  initTraceSpace(space: [x: number, y: number, width: number, height: number]) {
    this.to_origin = space[0];

    this.trace_space = new DOMView(0, 0, space[2], space[3]);
    this.trace_view = new DOMView(0, 0, space[2], space[3]);

    this.recomputeSpanToPxMatrix();
  }

  initPhysicalSpace(container_width: number, container_height: number) {
    this.trace_container_physical_space = new DOMView(
      0,
      0,
      container_width,
      container_height
    );
    this.trace_physical_space = new DOMView(0, 0, container_width, container_height);

    this.recomputeSpanToPxMatrix();
  }

  setTraceView(view: {width?: number; x?: number}) {
    // In cases where a trace might have a single error, there is no concept of a timeline
    if (this.trace_view.width === 0) {
      return;
    }

    const x = view.x ?? this.trace_view.x;
    const width = view.width ?? this.trace_view.width;

    this.trace_view.width = clamp(
      width,
      this.MAX_ZOOM_PRECISION_MS,
      this.trace_space.width - this.trace_view.x
    );
    this.trace_view.x = clamp(
      x,
      0,
      Math.max(this.trace_space.width - width, this.MAX_ZOOM_PRECISION_MS)
    );

    this.recomputeSpanToPxMatrix();
  }

  updateTraceSpace(start: number, width: number) {
    if (this.trace_space.width === width && this.to_origin === start) {
      return;
    }

    this.to_origin = start;

    // If view is scaled all the way out, then lets update it to match the new space, else
    // we are implicitly zooming in, which may be even more confusing.
    const preventImplicitZoom = this.trace_view.width === this.trace_space.width;
    this.trace_space = new DOMView(0, 0, width, 1);
    if (preventImplicitZoom) {
      this.setTraceView({x: 0, width});
    }

    this.recomputeSpanToPxMatrix();
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

  computeSpanCSSMatrixTransform(
    space: [number, number]
  ): [number, number, number, number, number, number] {
    const scale = space[1] / this.trace_view.width;
    this.span_matrix[0] = Math.max(scale, this.span_to_px[0] / this.trace_view.width);
    this.span_matrix[4] =
      (space[0] - this.to_origin) / this.span_to_px[0] -
      this.trace_view.x / this.span_to_px[0];

    return this.span_matrix;
  }

  transformXFromTimestamp(timestamp: number): number {
    return (timestamp - this.to_origin - this.trace_view.x) / this.span_to_px[0];
  }

  getConfigSpaceCursor(cursor: {x: number; y: number}): [number, number] {
    const left_percentage = cursor.x / this.trace_physical_space.width;
    const left_view = left_percentage * this.trace_view.width;

    return [this.trace_view.x + left_view, 0];
  }
}

/**
 * Helper class that handles computing transformations between different views to and from DOM space
 */
class DOMView {
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

  static From(view: DOMView): DOMView {
    return new DOMView(view.x, view.y, view.width, view.height);
  }
  static Empty(): DOMView {
    return new DOMView(0, 0, 1000, 1);
  }

  serialize() {
    return [this.x, this.y, this.width, this.height];
  }

  between(to: DOMView): mat3 {
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
