import {mat3, vec2} from 'gl-matrix';

import {FlamegraphTheme} from '../FlamegraphTheme';
import {Rect, resizeCanvasToDisplaySize} from '../gl/utils';

class CursorRenderer {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;

  theme: FlamegraphTheme;

  constructor(canvas: HTMLCanvasElement, theme: FlamegraphTheme) {
    this.canvas = canvas;
    this.theme = theme;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Could not initialize canvas context for CursorRenderer');
    }

    this.context = ctx;
    resizeCanvasToDisplaySize(canvas);
  }

  draw(configSpaceCursor: vec2, physicalSpace: Rect, configToPhysicalSpace: mat3): void {
    const physicalSpaceCursor = vec2.transformMat3(
      vec2.create(),
      vec2.fromValues(configSpaceCursor[0], configSpaceCursor[1]),
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
