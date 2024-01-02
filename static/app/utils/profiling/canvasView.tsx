import {mat3, vec2} from 'gl-matrix';

import {FlamegraphCanvas} from 'sentry/utils/profiling/flamegraphCanvas';
import {
  computeClampedConfigView,
  transformMatrixBetweenRect,
} from 'sentry/utils/profiling/gl/utils';
import {Rect} from 'sentry/utils/profiling/speedscope';

export class CanvasView<T extends {configSpace: Rect}> {
  configView: Rect = Rect.Empty();
  configSpace: Readonly<Rect> = Rect.Empty();
  configSpaceTransform: mat3 = mat3.create();

  inverted: boolean;

  minWidth: number;
  maxHeight: number;
  minHeight: number;

  depthOffset: number;
  barHeight: number;

  model: T;
  canvas: FlamegraphCanvas;
  mode: 'anchorTop' | 'anchorBottom' | 'stretchToFit' = 'anchorTop';

  constructor({
    canvas,
    options,
    model,
    mode,
  }: {
    canvas: FlamegraphCanvas;
    model: T;
    options: {
      barHeight: number;
      configSpaceTransform?: Rect;
      depthOffset?: number;
      inverted?: boolean;
      maxHeight?: number;
      minHeight?: number;
      minWidth?: number;
    };
    mode?: CanvasView<T>['mode'];
  }) {
    this.mode = mode || this.mode;
    this.inverted = !!options.inverted;
    this.minWidth = options.minWidth ?? 0;

    this.maxHeight = options.maxHeight ?? 0;
    this.minHeight = options.minHeight ?? 0;

    this.model = model;
    this.canvas = canvas;
    this.depthOffset = options.depthOffset ?? 0;
    this.barHeight = options.barHeight ? options.barHeight * window.devicePixelRatio : 1;

    // This is a transformation matrix that is applied to the configView, it allows us to
    // transform an entire view and render it without having to recompute the models.
    // This is useful for example when we want to offset a profile by some duration.
    this.configSpaceTransform = options.configSpaceTransform
      ? mat3.fromValues(
          options.configSpaceTransform.width || 1,
          0,
          0,
          0,
          options.configSpaceTransform.height || 1,
          0,
          options.configSpaceTransform.x || 0,
          options.configSpaceTransform.y || 0,
          1
        )
      : mat3.create();

    this.initConfigSpace(canvas);
  }

  setMinWidth(minWidth: number) {
    if (minWidth < 0) {
      throw new Error('View min width cannot be negative');
    }
    this.minWidth = minWidth;
  }

  isViewAtTopEdgeOf(space: Rect): boolean {
    return this.inverted
      ? space.bottom === this.configView.bottom
      : space.top === this.configView.top;
  }

  isViewAtBottomEdgeOf(space: Rect): boolean {
    return this.inverted
      ? space.top === this.configView.top
      : space.bottom === this.configView.bottom;
  }

  private _initConfigSpace(canvas: FlamegraphCanvas): void {
    switch (this.mode) {
      case 'stretchToFit': {
        this.configSpace = new Rect(
          0,
          0,
          this.model.configSpace.width,
          this.model.configSpace.height + this.depthOffset
        );
        return;
      }
      case 'anchorBottom':
      case 'anchorTop':
      default: {
        this.configSpace = new Rect(
          0,
          0,
          this.model.configSpace.width,
          this.maxHeight ||
            Math.max(
              this.model.configSpace.height + this.depthOffset,
              canvas.physicalSpace.height / this.barHeight
            )
        );
      }
    }
  }

  private _initConfigView(canvas: FlamegraphCanvas, space: Rect): void {
    switch (this.mode) {
      case 'stretchToFit': {
        this.setConfigView(Rect.From(space));
        return;
      }
      case 'anchorBottom': {
        const newHeight = this.maxHeight || canvas.physicalSpace.height / this.barHeight;
        const newY = Math.max(0, Math.ceil(space.y - (newHeight - space.height)));
        this.setConfigView(Rect.From(space).withHeight(newHeight).withY(newY));
        return;
      }
      case 'anchorTop': {
        this.setConfigView(
          Rect.From(space).withHeight(
            this.maxHeight || canvas.physicalSpace.height / this.barHeight
          )
        );
        return;
      }
      default:
        throw new Error(`Unknown CanvasView mode: ${this.mode}`);
    }
  }

  initConfigSpace(canvas: FlamegraphCanvas): void {
    this._initConfigSpace(canvas);
    this._initConfigView(canvas, this.configSpace);
  }

  resizeConfigSpace(canvas: FlamegraphCanvas): void {
    this._initConfigSpace(canvas);
    this._initConfigView(canvas, this.configView);
  }

  resetConfigView(canvas: FlamegraphCanvas): void {
    this._initConfigView(canvas, this.configSpace);
  }

