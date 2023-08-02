import {mat3, vec2} from 'gl-matrix';

import {FlamegraphTheme} from 'sentry/utils/profiling/flamegraph/flamegraphTheme';
import {FlamegraphChart} from 'sentry/utils/profiling/flamegraphChart';
import {getContext, resizeCanvasToDisplaySize} from 'sentry/utils/profiling/gl/utils';
import {Rect} from 'sentry/utils/profiling/speedscope';

function findYIntervals(
  configView: Rect,
  logicalSpaceToConfigView: mat3,
  getInterval: (mat: mat3, x: number) => number
): number[] {
  const target = 30;
  const targetInterval = Math.abs(
    getInterval(logicalSpaceToConfigView, target) - configView.bottom
  );

  const minInterval = Math.pow(10, Math.floor(Math.log10(targetInterval)));
  let interval = minInterval;

  if (targetInterval / interval > 5) {
    interval *= 3;
  } else if (targetInterval / interval > 2) {
    interval *= 2;
  }

  let x = Math.ceil(configView.top / interval) * interval;
  const intervals: number[] = [];

  while (x <= configView.bottom) {
    intervals.push(x);
    x += interval;
  }

  return intervals;
}

function getIntervalTimeAtY(logicalSpaceToConfigView: mat3, y: number): number {
  const vector = logicalSpaceToConfigView[4] * y + logicalSpaceToConfigView[7];

  if (vector > 1) {
    return Math.round(vector);
  }

  return Math.round(vector * 10) / 10;
}

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
    configView: Rect,
    _configSpace: Rect,
    _physicalSpace: Rect,
    configViewToPhysicalSpace: mat3,
    logicalSpaceToConfigView: mat3
  ) {
    if (!this.canvas) {
      throw new Error('No canvas to draw on');
    }

    if (!this.chart.series.length) {
      return;
    }

    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Helper lines for dev
    this.context.font = '18px sans-serif';

    this.context.beginPath();
    this.context.stroke();

    const intervals = findYIntervals(
      configView,
      logicalSpaceToConfigView,
      getIntervalTimeAtY
    );

    this.context.textBaseline = 'bottom';
    this.context.strokeStyle = this.theme.COLORS.LABEL_FONT_COLOR;
    this.context.fillStyle = this.theme.COLORS.LABEL_FONT_COLOR;
    this.context.lineWidth = 1 * window.devicePixelRatio;

    for (let i = 0; i < intervals.length; i++) {
      const interval = new Rect(configView.left, intervals[i], 5, 1).transformRect(
        configViewToPhysicalSpace
      );

      this.context.textAlign = 'start';
      this.context.beginPath();
      this.context.moveTo(configView.left, interval.y);
      this.context.lineTo(configView.left + 12 * window.devicePixelRatio, interval.y);
      this.context.stroke();

      this.context.fillText(
        intervals[i].toString(),
        configView.left + 2 * window.devicePixelRatio,
        interval.y
      );

      this.context.textAlign = 'end';
      this.context.beginPath();
      this.context.moveTo(configView.right, interval.y);
      this.context.lineTo(configView.right - 12 * window.devicePixelRatio, interval.y);
      this.context.stroke();

      this.context.fillText(
        intervals[i].toString(),
        configView.right + window.devicePixelRatio + 4,
        interval.y
      );
    }

    // @TODO draw series
    for (let i = 0; i < this.chart.series.length; i++) {
      this.context.lineWidth = 1 * window.devicePixelRatio;
      this.context.fillStyle = this.chart.series[i].fillColor;
      this.context.strokeStyle = this.chart.series[i].lineColor;
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

      if (this.chart.series[i].type === 'line') {
        this.context.stroke();
      } else {
        this.context.fill();
      }
    }
  }
}
