import type {LineSeriesOption} from 'echarts';

import {createLineSeries} from 'sentry/components/charts/series/lineSeries';

export function createAreaSeries(props: LineSeriesOption = {}): LineSeriesOption {
  return createLineSeries({
    ...props,
  });
}
