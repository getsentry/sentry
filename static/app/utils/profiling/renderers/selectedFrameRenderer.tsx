import {mat3} from 'gl-matrix';

import {getContext, Rect} from '../gl/utils';

class SelectedFrameRenderer {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.context = getContext(canvas, '2d');
  }

  // We allow for passing of different contexts, this allows us to use a
  // single instance of the renderer to draw overlays on multiple canvases
  draw(
    frame: Rect,
    style: {BORDER_COLOR: string; BORDER_WIDTH: number},
    configViewToPhysicalSpace: mat3,
    context: CanvasRenderingContext2D = this.context
  ): void {
    const frameInPhysicalSpace = frame.transformRect(configViewToPhysicalSpace);

    // We draw the border in the center of the flamegraph, so we need to increase
    // the width by border width and negatively offset it by half the border width
    const borderRect = frameInPhysicalSpace
      .withWidth(frameInPhysicalSpace.width - style.BORDER_WIDTH)
      .withHeight(frameInPhysicalSpace.height - style.BORDER_WIDTH)
      .translate(
        frameInPhysicalSpace.x + style.BORDER_WIDTH / 2,
        frameInPhysicalSpace.y + style.BORDER_WIDTH / 2
      );

    context.beginPath();
    context.strokeStyle = style.BORDER_COLOR;
    context.lineWidth = style.BORDER_WIDTH;
    context.strokeRect(borderRect.x, borderRect.y, borderRect.width, borderRect.height);
  }
}

export {SelectedFrameRenderer};
