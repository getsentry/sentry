import moment from 'moment';

import {use24Hours} from 'app/utils/dates';
import {defined} from 'app/utils';
import {t} from 'app/locale';

enum TimeAbbreviation {
  SECOND = 'second',
  MINUTE = 'minute',
  HOUR = 'hour',
  DAY = 'day',
  YEAR = 'year',
}

const timeFormat = 'HH:mm:ss';
const timeDateFormat = `ll ${timeFormat}`;

const getTimeShortString = (type: TimeAbbreviation, time: number) => {
  switch (type) {
    case TimeAbbreviation.SECOND:
      return t('%s sec', time);
    case TimeAbbreviation.MINUTE:
      return t('%s min', time);
    case TimeAbbreviation.HOUR:
      return t('%s hr', time);
    case TimeAbbreviation.DAY:
      return t('%s d', time);
    case TimeAbbreviation.YEAR:
      return t('%s y', time);
    default:
      return '';
  }
};

const getShortRelativeTime = (milliseconds: number) => {
  const seconds = Math.round(milliseconds / 1000);
  const minutes = Math.round(seconds / 60);
  const hours = Math.round(minutes / 60);
  const days = Math.round(hours / 24);
  const years = Math.round(days / 365);

  const args = ((seconds < 45 && [TimeAbbreviation.SECOND, seconds]) ||
    (minutes < 45 && [TimeAbbreviation.MINUTE, minutes]) ||
    (hours < 22 && [TimeAbbreviation.HOUR, hours]) ||
    (days <= 300 && [TimeAbbreviation.DAY, days]) || [TimeAbbreviation.YEAR, years]) as [
    TimeAbbreviation,
    number
  ];

  return getTimeShortString(args[0], args[1]);
};

const getRelativeTime = (
  parsedTime: ReturnType<typeof moment>,
  parsedTimeToCompareWith: ReturnType<typeof moment>,
  displayRelativeTime?: boolean
) => {
  // ll is necessary here, otherwise moment(x).from will throw an error
  const formattedTime = moment(parsedTime.format(timeDateFormat));
  const formattedTimeToCompareWith = parsedTimeToCompareWith.format(timeDateFormat);
  const timeDiff = Math.abs(formattedTime.diff(formattedTimeToCompareWith));
  const shortRelativeTime = getShortRelativeTime(timeDiff);

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
