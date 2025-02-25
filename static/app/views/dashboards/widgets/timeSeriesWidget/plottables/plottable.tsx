import type {SeriesOption} from 'echarts';

import type {TimeSeries} from '../../common/types';

export abstract class Plottable<TOptions> {
  series: SeriesOption[];

  constructor(timeSeries: TimeSeries, options: TOptions) {
    this.series = this.toSeries(timeSeries, options);
  }

  abstract toSeries(timeSeries: TimeSeries, options: TOptions): SeriesOption[];
}
