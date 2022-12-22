import {mat3} from 'gl-matrix';

import {
  getContext,
  Rect,
  resizeCanvasToDisplaySize,
} from 'sentry/utils/profiling/gl/utils';
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

  context: CanvasRenderingContext2D;
  spans: ReadonlyArray<SpanChartNode> = [];

  constructor(canvas: HTMLCanvasElement, spanChart: SpanChart) {
    this.canvas = canvas;
    this.spanChart = spanChart;

    this.spans = [...this.spanChart.spans];
    this.context = getContext(this.canvas, '2d');

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

    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (let i = 0; i < this.spans.length; i++) {
      const span = this.spans[i];

      const color = colorComponentsToRgba([
        Math.random(),
        Math.random(),
        Math.random(),
        1,
      ]);

      this.context.fillStyle = color;
      const rect = new Rect(span.start, span.depth, span.duration, 1).transformRect(
        configViewToPhysicalSpace
      );

      this.context.fillRect(rect.x, rect.y, rect.width, rect.height);
    }
  }
}
