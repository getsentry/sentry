import {RateUnit} from 'sentry/utils/discover/fields';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';

export function TimeSeriesFixture(params: Partial<TimeSeries> = {}): TimeSeries {
  return {
    yAxis: 'eps()',
    meta: {
      valueType: 'rate',
      valueUnit: RateUnit.PER_SECOND,
      interval: 1_800_000, // 30 minutes
    },
    values: [
      {
        value: 7456.966666666666,
        timestamp: 1729796400000, // '2024-10-24T15:00:00-04:00'
      },
      {
        value: 8217.8,
        timestamp: 1729798200000, // '2024-10-24T15:30:00-04:00'
      },
    ],
    ...params,
  };
}
