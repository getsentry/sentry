import moment from 'moment';

import {use24Hours} from 'app/utils/dates';
import {defined} from 'app/utils';
import {t} from 'app/locale';
import {getDuration} from 'app/utils/formatters';

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

const getAbsoluteTimeFormat = (format: string) => {
  if (use24Hours()) {
    return format;
  }
  return `${format} A`;
};

const getFormattedTimestamp = (
  timestamp: string,
  relativeTimestamp: string,
  displayRelativeTime?: boolean
) => {
  const parsedTimestamp = moment(timestamp);
  const date = parsedTimestamp.format('ll');

  const displayMilliSeconds = defined(parsedTimestamp.milliseconds());

  const relativeTime = getRelativeTime(
    parsedTimestamp,
    moment(relativeTimestamp),
    displayRelativeTime
  );

  if (!displayRelativeTime) {
    return {
      date: `${date} ${parsedTimestamp.format(getAbsoluteTimeFormat('HH:mm'))}`,
      time: relativeTime,
      displayTime: parsedTimestamp.format(timeFormat),
    };
  }

  return {
    date,
    time: parsedTimestamp.format(
      getAbsoluteTimeFormat(displayMilliSeconds ? `${timeFormat}.SSS` : timeFormat)
    ),
    displayTime: relativeTime,
  };
};

export {getFormattedTimestamp};
