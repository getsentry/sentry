import moment from 'moment';

export default function getDaysSinceDate(date: string) {
  const dateWithTime = moment(date).utc().startOf('day');
  return moment().utc().startOf('day').diff(dateWithTime, 'days');
}
