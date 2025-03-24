import {t} from 'sentry/locale';
import type {CommitAuthor} from 'sentry/types/integrations';
import type {User} from 'sentry/types/user';
import {RATE_UNIT_LABELS, RateUnit} from 'sentry/utils/discover/fields';
import {formatFloat} from 'sentry/utils/number/formatFloat';

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

// in milliseconds
export const YEAR = 31536000000;
export const MONTH = 2629800000;
export const WEEK = 604800000;
export const DAY = 86400000;
export const HOUR = 3600000;
export const MINUTE = 60000;
export const SECOND = 1000;
export const MILLISECOND = 1;
export const MICROSECOND = 0.001;
export const NANOSECOND = 0.000001;

const numberFormatSteps = [
  [1_000_000_000, 'b'],
  [1_000_000, 'm'],
  [1_000, 'k'],
] as const;

/**
 * Formats a number with an abbreviation e.g. 1000 -> 1k.
 *
 * @param number the number to format
 * @param maximumSignificantDigits the number of significant digits to include
 * @param includeDecimals when true, formatted number will always include non trailing zero decimal places
 */
export function formatAbbreviatedNumber(
  number: number | string,
  maximumSignificantDigits?: number,
  includeDecimals?: boolean
): string {
  number = Number(number);

  const prefix = number < 0 ? '-' : '';
  const numAbsValue = Math.abs(number);

  for (const step of numberFormatSteps) {
    const [suffixNum, suffix] = step;
    const shortValue = Math.floor(numAbsValue / suffixNum);
    const fitsBound = numAbsValue % suffixNum === 0;

    if (shortValue <= 0) {
      continue;
    }

    const useShortValue = !includeDecimals && (shortValue > 10 || fitsBound);

    if (useShortValue) {
      if (maximumSignificantDigits === undefined) {
        return `${prefix}${shortValue}${suffix}`;
      }
      const formattedNumber = parseFloat(
        shortValue.toPrecision(maximumSignificantDigits)
      ).toString();
      return `${prefix}${formattedNumber}${suffix}`;
    }

    const formattedNumber = formatFloat(
      numAbsValue / suffixNum,
      maximumSignificantDigits || 1
    ).toLocaleString(undefined, {
      maximumSignificantDigits,
    });

    return `${prefix}${formattedNumber}${suffix}`;
  }

  return number.toLocaleString(undefined, {maximumSignificantDigits});
}

/**
 * Formats a number with an abbreviation and rounds to 2
 * decimal digits without forcing trailing zeros.
 * e. g. 1000 -> 1k, 1234 -> 1.23k
 */
export function formatAbbreviatedNumberWithDynamicPrecision(
  value: number | string
): string {
  const number = Number(value);

  if (number === 0) {
    return '0';
  }

  const log10 = Math.log10(Math.abs(number));
  // numbers less than 1 will have a negative log10
  const numOfDigits = log10 < 0 ? 1 : Math.floor(log10) + 1;

  const maxStep = numberFormatSteps[0][0];

  // if the number is larger than the largest step, we determine the number of digits
  // by dividing the number by the largest step, otherwise the number of formatted
  // digits is the number of digits in the number modulo 3 (the number of zeroes between steps)
  const numOfFormattedDigits =
    number > maxStep
      ? Math.floor(Math.log10(number / maxStep))
      : Math.max(numOfDigits % 3 === 0 ? 3 : numOfDigits % 3, 0);

  const maximumSignificantDigits = numOfFormattedDigits + 2;

  return formatAbbreviatedNumber(value, maximumSignificantDigits, true);
}

export function formatRate(
  value: number,
  unit: RateUnit = RateUnit.PER_SECOND,
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

export function formatSpanOperation(
  operation?: string,
  length: 'short' | 'long' = 'short'
) {
  if (length === 'long') {
    return getLongSpanOperationDescription(operation);
  }

  return getShortSpanOperationDescription(operation);
}

function getLongSpanOperationDescription(operation?: string) {
  if (operation?.startsWith('http')) {
    return t('URL request');
  }

  if (operation === 'db.redis') {
    return t('cache query');
  }

  if (operation?.startsWith('db')) {
    return t('database query');
  }

  if (operation?.startsWith('task')) {
    return t('application task');
  }

  if (operation?.startsWith('serialize')) {
    return t('serializer');
  }

  if (operation?.startsWith('middleware')) {
    return t('middleware');
  }

  if (operation === 'resource') {
    return t('resource');
  }

  if (operation === 'resource.script') {
    return t('JavaScript file');
  }

  if (operation === 'resource.css') {
    return t('stylesheet');
  }

  if (operation === 'resource.img') {
    return t('image');
  }

  return t('span');
}

function getShortSpanOperationDescription(operation?: string) {
  if (operation?.startsWith('http')) {
    return t('request');
  }

  if (operation?.startsWith('db')) {
    return t('query');
  }

  if (operation?.startsWith('task')) {
    return t('task');
  }

  if (operation?.startsWith('serialize')) {
    return t('serializer');
  }

  if (operation?.startsWith('middleware')) {
    return t('middleware');
  }

  if (operation?.startsWith('resource')) {
    return t('resource');
  }

  return t('span');
}
