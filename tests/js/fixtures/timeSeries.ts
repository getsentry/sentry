import { RateUnit } from "sentry/utils/discover/fields";
import { TimeSeries } from "sentry/views/dashboards/widgets/common/types";

export function TimeSeriesFixture(params: Partial<TimeSeries> = {}): TimeSeries {
  return {
    field: 'eps()',
    meta: {
      type: 'rate',
      unit: RateUnit.PER_SECOND
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
