import {Release} from '@sentry/release-parser';
import round from 'lodash/round';

import {t, tn} from 'sentry/locale';
import {CommitAuthor, User} from 'sentry/types';
import {RATE_UNIT_LABELS, RateUnits} from 'sentry/utils/discover/fields';

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

export const isSemverRelease = (rawVersion: string): boolean => {
  try {
    const parsedVersion = new Release(rawVersion);
    return !!parsedVersion.versionParsed;
  } catch {
    return false;
  }
};

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

/**
 * Returns a human redable duration rounded to the largest unit.
 *
 * e.g. 2 days, or 3 months, or 25 seoconds
 *
 * Use `getExactDuration` for exact durations
 */
export function getDuration(
  seconds: number,
  fixedDigits: number = 0,
  abbreviation: boolean = false,
  extraShort: boolean = false,
  absolute: boolean = false
): string {
  const absValue = Math.abs(seconds * 1000);

  // value in milliseconds
  const msValue = absolute ? absValue : seconds * 1000;

  if (absValue >= MONTH && !extraShort) {
    const {label, result} = roundWithFixed(msValue / MONTH, fixedDigits);
    return `${label}${abbreviation ? t('mo') : ` ${tn('month', 'months', result)}`}`;
  }

  if (absValue >= WEEK) {
    const {label, result} = roundWithFixed(msValue / WEEK, fixedDigits);
    if (extraShort) {
      return `${label}${t('w')}`;
    }
    if (abbreviation) {
      return `${label}${t('wk')}`;
    }
    return `${label} ${tn('week', 'weeks', result)}`;
  }

  if (absValue >= DAY) {
    const {label, result} = roundWithFixed(msValue / DAY, fixedDigits);

    if (extraShort || abbreviation) {
      return `${label}${t('d')}`;
    }
    return `${label} ${tn('day', 'days', result)}`;
  }

  if (absValue >= HOUR) {
    const {label, result} = roundWithFixed(msValue / HOUR, fixedDigits);
    if (extraShort) {
      return `${label}${t('h')}`;
    }
    if (abbreviation) {
      return `${label}${t('hr')}`;
    }
    return `${label} ${tn('hour', 'hours', result)}`;
  }

  if (absValue >= MINUTE) {
    const {label, result} = roundWithFixed(msValue / MINUTE, fixedDigits);
    if (extraShort) {
      return `${label}${t('m')}`;
    }
    if (abbreviation) {
      return `${label}${t('min')}`;
    }
    return `${label} ${tn('minute', 'minutes', result)}`;
  }

  if (absValue >= SECOND) {
    const {label, result} = roundWithFixed(msValue / SECOND, fixedDigits);
    if (extraShort || abbreviation) {
      return `${label}${t('s')}`;
    }
    return `${label} ${tn('second', 'seconds', result)}`;
  }

  const {label, result} = roundWithFixed(msValue, fixedDigits);

  if (extraShort || abbreviation) {
    return `${label}${t('ms')}`;
  }

  return `${label} ${tn('millisecond', 'milliseconds', result)}`;
}

type Level = [number, string];
const SECS_IN_WKS = 604800;
const SECS_IN_DAYS = 86400;
const SECS_IN_HRS = 3600;
const SECS_IN_MIN = 60;
const MS_IN_S = 1000;

/**
 * Translates seconds into human readable format of seconds, minutes, hours, days, and years
 * e.g. 1 hour 25 minutes 15 seconds
 *
 * NOTE: seconds input can be a provided as a decimal
 * @param  seconds      The number of seconds to be processed
 * @param  abbreviation abbreviates the suffix
 * @param  minDuration  pins the response to desired suffix
 * @return {string}     The phrase describing the amount of time
 */
