import moment from 'moment';

export function getDaysSinceDatePrecise(date: string) {
  const dateWithTime = moment(date).utc();
  return moment().utc().diff(dateWithTime, 'days', true);
}

export default function getDaysSinceDate(date: string) {
  const dateWithTime = moment(date).utc().startOf('day');
  return moment().utc().startOf('day').diff(dateWithTime, 'days');
}
