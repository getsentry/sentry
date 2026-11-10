import type {LineSeriesOption} from 'echarts';

import {createLineSeries} from './lineSeries';

export function createAreaSeries(props: LineSeriesOption = {}): LineSeriesOption {
  return createLineSeries({
    ...props,
  });
}
