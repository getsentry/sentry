import {Rect} from 'sentry/utils/profiling/speedscope';

import {makeFormatter} from './units/units';

export class FlamegraphChart {
  configSpace: Rect;
  formatter: ReturnType<typeof makeFormatter>;
  series: {x: number; y: number}[];

  constructor(measurement: Profiling.Measurement, configSpace?: Rect) {
    this.series = measurement.values.map(c => {
      return {x: c.elapsed_since_start_ns, y: c.value};
    });

    this.configSpace = configSpace ?? Rect.Empty();
    this.formatter = makeFormatter(measurement.unit);
  }
}
