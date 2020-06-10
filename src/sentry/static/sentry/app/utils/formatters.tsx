import {Release} from '@sentry/release-parser';

import {t, tn} from 'app/locale';
import {CommitAuthor, User} from 'app/types';

export function userDisplayName(user: User | CommitAuthor, includeEmail = true): string {
  let displayName = String(user?.name ?? t('Unknown author')).trim();

  if (displayName.length <= 0) {
    displayName = t('Unknown author');
  }

  const email = String(user?.email ?? '').trim();

  if (email.length > 0 && email !== displayName && includeEmail) {
    displayName += ' (' + email + ')';
  }
  return displayName;
}

export const formatVersion = (rawVersion: string, withPackage = false) => {
  try {
    const parsedVersion = new Release(rawVersion);
    const versionToDisplay = parsedVersion.describe();

    if (versionToDisplay.length) {
      return `${versionToDisplay}${
        withPackage && parsedVersion.package ? `, ${parsedVersion.package}` : ''
      }`;
    }

    return rawVersion;
  } catch {
    return rawVersion;
  }
};

function roundWithFixed(
  value: number,
  fixedDigits: number
): {label: string; result: number} {
  const label = value.toFixed(fixedDigits);
  const result = fixedDigits <= 0 ? Math.round(value) : value;

  return {label, result};
}

// in milliseconds
const MS_WEEK = 604800000;
const MS_DAY = 86400000;
const MS_HOUR = 3600000;
const MS_MINUTE = 60000;
const MS_SECOND = 1000;

export function getDuration(
  seconds: number,
  fixedDigits: number = 0,
  abbreviation: boolean = false
): string {
  const value = Math.abs(seconds * 1000);

  if (value >= MS_WEEK) {
    const {label, result} = roundWithFixed(value / MS_WEEK, fixedDigits);
    return `${label} ${abbreviation ? t('wk') : tn('week', 'weeks', result)}`;
  }
  if (value >= 172800000) {
    const {label, result} = roundWithFixed(value / MS_DAY, fixedDigits);
    return `${label} ${abbreviation ? t('d') : tn('day', 'days', result)}`;
  }
  if (value >= 7200000) {
    const {label, result} = roundWithFixed(value / MS_HOUR, fixedDigits);
    return `${label} ${abbreviation ? t('hr') : tn('hour', 'hours', result)}`;
  }
  if (value >= 120000) {
    const {label, result} = roundWithFixed(value / MS_MINUTE, fixedDigits);
    return `${label} ${abbreviation ? t('min') : tn('minute', 'minutes', result)}`;
  }
  if (value >= MS_SECOND) {
    const {label, result} = roundWithFixed(value / MS_SECOND, fixedDigits);
    return `${label} ${abbreviation ? t('s') : tn('second', 'seconds', result)}`;
  }

  const {label} = roundWithFixed(value, fixedDigits);

  return label + t('ms');
}

export function getExactDuration(seconds: number, abbreviation: boolean = false) {
  const convertDuration = (secs: number, abbr: boolean) => {
    const value = Math.abs(secs * 1000);

    const divideBy = (time: number) => {
      return {quotient: Math.floor(value / time), remainder: value % time};
    };

    if (value >= MS_WEEK) {
      const {quotient, remainder} = divideBy(MS_WEEK);

      return `${quotient}${
        abbr ? t('wk') : ` ${tn('week', 'weeks', quotient)}`
      } ${convertDuration(remainder / 1000, abbr)}`;
    }
    if (value >= MS_DAY) {
      const {quotient, remainder} = divideBy(MS_DAY);

      return `${quotient}${
        abbr ? t('d') : ` ${tn('day', 'days', quotient)}`
      } ${convertDuration(remainder / 1000, abbr)}`;
    }
    if (value >= MS_HOUR) {
      const {quotient, remainder} = divideBy(MS_HOUR);

      return `${quotient}${
        abbr ? t('hr') : ` ${tn('hour', 'hours', quotient)}`
      } ${convertDuration(remainder / 1000, abbr)}`;
    }
    if (value >= MS_MINUTE) {
      const {quotient, remainder} = divideBy(MS_MINUTE);

      return `${quotient}${
        abbr ? t('min') : ` ${tn('minute', 'minutes', quotient)}`
      } ${convertDuration(remainder / 1000, abbr)}`;
    }
    if (value >= MS_SECOND) {
      const {quotient, remainder} = divideBy(MS_SECOND);

      return `${quotient}${
        abbr ? t('s') : ` ${tn('second', 'seconds', quotient)}`
      } ${convertDuration(remainder / 1000, abbr)}`;
    }

    if (value === 0) {
      return '';
    }

    return `${value}${abbr ? t('ms') : ` ${tn('millisecond', 'milliseconds', value)}`}`;
  };

  const result = convertDuration(seconds, abbreviation).trim();

  if (result.length) {
    return result;
  }

  return `0${abbreviation ? t('ms') : ` ${t('milliseconds')}`}`;
}

export function formatFloat(number: number, places: number) {
  const multi = Math.pow(10, places);
  return parseInt((number * multi).toString(), 10) / multi;
}

/**
 * Format a value between 0 and 1 as a percentage
 */
export function formatPercentage(value: number, places: number = 2) {
  if (value === 0) {
    return '0%';
  }
  return (value * 100).toFixed(places) + '%';
}

const numberFormats = [
  [1000000000, 'b'],
  [1000000, 'm'],
  [1000, 'k'],
] as const;

export function formatAbbreviatedNumber(number: number | string) {
  number = Number(number);

  let lookup: typeof numberFormats[number];

  // eslint-disable-next-line no-cond-assign
  for (let i = 0; (lookup = numberFormats[i]); i++) {
    const [suffixNum, suffix] = lookup;
    const shortValue = Math.floor(number / suffixNum);
    const fitsBound = number % suffixNum;

    if (shortValue <= 0) {
      continue;
    }

    return shortValue / 10 > 1 || !fitsBound
      ? `${shortValue}${suffix}`
      : `${formatFloat(number / suffixNum, 1)}${suffix}`;
  }

  return number.toLocaleString();
}

export enum Time {
  SECOND = 'second',
  MINUTE = 'minute',
  HOUR = 'hour',
  DAY = 'day',
  WEEK = 'week',
  YEAR = 'year',
}

export const getAbbreviatedTime = (type: Time, time: number) => {
  switch (type) {
    case Time.SECOND:
      return t('%s sec', time);
    case Time.MINUTE:
      return t('%s min', time);
    case Time.HOUR:
      return t('%s hr', time);
    case Time.DAY:
      return t('%s d', time);
    case Time.WEEK:
      return t('%s wk', time);
    case Time.YEAR:
      return t('%s y', time);
    default:
      return '';
  }
};

export function getAbbreviateRelativeTime(milliseconds: number) {
  const seconds = Math.round(milliseconds / 1000);
  const minutes = Math.round(seconds / 60);
  const hours = Math.round(minutes / 60);
  const days = Math.round(hours / 24);
  const weeks = Math.round(days / 7);
  const years = Math.round(weeks / 52);

  const args = ((seconds < 45 && [Time.SECOND, seconds]) ||
    (minutes < 45 && [Time.MINUTE, minutes]) ||
    (hours < 22 && [Time.HOUR, hours]) ||
    (days <= 300 && [Time.DAY, days]) ||
    (weeks <= 52 && [Time.WEEK, weeks]) || [Time.YEAR, years]) as [Time, number];

  return getAbbreviatedTime(args[0], args[1]);
}
