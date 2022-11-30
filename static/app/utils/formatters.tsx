import {Release} from '@sentry/release-parser';
import round from 'lodash/round';

import {t, tn} from 'sentry/locale';
import {CommitAuthor, User} from 'sentry/types';

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
export const MONTH = 2629800000;
export const WEEK = 604800000;
export const DAY = 86400000;
export const HOUR = 3600000;
export const MINUTE = 60000;
export const SECOND = 1000;

export function getDuration(
  seconds: number,
  fixedDigits: number = 0,
  abbreviation: boolean = false,
  extraShort: boolean = false
): string {
  // value in milliseconds
  const msValue = seconds * 1000;
  const value = Math.abs(msValue);

  if (value >= MONTH && !extraShort) {
    const {label, result} = roundWithFixed(msValue / MONTH, fixedDigits);
    return `${label}${abbreviation ? t('mo') : ` ${tn('month', 'months', result)}`}`;
  }

  if (value >= WEEK) {
    const {label, result} = roundWithFixed(msValue / WEEK, fixedDigits);
    if (extraShort) {
      return `${label}${t('w')}`;
    }
    if (abbreviation) {
      return `${label}${t('wk')}`;
    }
    return `${label} ${tn('week', 'weeks', result)}`;
  }

  if (value >= DAY) {
    const {label, result} = roundWithFixed(msValue / DAY, fixedDigits);
    return `${label}${
      abbreviation || extraShort ? t('d') : ` ${tn('day', 'days', result)}`
    }`;
  }

  if (value >= HOUR) {
    const {label, result} = roundWithFixed(msValue / HOUR, fixedDigits);
    if (extraShort) {
      return `${label}${t('h')}`;
    }
    if (abbreviation) {
      return `${label}${t('hr')}`;
    }
    return `${label} ${tn('hour', 'hours', result)}`;
  }

  if (value >= MINUTE) {
    const {label, result} = roundWithFixed(msValue / MINUTE, fixedDigits);
    if (extraShort) {
      return `${label}${t('m')}`;
    }
    if (abbreviation) {
      return `${label}${t('min')}`;
    }
    return `${label} ${tn('minute', 'minutes', result)}`;
  }

  if (value >= SECOND) {
    const {label, result} = roundWithFixed(msValue / SECOND, fixedDigits);
    if (extraShort || abbreviation) {
      return `${label}${t('s')}`;
    }
    return `${label} ${tn('second', 'seconds', result)}`;
  }

  const {label} = roundWithFixed(msValue, fixedDigits);

  return label + t('ms');
}

export function getExactDuration(seconds: number, abbreviation: boolean = false) {
  const convertDuration = (secs: number, abbr: boolean): string => {
    // value in milliseconds
    const msValue = round(secs * 1000);
    const value = round(Math.abs(secs * 1000));

    const divideBy = (time: number) => {
      return {
        quotient: msValue < 0 ? Math.ceil(msValue / time) : Math.floor(msValue / time),
        remainder: msValue % time,
      };
    };

    if (value >= WEEK) {
      const {quotient, remainder} = divideBy(WEEK);

      return `${quotient}${
        abbr ? t('wk') : ` ${tn('week', 'weeks', quotient)}`
      } ${convertDuration(remainder / 1000, abbr)}`;
    }
    if (value >= DAY) {
      const {quotient, remainder} = divideBy(DAY);

      return `${quotient}${
        abbr ? t('d') : ` ${tn('day', 'days', quotient)}`
      } ${convertDuration(remainder / 1000, abbr)}`;
    }
    if (value >= HOUR) {
      const {quotient, remainder} = divideBy(HOUR);

      return `${quotient}${
        abbr ? t('hr') : ` ${tn('hour', 'hours', quotient)}`
      } ${convertDuration(remainder / 1000, abbr)}`;
    }
    if (value >= MINUTE) {
      const {quotient, remainder} = divideBy(MINUTE);

      return `${quotient}${
        abbr ? t('min') : ` ${tn('minute', 'minutes', quotient)}`
      } ${convertDuration(remainder / 1000, abbr)}`;
    }
    if (value >= SECOND) {
      const {quotient, remainder} = divideBy(SECOND);

      return `${quotient}${
        abbr ? t('s') : ` ${tn('second', 'seconds', quotient)}`
      } ${convertDuration(remainder / 1000, abbr)}`;
    }

    if (value === 0) {
      return '';
    }

    return `${msValue}${abbr ? t('ms') : ` ${tn('millisecond', 'milliseconds', value)}`}`;
  };

  const result = convertDuration(seconds, abbreviation).trim();

  if (result.length) {
    return result;
  }

  return `0${abbreviation ? t('ms') : ` ${t('milliseconds')}`}`;
}

export function formatSecondsToClock(
  seconds: number,
  {padAll}: {padAll: boolean} = {padAll: true}
) {
  if (seconds === 0 || isNaN(seconds)) {
    return padAll ? '00:00' : '0:00';
  }

  const divideBy = (msValue: number, time: number) => {
    return {
      quotient: msValue < 0 ? Math.ceil(msValue / time) : Math.floor(msValue / time),
      remainder: msValue % time,
    };
  };

  // value in milliseconds
  const absMSValue = round(Math.abs(seconds * 1000));

  const {quotient: hours, remainder: rMins} = divideBy(absMSValue, HOUR);
  const {quotient: minutes, remainder: rSeconds} = divideBy(rMins, MINUTE);
  const {quotient: secs, remainder: milliseconds} = divideBy(rSeconds, SECOND);

  const fill = (num: number) => (num < 10 ? `0${num}` : String(num));

  const parts = hours
    ? [padAll ? fill(hours) : hours, fill(minutes), fill(secs)]
    : [padAll ? fill(minutes) : minutes, fill(secs)];

  return milliseconds ? `${parts.join(':')}.${milliseconds}` : parts.join(':');
}

export function parseClockToSeconds(clock: string) {
  const [rest, milliseconds] = clock.split('.');
  const parts = rest.split(':');

  let seconds = 0;
  const progression = [MONTH, WEEK, DAY, HOUR, MINUTE, SECOND].slice(parts.length * -1);
  for (let i = 0; i < parts.length; i++) {
    const num = Number(parts[i]) || 0;
    const time = progression[i] / 1000;
    seconds += num * time;
  }
  const ms = Number(milliseconds) || 0;
  return seconds + ms / 1000;
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
  return (
    round(value * 100, places).toLocaleString(undefined, {
      maximumFractionDigits: places,
    }) + '%'
  );
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
