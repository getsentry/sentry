import type {LineSeriesOption} from 'echarts';

import {lineSeries} from 'sentry/components/charts/series/lineSeries';

export function AreaSeries(props: LineSeriesOption = {}): LineSeriesOption {
  return lineSeries({
    ...props,
  });
}
