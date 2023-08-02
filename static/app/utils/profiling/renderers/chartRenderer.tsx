import {mat3, vec2, vec3} from 'gl-matrix';

import {FlamegraphTheme} from 'sentry/utils/profiling/flamegraph/flamegraphTheme';
import {FlamegraphChart} from 'sentry/utils/profiling/flamegraphChart';
import {getContext, resizeCanvasToDisplaySize} from 'sentry/utils/profiling/gl/utils';
import {Rect} from 'sentry/utils/profiling/speedscope';

function findYIntervals(
  configView: Rect,
  logicalSpaceToConfigView: mat3,
  getInterval: (mat: mat3, x: number) => number
): number[] {
  const target = 20;
  const targetInterval = Math.abs(
    getInterval(logicalSpaceToConfigView, target) - configView.bottom
  );

  const minInterval = Math.pow(10, Math.floor(Math.log10(targetInterval)));
  let interval = minInterval;

  if (targetInterval / interval > 3) {
    interval *= 5;
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

    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (!this.chart.series.length) {
      return;
    }

    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.context.font = `bold 14px ${this.theme.FONTS.FRAME_FONT}`;

    this.context.beginPath();
    this.context.stroke();

    const intervals = findYIntervals(
      configView,
      logicalSpaceToConfigView,
      getIntervalTimeAtY
    );

    this.context.textBaseline = 'bottom';
    this.context.lineWidth = 1;
    const TICK_WIDTH = 14 * window.devicePixelRatio;

    const {left, right} = configView.transformRect(configViewToPhysicalSpace);
    const textOffsetLeft = 2 * window.devicePixelRatio;

    // Draw series
    for (let i = 0; i < this.chart.series.length; i++) {
      this.context.lineWidth = 1;
      this.context.fillStyle = this.chart.series[i].fillColor;
      this.context.strokeStyle = this.chart.series[i].lineColor;
      this.context.beginPath();
      this.context.lineCap = 'round';
      const serie = this.chart.series[i];

      const origin = vec3.fromValues(0, 0, 1);
      vec3.transformMat3(origin, origin, configViewToPhysicalSpace);

      for (let j = 0; j < serie.points.length; j++) {
        const point = serie.points[j];

        const r = vec3.fromValues(point.x, point.y, 1);
        vec3.transformMat3(r, r, configViewToPhysicalSpace);

        if (j === 0) {
          this.context.lineTo(r[0], origin[1]);
        }
        this.context.lineTo(r[0], r[1]);
        if (j === serie.points.length - 1) {
          this.context.lineTo(r[0], origin[1]);
        }
      }

      if (this.chart.series[i].type === 'line') {
        this.context.stroke();
      } else {
        this.context.fill();
      }
    }

    // Draw interval ticks
    this.context.strokeStyle = this.theme.COLORS.CPU_CHART_LABEL_COLOR;
    this.context.fillStyle = this.theme.COLORS.CPU_CHART_LABEL_COLOR;
    for (let i = 0; i < intervals.length; i++) {
      const interval = new Rect(configView.left, intervals[i], 5, 2).transformRect(
        configViewToPhysicalSpace
      );
      const textOffset = interval.height;
      const text = this.chart.formatter(intervals[i]);

      if (i === 0) {
        this.context.textAlign = 'left';
        this.context.fillText(text, left + textOffsetLeft, interval.y - textOffset);
        this.context.textAlign = 'end';
        this.context.fillText(text, right - textOffsetLeft, interval.y - textOffset);
        continue;
      }

      this.context.textAlign = 'left';
      this.context.beginPath();
      this.context.moveTo(left, interval.y);
      this.context.lineTo(left + TICK_WIDTH, interval.y);
      this.context.stroke();

      this.context.fillText(text, left + textOffsetLeft, interval.y - textOffset);

      this.context.textAlign = 'end';
      this.context.beginPath();
      this.context.moveTo(right, interval.y);
      this.context.lineTo(right - TICK_WIDTH, interval.y);
      this.context.stroke();

      this.context.fillText(text, right - textOffsetLeft, interval.y - textOffset);
    }
  }
}
