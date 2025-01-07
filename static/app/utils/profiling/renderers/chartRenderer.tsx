import type {mat3, vec2} from 'gl-matrix';
import {vec3} from 'gl-matrix';

import type {FlamegraphTheme} from 'sentry/utils/profiling/flamegraph/flamegraphTheme';
import type {FlamegraphChart} from 'sentry/utils/profiling/flamegraphChart';
import {
  getContext,
  lowerBound,
  resizeCanvasToDisplaySize,
  upperBound,
} from 'sentry/utils/profiling/gl/utils';
import type {Rect} from 'sentry/utils/profiling/speedscope';

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

  if (targetInterval / interval > 3) {
    interval *= 3;
  }

  if (targetInterval / interval > 2) {
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

function binaryFindNearest(
  serie: FlamegraphChart['series'][0],
  target: number,
  tolerance: number
): number | null {
  if (!serie.points.length) {
    return null;
  }
  if (target < serie.points[0]!.x) {
    return null;
  }
  if (target > serie.points[serie.points.length - 1]!.x) {
    return null;
  }

  let left = 0;
  let right = serie.points.length - 1;

  while (left <= right) {
    const mid = Math.floor(left + (right - left) / 2);
    const point = serie.points[mid]!;

    if (Math.abs(point.x - target) < tolerance) {
      return mid;
    }
    if (point.x < target) {
      left = mid + 1;
    }
    if (point.x > target) {
      right = mid - 1;
    }
  }

  return null;
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

  findHoveredSeries(
    _configSpaceCursor: vec2,
    tolerance: number
  ): FlamegraphChart['series'] {
    const matches: FlamegraphChart['series'] = [];
    for (let i = 0; i < this.chart.series.length; i++) {
      const index = binaryFindNearest(
        this.chart.series[i]!,
        _configSpaceCursor[0],
        tolerance
      );

      if (index !== null) {
        matches.push({
          name: this.chart.series[i]!.name,
          type: this.chart.series[i]!.type,
          lineColor: this.chart.series[i]!.lineColor,
          fillColor: this.chart.series[i]!.fillColor,
          points: [this.chart.series[i]!.points[index]!],
        });
      }
    }

    return matches;
  }

  draw(
    configView: Rect,
    configViewToPhysicalSpace: mat3,
    logicalSpaceToConfigView: mat3,
    configSpaceCursorRef: React.RefObject<vec2 | null>
  ) {
    if (!this.canvas) {
      throw new Error('No canvas to draw on');
    }

    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (!this.chart.series.length) {
      return;
    }

    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.context.font = `bold ${
      this.theme.SIZES.METRICS_FONT_SIZE * window.devicePixelRatio
    }px ${this.theme.FONTS.FRAME_FONT}`;

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
    const origin = vec3.fromValues(0, 0, 1);
    const space = vec3.fromValues(configView.width, configView.height, 1);
    vec3.transformMat3(origin, origin, configViewToPhysicalSpace);
    vec3.transformMat3(space, space, configViewToPhysicalSpace);

    // Draw series
    for (let i = 0; i < this.chart.series.length; i++) {
      this.context.lineWidth = 1 * window.devicePixelRatio;
      this.context.fillStyle = this.chart.series[i]!.fillColor;
      this.context.strokeStyle = this.chart.series[i]!.lineColor;
      this.context.lineCap = 'round';
      this.context.beginPath();
      const serie = this.chart.series[i]!;

      let start = lowerBound(configView.left, serie.points, a => a.x);
      let end = upperBound(configView.right, serie.points, a => a.x);

      // Bounds are inclusive, so we adjust start and end by 1. This ensures we
      // draw the previous/next line that goes outside of bounds.
      // If we dont do this, the chart looks like | -- | instead of |----|
      if (start > 0) {
        start = start - 1;
      }
      if (end < serie.points.length) {
        end = end + 1;
      }

      for (let j = start; j < end; j++) {
        const point = serie.points[j]!;

        const r = vec3.fromValues(point.x, point.y, 1);
        vec3.transformMat3(r, r, configViewToPhysicalSpace);

        if (serie.type === 'area' && j === start) {
          this.context.lineTo(r[0], origin[1]);
        }
        this.context.lineTo(r[0], r[1]);
        if (serie.type === 'area' && j === end - 1) {
          this.context.lineTo(r[0], origin[1]);
        }

        // Enable to see dots drawn for each point
        // this.context.arc(r[0], r[1], 2, 0, 2 * Math.PI);
      }

      if (this.chart.series[i]!.type === 'line') {
        this.context.stroke();
      } else {
        this.context.fill();
      }
    }

    // Draw interval ticks
    this.context.strokeStyle = this.theme.COLORS.CHART_LABEL_COLOR;
    this.context.fillStyle = this.theme.COLORS.CHART_LABEL_COLOR;
    let lastIntervalTxt: string | undefined = undefined;
    for (let i = 0; i < intervals.length; i++) {
      const interval = vec3.fromValues(configView.left, intervals[i]!, 1);
      const text = this.chart.formatter(intervals[i]!);

      if (text === lastIntervalTxt) {
        continue;
      }

      lastIntervalTxt = text;

      vec3.transformMat3(interval, interval, configViewToPhysicalSpace);

      if (i === 0) {
        this.context.textAlign = 'left';
        this.context.fillText(text, left + textOffsetLeft, interval[1]);
        this.context.textAlign = 'end';
        this.context.fillText(text, right - textOffsetLeft, interval[1]);
        continue;
      }

      this.context.textAlign = 'left';
      this.context.beginPath();
      this.context.moveTo(left, interval[1]);
      this.context.lineTo(left + TICK_WIDTH, interval[1]);
      this.context.stroke();

      this.context.fillText(text, left + textOffsetLeft, interval[1]);

      this.context.textAlign = 'end';
      this.context.beginPath();
      this.context.moveTo(right, interval[1]);
      this.context.lineTo(right - TICK_WIDTH, interval[1]);
      this.context.stroke();

      this.context.fillText(text, right - textOffsetLeft, interval[1]);
    }

    if (configSpaceCursorRef.current) {
      const cursor = vec3.fromValues(
        configSpaceCursorRef.current[0],
        configSpaceCursorRef.current[1],
        1
      );

      vec3.transformMat3(cursor, cursor, configViewToPhysicalSpace);
      this.context.beginPath();
      this.context.strokeStyle = this.theme.COLORS.CHART_CURSOR_INDICATOR;
      this.context.moveTo(cursor[0], origin[1]);
      this.context.lineTo(cursor[0], space[1]);
      this.context.stroke();
    }
  }
}
