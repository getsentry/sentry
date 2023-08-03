import {ColorChannels} from 'sentry/utils/profiling/flamegraph/flamegraphTheme';
import {Rect} from 'sentry/utils/profiling/speedscope';

import {colorComponentsToRGBA} from './colors/utils';
import {makeFormatter} from './units/units';

interface Series {
  fillColor: string;
  lineColor: string;
  points: {x: number; y: number}[];
  type: 'line' | 'area';
}

export class FlamegraphChart {
  configSpace: Rect;
  formatter: ReturnType<typeof makeFormatter>;
  series: Series[];
  domains: {
    x: [number, number];
    y: [number, number];
  } = {
    x: [0, 0],
    y: [0, 0],
  };

  static Empty = new FlamegraphChart(Rect.Empty(), [], [[0, 0, 0, 0]]);

  constructor(
    configSpace: Rect,
    measurements: Profiling.Measurement[],
    colors: ColorChannels[]
  ) {
    this.series = new Array<Series>();

    if (!measurements || !measurements.length) {
      this.formatter = makeFormatter('percent');
      this.configSpace = configSpace.clone();
      return;
    }

    const type = measurements.length > 0 ? 'line' : 'area';

    for (let j = 0; j < measurements.length; j++) {
      const measurement = measurements[j];
      this.series[j] = {
        type,
        lineColor: colorComponentsToRGBA(colors[j]),
        fillColor: colorComponentsToRGBA(colors[j]),
        points: new Array(measurement.values.length).fill(0),
      };

      for (let i = 0; i < measurement.values.length; i++) {
        const m = measurement.values[i];

        // Track and update Y max and min
        if (m.value > this.domains.y[1]) {
          this.domains.y[1] = m.value;
        }
        if (m.value < this.domains.y[0]) {
          this.domains.y[0] = m.value;
        }

        // Track and update X domain max and min
        if (m.elapsed_since_start_ns > this.domains.x[1]) {
          this.domains.x[1] = m.elapsed_since_start_ns;
        }
        if (m.elapsed_since_start_ns < this.domains.x[0]) {
          this.domains.x[1] = m.elapsed_since_start_ns;
        }

        this.series[j].points[i] = {x: m.elapsed_since_start_ns, y: m.value};
      }
    }

    this.series.sort((a, b) => {
      const aAvg = a.points.reduce((acc, point) => acc + point.y, 0) / a.points.length;
      const bAvg = b.points.reduce((acc, point) => acc + point.y, 0) / b.points.length;
      return bAvg - aAvg;
    });

    this.domains.y[1] = 100;
    this.configSpace = configSpace.withHeight(this.domains.y[1] - this.domains.y[0]);
    this.formatter = makeFormatter(measurements[0].unit, 0);
  }
}
