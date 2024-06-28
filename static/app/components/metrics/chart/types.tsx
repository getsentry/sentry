import type {MarkLineComponentOption, SeriesOption} from 'echarts';

import type {BaseChartProps} from 'sentry/components/charts/baseChart';
import type {DateString} from 'sentry/types/core';
import type {MetricAggregation} from 'sentry/types/metrics';
import type {MetricDisplayType} from 'sentry/utils/metrics/types';

export type Series = {
  aggregate: MetricAggregation;
  color: string;
  data: {name: number; value: number}[];
  id: string;
  seriesName: string;
  total: number;
  unit: string;
  groupBy?: Record<string, string>;
  hidden?: boolean;
  isEquationSeries?: boolean;
  markLine?: MarkLineComponentOption;
  paddingIndices?: Set<number>;
  queryIndex?: number;
  release?: string;
  scalingFactor?: number;
  stack?: string;
  transaction?: string;
};

export interface ScatterSeries extends Series {
  itemStyle: {
    color: string;
    opacity: number;
  };
  symbol: string;
  symbolSize: number;
  z: number;
}

export interface CombinedMetricChartProps
  extends Omit<BaseChartProps, 'series' | 'additionalSeries'> {
  displayType: MetricDisplayType;
  series: Series[];
  additionalSeries?: SeriesOption[];
  enableZoom?: boolean;
  scatterSeries?: ScatterSeries[];
}

export interface SelectionRange {
  end?: DateString;
  max?: number;
  min?: number;
  start?: DateString;
}

export interface FocusAreaSelection {
  range: SelectionRange;
  widgetIndex: number;
}
