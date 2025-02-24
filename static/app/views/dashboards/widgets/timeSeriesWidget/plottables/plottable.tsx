import type {SeriesOption} from 'echarts';

import type {TimeSeries} from '../../common/types';

export abstract class Plottable<TOptions> {
  constructor(timeSeries: TimeSeries, options: TOptions) {
    this.timeSeries = timeSeries;
    this.options = options;
  }

  timeSeries: TimeSeries;
  options: TOptions;

  abstract toSeries(): SeriesOption[];
}
