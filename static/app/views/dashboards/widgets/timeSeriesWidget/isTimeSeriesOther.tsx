import type {TimeSeries} from '../common/types';

const OTHER = 'Other';
const otherRegex = new RegExp(`(?:.* : ${OTHER}$)|^${OTHER}$`);

export function isTimeSeriesOther(timeSeries: TimeSeries): boolean {
  return Boolean(timeSeries.field.match(otherRegex));
}
