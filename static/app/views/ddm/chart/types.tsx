import type {BaseChartProps} from 'sentry/components/charts/baseChart';
import type {DateString} from 'sentry/types';
import type {MetricDisplayType} from 'sentry/utils/metrics/types';

export type Series = {
  color: string;
  data: {name: number; value: number}[];
  id: string;
  seriesName: string;
  unit: string;
  groupBy?: Record<string, string>;
  hidden?: boolean;
  paddingIndices?: Set<number>;
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

export interface CombinedMetricChartProps extends BaseChartProps {
  displayType: MetricDisplayType;
  series: Series[];
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
