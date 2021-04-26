import {SessionApiResponse} from 'app/types';
import {Series} from 'app/types/echarts';

type ChartData = Record<string, Series>;

export function getBreakdownChartData({
  response,
  legend,
  groupBy,
}: {
  response: SessionApiResponse;
  legend: string;
  groupBy?: string;
}): ChartData {
  return response.groups.reduce((groups, group, index) => {
    const key = groupBy ? group.by[groupBy] : index;
    groups[key] = {
      seriesName: legend,
      data: [],
    };
    return groups;
  }, {});
}
