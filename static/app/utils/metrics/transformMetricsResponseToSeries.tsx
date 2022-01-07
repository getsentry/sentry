import moment from 'moment';

import {MetricsApiResponse} from 'sentry/types';
import {Series} from 'sentry/types/echarts';

type Arguments = {
  response: MetricsApiResponse | null;
  fields: string[];
  seriesNames?: string[];
};

export function transformMetricsResponseToSeries({
  response,
  fields,
  seriesNames,
}: Arguments): Series[] {
  return [
    {
      seriesName: seriesNames?.[0] ?? fields[0],
      data:
        response?.intervals.map((interval, index) => {
          return {
            name: moment(interval).valueOf(),
            value: response.groups[0].series[fields[0]][index] ?? 0,
          };
        }) ?? [],
    },
  ];
}
