import {SessionApiResponse} from 'app/types';
import {Series} from 'app/types/echarts';

type ChartData = Record<string, Series>;

function getSerieNameByGroups(
  groupByKeys: string[],
  groupBy: Record<string, string | number>
) {
  return groupByKeys.map(groupByKey => groupBy[groupByKey]).join('_');
}

export function getBreakdownChartData({
  response,
  sessionResponseIndex,
  legend,
}: {
  response: SessionApiResponse;
  sessionResponseIndex: number;
  legend?: string;
}): ChartData {
  return response.groups.reduce((groups, group, index) => {
    const groupByKeys = Object.keys(group.by);

    if (!groupByKeys.length) {
      groups[index] = {
        seriesName: legend ?? `Query ${sessionResponseIndex}`,
        data: [],
      };
      return groups;
    }

    const serieNameByGroups = getSerieNameByGroups(groupByKeys, group.by);

    groups[serieNameByGroups] = {
      seriesName: legend ? `${legend}_${serieNameByGroups}` : serieNameByGroups,
      data: [],
    };

    return groups;
  }, {});
}

type FillChartDataFromMetricsResponse = {
  response: SessionApiResponse;
  field: string;
  chartData: ChartData;
  valueFormatter?: (value: number) => number;
};

export function fillChartDataFromMetricsResponse({
  response,
  field,
  chartData,
  valueFormatter,
}: FillChartDataFromMetricsResponse) {
  response.intervals.forEach((interval, index) => {
    for (const groupsIndex in response.groups) {
      const group = response.groups[groupsIndex];
      const groupByKeys = Object.keys(group.by);
      const value = group.series[field][index];

      if (!groupByKeys.length) {
        chartData[0].data.push({
          name: interval,
          value: typeof valueFormatter === 'function' ? valueFormatter(value) : value,
        });
        return;
      }

      const serieNameByGroups = getSerieNameByGroups(groupByKeys, group.by);

      chartData[serieNameByGroups].data.push({
        name: interval,
        value: typeof valueFormatter === 'function' ? valueFormatter(value) : value,
      });
    }
  });

  return chartData;
}
