import moment from 'moment';

import {DEFAULT_STATS_PERIOD} from 'sentry/constants';
import {IntervalPeriod} from 'sentry/types';
import {defined} from 'sentry/utils';

export type StatsPeriodType = 'h' | 'd' | 's' | 'm' | 'w';

type SingleParamValue = string | undefined | null;
type ParamValue = string[] | SingleParamValue;

const STATS_PERIOD_PATTERN = '^(\\d+)([hdmsw])?$';

/**
 * Parses a stats period into `period` and `periodLength`
 */
export function parseStatsPeriod(input: string | IntervalPeriod) {
  const result = input.match(STATS_PERIOD_PATTERN);

  if (!result) {
    return undefined;
  }

  const period = result[1];

  // default to seconds. this behaviour is based on src/sentry/utils/dates.py
  const periodLength = result[2] || 's';

  return {period, periodLength};
}

/**
 * Normalizes a stats period string
 */
function coerceStatsPeriod(input: string) {
  const result = parseStatsPeriod(input);

  return result ? `${result.period}${result.periodLength}` : undefined;
}

/**
 * Normalizes a string or string[] into a standard stats period string.
 *
 * Undefined and null inputs are returned as undefined.
 */
function getStatsPeriodValue(maybe: ParamValue) {
  if (Array.isArray(maybe)) {
    const result = maybe.find(coerceStatsPeriod);

    return result ? coerceStatsPeriod(result) : undefined;
  }

  if (typeof maybe === 'string') {
    return coerceStatsPeriod(maybe);
  }

  return undefined;
}

/**
 * We normalize potential datetime strings into the form that would be valid if
 * it was to be parsed by datetime.strptime using the format
 * %Y-%m-%dT%H:%M:%S.%f
 *
 * This format was transformed to the form that moment.js understands using [0]
 *
 * [0]: https://gist.github.com/asafge/0b13c5066d06ae9a4446
 */
function normalizeDateTimeString(input: Date | SingleParamValue) {
  if (!input) {
    return undefined;
  }

  const parsed = moment.utc(input);

  if (!parsed.isValid()) {
    return undefined;
  }

  return parsed.format('YYYY-MM-DDTHH:mm:ss.SSS');
}

/**
 * Normalizes a string or string[] into the date time string.
 *
 * Undefined and null inputs are returned as undefined.
 */
function getDateTimeString(maybe: Date | ParamValue) {
  const result = Array.isArray(maybe)
    ? maybe.find(needle => moment.utc(needle).isValid())
    : maybe;

  return normalizeDateTimeString(result);
}

/**
 * Normalize a UTC parameter
 */
function parseUtcValue(utc: boolean | SingleParamValue) {
  if (!defined(utc)) {
    return undefined;
  }

  return utc === true || utc === 'true' ? 'true' : 'false';
}

/**
 * Normalizes a string or string[] into the UTC parameter.
 *
 * Undefined and null inputs are returned as undefined.
 */
function getUtcValue(maybe: boolean | ParamValue) {
  const result = Array.isArray(maybe)
    ? maybe.find(needle => !!parseUtcValue(needle))
    : maybe;

  return parseUtcValue(result);
}

type ParsedParams = {
  start?: string;
  end?: string;
  period?: string;
  utc?: string;
  [others: string]: string | null | undefined;
};

type InputParams = {
  pageStatsPeriod?: ParamValue;
  pageStart?: Date | ParamValue;
  pageEnd?: Date | ParamValue;
  pageUtc?: boolean | ParamValue;
  start?: Date | ParamValue;
  end?: Date | ParamValue;
  period?: ParamValue;
  statsPeriod?: ParamValue;
  utc?: boolean | ParamValue;
  [others: string]: any;
};

type Options = {
  allowEmptyPeriod?: boolean;
  allowAbsoluteDatetime?: boolean;
  allowAbsolutePageDatetime?: boolean;
  defaultStatsPeriod?: string;
};

export function getParams(params: InputParams, options: Options = {}): ParsedParams {
  const {
    allowEmptyPeriod = false,
    allowAbsoluteDatetime = true,
    allowAbsolutePageDatetime = false,
    defaultStatsPeriod = DEFAULT_STATS_PERIOD,
  } = options;

  const {
    pageStatsPeriod,
    pageStart,
    pageEnd,
    pageUtc,
    start,
    end,
    period,
    statsPeriod,
    utc,
    ...otherParams
  } = params;

  // `statsPeriod` takes precedence for now
  let coercedPeriod =
    getStatsPeriodValue(pageStatsPeriod) ||
    getStatsPeriodValue(statsPeriod) ||
    getStatsPeriodValue(period);

  const dateTimeStart = allowAbsoluteDatetime
    ? allowAbsolutePageDatetime
      ? getDateTimeString(pageStart) ?? getDateTimeString(start)
      : getDateTimeString(start)
    : null;
  const dateTimeEnd = allowAbsoluteDatetime
    ? allowAbsolutePageDatetime
      ? getDateTimeString(pageEnd) ?? getDateTimeString(end)
      : getDateTimeString(end)
    : null;

  if ((!dateTimeStart || !dateTimeEnd) && !coercedPeriod && !allowEmptyPeriod) {
    coercedPeriod = defaultStatsPeriod;
  }

  const object = {
    statsPeriod: coercedPeriod,
    start: coercedPeriod ? null : dateTimeStart,
    end: coercedPeriod ? null : dateTimeEnd,
    // coerce utc into a string (it can be both: a string representation from
    // router, or a boolean from time range picker)
    utc: getUtcValue(pageUtc ?? utc),
    ...otherParams,
  };

  // Filter null values
  const paramEntries = Object.entries(object).filter(([_, value]) => defined(value));

  return Object.fromEntries(paramEntries);
}
