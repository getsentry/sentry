import {mat3, vec2} from 'gl-matrix';

import {FlamegraphCanvas} from 'sentry/utils/profiling/flamegraphCanvas';
import {
  computeClampedConfigView,
  Rect,
  transformMatrixBetweenRect,
} from 'sentry/utils/profiling/gl/utils';

export class CanvasView<T extends {configSpace: Rect}> {
  configView: Rect = Rect.Empty();
  configSpace: Readonly<Rect> = Rect.Empty();

  inverted: boolean;
  minWidth: number;
  depthOffset: number;
  barHeight: number;
  model: T;

  constructor({
    canvas,
    options,
    model,
  }: {
    canvas: FlamegraphCanvas;
    model: T;
    options: {
      barHeight: number;
      depthOffset?: number;
      inverted?: boolean;
      minWidth?: number;
    };
  }) {
    this.inverted = !!options.inverted;
    this.minWidth = options.minWidth ?? 0;
    this.model = model;
    this.depthOffset = options.depthOffset ?? 0;
    this.barHeight = options.barHeight ? options.barHeight * window.devicePixelRatio : 0;
    this.initConfigSpace(canvas);
  }

  private _initConfigSpace(canvas: FlamegraphCanvas): void {
    this.configSpace = new Rect(
      0,
      0,
      this.model.configSpace.width,
      Math.max(
        this.model.configSpace.height + this.depthOffset,
        canvas.physicalSpace.height / this.barHeight
      )
    );
  }

  private _initConfigView(canvas: FlamegraphCanvas, space: Rect): void {
    this.configView = Rect.From(space).withHeight(
      canvas.physicalSpace.height / this.barHeight
    );
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

  setConfigView(configView: Rect) {
    this.configView = computeClampedConfigView(configView, {
      width: {
        min: this.minWidth,
        max: this.configSpace.width,
      },
      height: {
        min: 0,
        max: this.configSpace.height,
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
}
