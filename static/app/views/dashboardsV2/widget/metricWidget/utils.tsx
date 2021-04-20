import {SessionApiResponse} from 'app/types';
import {Series} from 'app/types/echarts';

type ChartData = Record<string, Series>;

export function getBreakdownChartData({
  response,
  sessionResponseIndex,
  groupBy,
  legend,
}: {
  response: SessionApiResponse;
  sessionResponseIndex: number;
  groupBy: string[];
  legend?: string;
}): ChartData {
  return response.groups.reduce((groups, group, index) => {
    if (!groupBy.length) {
      groups[index] = {
        seriesName: legend ?? `Query ${sessionResponseIndex}`,
        data: [],
      };
      return groups;
    }

    for (const groupByIndex in groupBy) {
      const groupByName = group.by[groupBy[groupByIndex]];
      const seriesName = legend ? `${legend} - ${groupByName}` : groupByName;
      groups[groupByName] = {seriesName, data: []};
    }

    return groups;
  }, {});
}

type FillChartDataFromMetricsResponse = {
  response: SessionApiResponse;
  field: string;
  chartData: ChartData;
  groupBy: string[];
  valueFormatter?: (value: number) => number;
};

export function fillChartDataFromMetricsResponse({
  response,
  field,
  groupBy,
  chartData,
  valueFormatter,
}: FillChartDataFromMetricsResponse) {
  response.intervals.forEach((interval, index) => {
    response.groups.forEach(group => {
      const value = group.series[field][index];
      if (!groupBy.length) {
        chartData[0].data.push({
          name: interval,
          value: typeof valueFormatter === 'function' ? valueFormatter(value) : value,
        });
      } else {
        for (const groupByIndex in groupBy) {
          chartData[group.by[groupBy[groupByIndex]]].data.push({
            name: interval,
            value: typeof valueFormatter === 'function' ? valueFormatter(value) : value,
          });
        }
      }
    });
  });

  return chartData;
}
