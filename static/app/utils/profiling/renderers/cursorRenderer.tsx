import {mat3, vec2} from 'gl-matrix';

import {FlamegraphTheme} from '../flamegraph/flamegraphTheme';
import {getContext, Rect, resizeCanvasToDisplaySize} from '../gl/utils';

class CursorRenderer {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;

  theme: FlamegraphTheme;

  constructor(canvas: HTMLCanvasElement, theme: FlamegraphTheme) {
    this.canvas = canvas;
    this.theme = theme;
    this.context = getContext(canvas, '2d');

    resizeCanvasToDisplaySize(canvas);
  }

  draw(configSpaceCursor: vec2, physicalSpace: Rect, configToPhysicalSpace: mat3): void {
    const physicalSpaceCursor = vec2.transformMat3(
      vec2.create(),
      configSpaceCursor,
      configToPhysicalSpace
    );

    this.context.beginPath();
    this.context.moveTo(physicalSpaceCursor[0], 0);
    this.context.lineTo(physicalSpaceCursor[0], physicalSpace.height);

    this.context.moveTo(0, physicalSpaceCursor[1]);
    this.context.lineTo(physicalSpace.width, physicalSpaceCursor[1]);

    this.context.strokeStyle = this.theme.COLORS.CURSOR_CROSSHAIR;
    this.context.stroke();
  }
}

export {CursorRenderer};
