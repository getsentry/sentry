import {getDiffInMinutes, DateTimeObject} from 'app/components/charts/utils';

// In minutes
const FOURTEEN_DAYS = 20160;

export function getInterval(datetimeObj: DateTimeObject) {
  const diffInMinutes = getDiffInMinutes(datetimeObj);

  if (diffInMinutes > FOURTEEN_DAYS) {
    return '6h';
  } else {
    return '1h';
  }
}
