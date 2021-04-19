import {SessionApiResponse} from 'app/types';
import {Series} from 'app/types/echarts';

type ChartData = Record<string, Series>;

export function getBreakdownChartData({
  response,
  groupBy,
}: {
  response: SessionApiResponse;
  groupBy: string | null;
}): ChartData {
  return response.groups.reduce((groups, group, index) => {
    const seriesName = groupBy ? group.by[groupBy] : index;
    groups[seriesName] = {
      seriesName,
      data: [],
    };
    return groups;
  }, {});
}
