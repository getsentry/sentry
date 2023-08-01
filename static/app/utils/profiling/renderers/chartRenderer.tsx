import {mat3, vec2} from 'gl-matrix';

import {FlamegraphTheme} from 'sentry/utils/profiling/flamegraph/flamegraphTheme';
import {FlamegraphChart} from 'sentry/utils/profiling/flamegraphChart';
import {getContext, resizeCanvasToDisplaySize} from 'sentry/utils/profiling/gl/utils';
import {Rect} from 'sentry/utils/profiling/speedscope';

export class FlamegraphChartRenderer {
  canvas: HTMLCanvasElement | null;
  chart: FlamegraphChart;
  context: CanvasRenderingContext2D;
  theme: FlamegraphTheme;

  constructor(canvas: HTMLCanvasElement, chart: FlamegraphChart, theme: FlamegraphTheme) {
    this.canvas = canvas;
    this.chart = chart;
    this.theme = theme;

    this.context = getContext(this.canvas, '2d');
    resizeCanvasToDisplaySize(this.canvas);
  }

  findHoveredNode(_configSpaceCursor: vec2): void {
    // @TODO binary search for closes value
  }

  draw(
    _configView: Rect,
    _configSpace: Rect,
    _physicalSpace: Rect,
    configViewToPhysicalSpace: mat3
  ) {
    if (!this.canvas) {
      throw new Error('No canvas to draw on');
    }

    if (!this.chart.series.length) {
      return;
    }

    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Helper lines for dev
    this.context.font = '16px sans-serif';

    this.context.beginPath();
    this.context.stroke();
    this.context.lineWidth = 1 * window.devicePixelRatio;

    // @TODO draw series
    for (let i = 0; i < this.chart.series.length; i++) {
      this.context.strokeStyle = this.theme.COLORS.SELECTED_FRAME_BORDER_COLOR;
      this.context.beginPath();
      this.context.lineCap = 'round';
      const serie = this.chart.series[i];

      const origin = new Rect(0, 0, 1, 1).transformRect(configViewToPhysicalSpace);

      for (let j = 0; j < serie.points.length; j++) {
        const point = serie.points[j];
        const r = new Rect(point.x, point.y, 1, 1).transformRect(
          configViewToPhysicalSpace
        );
        if (j === 0) {
          this.context.lineTo(r.x, origin.y);
        }
        this.context.lineTo(r.x, r.y);
        if (j === serie.points.length - 1) {
          this.context.lineTo(r.x, origin.y);
        }
      }

      this.context.fillStyle = 'rgba(0, 0, 255, 0.2)';
      this.context.stroke();
      this.context.fill();
    }
  }
}
