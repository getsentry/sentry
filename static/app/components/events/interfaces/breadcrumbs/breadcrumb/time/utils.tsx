import moment from 'moment';

import {t} from 'sentry/locale';
import {getDuration} from 'sentry/utils/formatters';

const timeFormat = 'HH:mm:ss';
const timeDateFormat = `ll ${timeFormat}`;

const getRelativeTime = (
  parsedTime: ReturnType<typeof moment>,
  parsedTimeToCompareWith: ReturnType<typeof moment>,
  displayRelativeTime?: boolean
) => {
  // ll is necessary here, otherwise moment(x).from will throw an error
  const formattedTime = moment(parsedTime.format(timeDateFormat));
  const formattedTimeToCompareWith = parsedTimeToCompareWith.format(timeDateFormat);
  const timeDiff = Math.abs(formattedTime.diff(formattedTimeToCompareWith));

  const shortRelativeTime = getDuration(Math.round(timeDiff / 1000), 0, true).replace(
    /\s/g,
    ''
  );

  if (timeDiff !== 0) {
    return displayRelativeTime
      ? `-${shortRelativeTime}`
      : t('%s before', shortRelativeTime);
  }

  return `\xA0${shortRelativeTime}`;
};

export function getFormattedTimestamp(
  timestamp: string,
  relativeTimestamp: string,
  displayRelativeTime?: boolean
) {
  const parsedTimestamp = moment(timestamp);
  const date = parsedTimestamp.format('ll');

  const relativeTime = getRelativeTime(
    parsedTimestamp,
    moment(relativeTimestamp),
    displayRelativeTime
  );

  const timeWithMilliseconds = parsedTimestamp.format(`${timeFormat}:SSS z`);

  if (!displayRelativeTime) {
    return {
      date,
      timeWithMilliseconds,
      time: relativeTime,
      displayTime: parsedTimestamp.format(timeFormat),
    };
  }

  return {
    date,
    timeWithMilliseconds,
    displayTime: relativeTime,
  };
}