export function getExactDuration(
  seconds: number,
  abbreviation: boolean = false,
  minDuration: string = 'milliseconds'
) {
  const operation = seconds < 0 ? Math.ceil : Math.floor;
  const levels: Level[] = [
    [operation(seconds / SECS_IN_WKS), abbreviation ? 'wk' : ' weeks'],
    [operation((seconds % SECS_IN_WKS) / SECS_IN_DAYS), abbreviation ? 'd' : ' days'],
    [
      operation(((seconds % SECS_IN_WKS) % SECS_IN_DAYS) / SECS_IN_HRS),
      abbreviation ? 'hr' : ' hours',
    ],
    [
      operation((((seconds % SECS_IN_WKS) % SECS_IN_DAYS) % SECS_IN_HRS) / SECS_IN_MIN),
      abbreviation ? 'min' : ' minutes',
    ],
    [
      operation((((seconds % SECS_IN_WKS) % SECS_IN_DAYS) % SECS_IN_HRS) % SECS_IN_MIN),
      abbreviation ? 's' : ' seconds',
    ],
    [
      operation(
        (((((seconds * MS_IN_S) % (SECS_IN_WKS * MS_IN_S)) % (SECS_IN_DAYS * MS_IN_S)) %
          (SECS_IN_HRS * MS_IN_S)) %
          (SECS_IN_MIN * MS_IN_S)) %
          MS_IN_S
      ),
      abbreviation ? 'ms' : ' milliseconds',
    ],
  ];
  let returntext = '';

  for (let i = 0, max = levels.length; i < max; i++) {
    if (
      (i === max - 1 || minDuration === levels[i][1].trim()) &&
      !returntext &&
      !levels[i][0]
    ) {
      returntext = '0' + levels[i][1];
      break;
    }
    if (levels[i][0] === 0) {
      continue;
    }
    const singular = levels[i][1].substring(0, levels[i][1].length - 1);
    const duration = levels[i][1];
    const quotient = levels[i][0];

    returntext +=
      ' ' + quotient + abbreviation
        ? // eslint-disable-next-line sentry/no-dynamic-translations
          t(duration)
        : // eslint-disable-next-line sentry/no-dynamic-translations
          tn(singular, duration, levels[i][0]);
    if (minDuration === levels[i][1].trim()) {
      break;
    }
  }
  return returntext.trim();
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

  const ms = `000${milliseconds}`.slice(-3);
  return milliseconds ? `${parts.join(':')}.${ms}` : parts.join(':');
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

/**
 * Formats a number to a string with a suffix
 *
 * @param number the number to format
 * @param precision the number of significant digits to include
 */
export function formatAbbreviatedNumber(
  number: number | string,
  precision?: number
): string {
  number = Number(number);

  let lookup: (typeof numberFormats)[number];

  // eslint-disable-next-line no-cond-assign
  for (let i = 0; (lookup = numberFormats[i]); i++) {
    const [suffixNum, suffix] = lookup;
    const shortValue = Math.floor(number / suffixNum);
    const fitsBound = number % suffixNum;

    if (shortValue <= 0) {
      continue;
    }

    const formattedNumber =
      shortValue / 10 > 1 || !fitsBound
        ? precision === undefined
          ? shortValue
          : parseFloat(shortValue.toPrecision(precision)).toString()
        : formatFloat(number / suffixNum, precision || 1).toLocaleString(undefined, {
            maximumSignificantDigits: precision,
          });

    return `${formattedNumber}${suffix}`;
  }

  return number.toLocaleString(undefined, {maximumSignificantDigits: precision});
}

export function formatRate(
  value: number,
  unit: RateUnits = RateUnits.PER_SECOND,
  options: {
    minimumValue?: number;
    significantDigits?: number;
  } = {}
) {
  // NOTE: `Intl` doesn't support unitless-per-unit formats (i.e.,
  // `"-per-minute"` is not valid) so we have to concatenate the unit manually, since our rates are usually just "/min" or "/s".
  // Because of this, the unit is not internationalized.

  // 0 is special!
  if (value === 0) {
    return `${0}${RATE_UNIT_LABELS[unit]}`;
  }

  const minimumValue = options.minimumValue ?? 0;
  const significantDigits = options.significantDigits ?? 3;

  const numberFormatOptions: ConstructorParameters<typeof Intl.NumberFormat>[1] = {
    notation: 'compact',
    compactDisplay: 'short',
    minimumSignificantDigits: significantDigits,
    maximumSignificantDigits: significantDigits,
  };

  if (value <= minimumValue) {
    return `<${minimumValue}${RATE_UNIT_LABELS[unit]}`;
  }

  return `${value.toLocaleString(undefined, numberFormatOptions)}${
    RATE_UNIT_LABELS[unit]
  }`;
}
