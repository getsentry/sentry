import {mat3} from 'gl-matrix';

import {colorComponentsToRGBA} from 'sentry/utils/profiling/colors/utils';
import {FlamegraphTheme} from 'sentry/utils/profiling/flamegraph/flamegraphTheme';
import {getContext, resizeCanvasToDisplaySize} from 'sentry/utils/profiling/gl/utils';
import {UIFramesRenderer} from 'sentry/utils/profiling/renderers/UIFramesRenderer';
import {Rect} from 'sentry/utils/profiling/speedscope';
import {UIFrames} from 'sentry/utils/profiling/uiFrames';

export class UIFramesRenderer2D extends UIFramesRenderer {
  ctx: CanvasRenderingContext2D | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    uiFrames: UIFrames,
    theme: FlamegraphTheme,
    options: {draw_border: boolean} = {draw_border: false}
  ) {
    super(canvas, uiFrames, theme, options);
    this.initCanvasContext();
  }

  initCanvasContext(): void {
    if (!this.canvas) {
      throw new Error('Cannot initialize context from null canvas');
    }
    // Setup webgl canvas context
    this.ctx = getContext(this.canvas, '2d');

    if (!this.ctx) {
      throw new Error('Could not get canvas 2d context');
    }
    resizeCanvasToDisplaySize(this.canvas);
  }

  draw(configViewToPhysicalSpace: mat3): void {
    if (!this.canvas) {
      throw new Error('No canvas to draw on');
    }

    if (!this.ctx) {
      throw new Error('No canvas context to draw with');
    }

    const border = window.devicePixelRatio;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (const frame of this.uiFrames.frames) {
      const rect = new Rect(frame.start, 0, frame.end - frame.start, 1).transformRect(
        configViewToPhysicalSpace
      );

      this.ctx.fillStyle = colorComponentsToRGBA(this.getColorForFrame(frame.type));
      this.ctx.fillRect(rect.x + border, rect.y, rect.width - border, rect.height);
    }
  }
}
