import {mat3, vec2} from 'gl-matrix';

import {Rect, Transform} from 'sentry/utils/profiling/gl/utils';

export class FlamegraphCanvas {
  canvas: HTMLCanvasElement;
  origin: vec2;

  physicalSpace: Rect = Rect.Empty();
  logicalSpace: Rect = Rect.Empty();

  physicalToLogicalSpace: mat3 = mat3.create();
  logicalToPhysicalSpace: mat3 = mat3.create();

  constructor(canvas: HTMLCanvasElement, origin: vec2) {
    this.canvas = canvas;
    this.origin = origin;
    this.initPhysicalSpace();
  }

  initPhysicalSpace() {
    this.physicalSpace = new Rect(
      this.origin[0],
      this.origin[1],
      this.canvas.width - this.origin[0],
      this.canvas.height - this.origin[1]
    );

    this.logicalSpace = this.physicalSpace.scale(
      1 / window.devicePixelRatio,
      1 / window.devicePixelRatio
    );

    this.logicalToPhysicalSpace = Transform.transformMatrixBetweenRect(
      this.logicalSpace,
      this.physicalSpace
    );

    this.physicalToLogicalSpace = Transform.transformMatrixBetweenRect(
      this.physicalSpace,
      this.logicalSpace
    );
  }
}