  setConfigView(
    configView: Rect,
    overrides?: {
      width: {max?: number; min?: number};
      height?: {max?: number; min?: number};
    }
  ) {
    this.configView = computeClampedConfigView(configView, {
      width: {
        min: this.minWidth,
        max: this.configSpace.width,
        ...(overrides?.width ?? {}),
      },
      height: {
        min: this.minHeight,
        max: this.configSpace.height,
        ...(overrides?.height ?? {}),
      },
    });
  }

  transformConfigView(transformation: mat3) {
    this.setConfigView(this.configView.transformRect(transformation));
  }

  toConfigSpace(space: Rect): mat3 {
    const toConfigSpace = transformMatrixBetweenRect(space, this.configSpace);

    if (this.inverted) {
      mat3.multiply(toConfigSpace, this.configSpace.invertYTransform(), toConfigSpace);
    }

    return toConfigSpace;
  }

  toConfigView(space: Rect): mat3 {
    const toConfigView = transformMatrixBetweenRect(space, this.configView);

    if (this.inverted) {
      mat3.multiply(toConfigView, this.configView.invertYTransform(), toConfigView);
    }

    return toConfigView;
  }

  fromConfigSpace(space: Rect): mat3 {
    const fromConfigSpace = transformMatrixBetweenRect(this.configSpace, space);

    if (this.inverted) {
      mat3.multiply(fromConfigSpace, space.invertYTransform(), fromConfigSpace);
    }

    return fromConfigSpace;
  }

  fromConfigView(space: Rect): mat3 {
    const fromConfigView = transformMatrixBetweenRect(this.configView, space);

    if (this.inverted) {
      mat3.multiply(fromConfigView, space.invertYTransform(), fromConfigView);
    }

    return fromConfigView;
  }

  fromTransformedConfigView(space: Rect): mat3 {
    const fromConfigView = mat3.multiply(
      mat3.create(),
      transformMatrixBetweenRect(this.configView, space),
      this.configSpaceTransform
    );

    if (this.inverted) {
      mat3.multiply(fromConfigView, space.invertYTransform(), fromConfigView);
    }

    return fromConfigView;
  }

  fromTransformedConfigSpace(space: Rect): mat3 {
    const fromConfigView = mat3.multiply(
      mat3.create(),
      transformMatrixBetweenRect(this.configSpace, space),
      this.configSpaceTransform
    );

    if (this.inverted) {
      mat3.multiply(fromConfigView, space.invertYTransform(), fromConfigView);
    }

    return fromConfigView;
  }

  getConfigSpaceCursor(logicalSpaceCursor: vec2, canvas: FlamegraphCanvas): vec2 {
    const physicalSpaceCursor = vec2.transformMat3(
      vec2.create(),
      logicalSpaceCursor,
      canvas.logicalToPhysicalSpace
    );

    return vec2.transformMat3(
      vec2.create(),
      physicalSpaceCursor,
      this.toConfigSpace(canvas.physicalSpace)
    );
  }

  getTransformedConfigSpaceCursor(
    logicalSpaceCursor: vec2,
    canvas: FlamegraphCanvas
  ): vec2 {
    const physicalSpaceCursor = vec2.transformMat3(
      vec2.create(),
      logicalSpaceCursor,
      canvas.logicalToPhysicalSpace
    );

    const finalMatrix = mat3.multiply(
      mat3.create(),
      mat3.invert(mat3.create(), this.configSpaceTransform),
      this.toConfigSpace(canvas.physicalSpace)
    );

    const configViewCursor = vec2.transformMat3(
      vec2.create(),
      physicalSpaceCursor,
      finalMatrix
    );

    return configViewCursor;
  }

  getConfigViewCursor(logicalSpaceCursor: vec2, canvas: FlamegraphCanvas): vec2 {
    const physicalSpaceCursor = vec2.transformMat3(
      vec2.create(),
      logicalSpaceCursor,
      canvas.logicalToPhysicalSpace
    );

    return vec2.transformMat3(
      vec2.create(),
      physicalSpaceCursor,
      this.toConfigView(canvas.physicalSpace)
    );
  }

  getTransformedConfigViewCursor(
    logicalSpaceCursor: vec2,
    canvas: FlamegraphCanvas
  ): vec2 {
    const physicalSpaceCursor = vec2.transformMat3(
      vec2.create(),
      logicalSpaceCursor,
      canvas.logicalToPhysicalSpace
    );

    const finalMatrix = mat3.multiply(
      mat3.create(),
      mat3.invert(mat3.create(), this.configSpaceTransform),
      this.toConfigView(canvas.physicalSpace)
    );

    const configViewCursor = vec2.transformMat3(
      vec2.create(),
      physicalSpaceCursor,
      finalMatrix
    );

    return configViewCursor;
  }

  /**
   * Applies the inverse of the config space transform to the given config space rect
   * @returns Rect
   */
  toOriginConfigView(space: Rect): Rect {
    return space.transformRect(mat3.invert(mat3.create(), this.configSpaceTransform));
  }
}
