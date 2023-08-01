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

    const colors = {0: 'red', 25: 'orange', 50: 'yellow', 75: 'green', 100: 'blue'};
    for (const h of [0, 25, 50, 75, 100]) {
      this.context.strokeStyle = colors[h] ?? 'red';
      const r = new Rect(0, h, 1, 1).transformRect(configViewToPhysicalSpace);

      this.context.beginPath();
      this.context.moveTo(0, r.y);
      this.context.lineTo(this.canvas.width, Math.round(r.y));
      this.context.stroke();
      // this.context.fillText(h.toString(), this.canvas.width / 2, Math.round(r.y));
    }

    // @TODO draw series
    for (let i = 0; i < this.chart.series.length; i++) {
      this.context.strokeStyle = `black`;
      this.context.beginPath();
      const serie = this.chart.series[i];

      for (let j = 0; j < serie.points.length; j++) {
        const point = serie.points[j];
        const r = new Rect(point.x, point.y, 1, 1).transformRect(
          configViewToPhysicalSpace
        );
        this.context.lineTo(r.x, r.y);
      }

      this.context.stroke();
    }
  }
}
