import type {mat3} from 'gl-matrix';

import {getContext} from 'sentry/utils/profiling/gl/utils';
import type {Rect} from 'sentry/utils/profiling/speedscope';

class SelectedFrameRenderer {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.context = getContext(canvas, '2d');
  }

  draw(
    frames: Rect[],
    style: {BORDER_COLOR: string; BORDER_WIDTH: number},
    configViewToPhysicalSpace: mat3
  ): void {
    this.context.strokeStyle = style.BORDER_COLOR;
    this.context.lineWidth = style.BORDER_WIDTH;

    for (const frame of frames) {
      const frameInPhysicalSpace = frame.transformRect(configViewToPhysicalSpace);

      this.context.beginPath();

      // We draw the border in the center of the flamegraph, so we need to decrease
      // the width by border width and negatively offset it by half the border width
      this.context.strokeRect(
        frameInPhysicalSpace.x + style.BORDER_WIDTH,
        frameInPhysicalSpace.y + style.BORDER_WIDTH,
        frameInPhysicalSpace.width - style.BORDER_WIDTH * 2,
        frameInPhysicalSpace.height - style.BORDER_WIDTH * 2
      );
    }
  }
}

export {SelectedFrameRenderer};
