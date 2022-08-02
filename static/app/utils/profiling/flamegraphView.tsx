import {mat3, vec2} from 'gl-matrix';

import {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import {FlamegraphTheme} from 'sentry/utils/profiling/flamegraph/flamegraphTheme';
import {FlamegraphCanvas} from 'sentry/utils/profiling/flamegraphCanvas';
import {computeClampedConfigView, Rect, Transform} from 'sentry/utils/profiling/gl/utils';

export class FlamegraphView {
  flamegraph: Flamegraph;
  theme: FlamegraphTheme;

  configView: Rect = Rect.Empty();
  configSpace: Rect = Rect.Empty();

  constructor({
    canvas,
    flamegraph,
    theme,
  }: {
    canvas: FlamegraphCanvas;
    flamegraph: Flamegraph;
    theme: FlamegraphTheme;
  }) {
    this.flamegraph = flamegraph;
    this.theme = theme;
    this.initConfigSpace(canvas);
  }

  private _initConfigSpace(canvas: FlamegraphCanvas): void {
    const BAR_HEIGHT = this.theme.SIZES.BAR_HEIGHT * window.devicePixelRatio;

    this.configSpace = new Rect(
      0,
      0,
      this.flamegraph.configSpace.width,
      Math.max(
        this.flamegraph.depth + this.theme.SIZES.FLAMEGRAPH_DEPTH_OFFSET + 1,
        canvas.physicalSpace.height / BAR_HEIGHT
      )
    );
  }

  private _initConfigView(canvas: FlamegraphCanvas, space: Rect): void {
    const BAR_HEIGHT = this.theme.SIZES.BAR_HEIGHT * window.devicePixelRatio;

    this.configView = Rect.From(space).withHeight(
      canvas.physicalSpace.height / BAR_HEIGHT
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
        min: this.flamegraph.profile.minFrameDuration,
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
    const toConfigSpace = Transform.transformMatrixBetweenRect(space, this.configSpace);

    if (this.flamegraph.inverted) {
      mat3.multiply(toConfigSpace, this.configSpace.invertYTransform(), toConfigSpace);
    }

    return toConfigSpace;
  }

  toConfigView(space: Rect): mat3 {
    const toConfigView = Transform.transformMatrixBetweenRect(space, this.configView);

    if (this.flamegraph.inverted) {
      mat3.multiply(toConfigView, this.configView.invertYTransform(), toConfigView);
    }

    return toConfigView;
  }

  fromConfigSpace(space: Rect): mat3 {
    const fromConfigSpace = Transform.transformMatrixBetweenRect(this.configSpace, space);

    if (this.flamegraph.inverted) {
      mat3.multiply(fromConfigSpace, space.invertYTransform(), fromConfigSpace);
    }

    return fromConfigSpace;
  }

  fromConfigView(space: Rect): mat3 {
    const fromConfigView = Transform.transformMatrixBetweenRect(this.configView, space);

    if (this.flamegraph.inverted) {
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
