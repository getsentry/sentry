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

  static Empty = new FlamegraphChart(Rect.Empty(), {unit: 'percent', values: []}, [
    [0, 0, 0, 0],
  ]);

  constructor(
    configSpace: Rect,
    measurement: Profiling.Measurement,
    colors: ColorChannels[]
  ) {
    this.series = new Array<Series>();

    if (!measurement || !measurement.values.length) {
      this.formatter = makeFormatter('percent');
      this.configSpace = configSpace.clone();
      return;
    }

    this.series[0] = {
      type: 'area',
      lineColor: colorComponentsToRGBA(colors[0]),
      fillColor: colorComponentsToRGBA(colors[0]),
      points: new Array(measurement.values.length),
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

      this.series[0].points[i] = {x: m.elapsed_since_start_ns, y: m.value};
    }

    this.domains.y[1] = 100;
    this.configSpace = configSpace.withHeight(this.domains.y[1] - this.domains.y[0]);

    this.formatter = makeFormatter(measurement.unit, 0);
  }
}
