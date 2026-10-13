import type {Series} from 'sentry/types/echarts';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';

export type IssuesSeriesResponse = {
  timeSeries: TimeSeries[];
  meta?: {
    dataset: string;
    end: number;
    start: number;
  };
};

export function transformIssuesResponseToSeries(data: IssuesSeriesResponse): Series[] {
  return data.timeSeries.map(timeSeries => ({
    seriesName: timeSeries.yAxis,
    data: timeSeries.values.map(item => ({
      name: item.timestamp,
      value: item.value ?? 0,
    })),
  }));
}
