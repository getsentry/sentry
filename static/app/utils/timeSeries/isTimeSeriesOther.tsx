import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';

const OTHER = 'Other';
const otherRegex = new RegExp(`(?:.* : ${OTHER}$)|^${OTHER}$`);

export function isTimeSeriesOther(timeSeries: TimeSeries): boolean {
  return Boolean(timeSeries.field.match(otherRegex));
}
