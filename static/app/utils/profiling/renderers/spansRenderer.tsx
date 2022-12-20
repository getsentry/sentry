import {mat3} from 'gl-matrix';

import {Rect, resizeCanvasToDisplaySize} from 'sentry/utils/profiling/gl/utils';
import {SpanChart, SpanChartNode} from 'sentry/utils/profiling/spanChart';

// Convert color component from 0-1 to 0-255 range
function colorComponentsToRgba(color: number[]): string {
  return `rgba(${Math.floor(color[0] * 255)}, ${Math.floor(color[1] * 255)}, ${Math.floor(
    color[2] * 255
  )}, ${color[3] ?? 1})`;
}

export class SpanChartRenderer2D {
  canvas: HTMLCanvasElement | null;
  spanChart: SpanChart;

  spans: ReadonlyArray<SpanChartNode> = [];

  constructor(canvas: HTMLCanvasElement, spanChart: SpanChart) {
    this.canvas = canvas;
    this.spanChart = spanChart;

    this.init();
    resizeCanvasToDisplaySize(this.canvas);
  }

  init() {
    this.spans = [...this.spanChart.spans];
  }

  draw(configViewToPhysicalSpace: mat3) {
    if (!this.canvas) {
      throw new Error('No canvas to draw on');
    }

    const context = this.canvas.getContext('2d');

    if (!context) {
      throw new Error('Could not get canvas 2d context');
    }

    context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const border = window.devicePixelRatio;

    for (let i = 0; i < this.spans.length; i++) {
      const span = this.spans[i];

      const rect = new Rect(
        span.start,
        span.depth,
        span.end - span.start,
        1
      ).transformRect(configViewToPhysicalSpace);

      const colors = [1, 0, 0, 1];
      const color = colorComponentsToRgba(colors);

      context.fillStyle = color;
      context.fillRect(
        rect.x + border,
        rect.y + border,
        rect.width - border,
        rect.height - border
      );
    }
  }
}
