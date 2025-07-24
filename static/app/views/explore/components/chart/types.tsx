import type {Confidence} from 'sentry/types/organization';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import type {SamplingMode} from 'sentry/views/explore/hooks/useProgressiveQuery';
import {ChartType} from 'sentry/views/insights/common/components/chart';
import type {useSortedTimeSeries} from 'sentry/views/insights/common/queries/useSortedTimeSeries';

export interface ChartInfo {
  chartType: ChartType;
  series: TimeSeries[];
  timeseriesResult: ReturnType<typeof useSortedTimeSeries>;
  yAxis: string;
  confidence?: Confidence;
  dataScanned?: 'full' | 'partial';
  isSampled?: boolean | null;
  sampleCount?: number;
  samplingMode?: SamplingMode;
}
