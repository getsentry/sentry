import {Moment} from 'moment';

import {datetimeToClickhouseFilterTimestamps} from 'sentry/views/starfish/utils/dates';

export const getDateQueryFilter = (startTime: Moment, endTime: Moment) => {
  const {start_timestamp, end_timestamp} = datetimeToClickhouseFilterTimestamps({
    start: startTime.format('YYYY-MM-DD HH:mm:ss'),
    end: endTime.format('YYYY-MM-DD HH:mm:ss'),
  });
  return `
  ${start_timestamp ? `AND greaterOrEquals(start_timestamp, '${start_timestamp}')` : ''}
  ${end_timestamp ? `AND lessOrEquals(start_timestamp, '${end_timestamp}')` : ''}
  `;
};
