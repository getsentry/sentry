import moment from 'moment';

import {DEFAULT_STATS_PERIOD} from 'app/constants';
import {IntervalPeriod} from 'app/types';
import {defined} from 'app/utils';

export type StatsPeriodType = 'h' | 'd' | 's' | 'm' | 'w';

const STATS_PERIOD_PATTERN = '^(\\d+)([hdmsw])?$';

export function parseStatsPeriod(input: string | IntervalPeriod) {
  const result = input.match(STATS_PERIOD_PATTERN);

  if (!result) {
    return undefined;
  }

  const period = result[1];

  let periodLength = result[2];
  if (!periodLength) {
    // default to seconds.
    // this behaviour is based on src/sentry/utils/dates.py
    periodLength = 's';
  }

  return {
    period,
    periodLength,
  };
}

function coerceStatsPeriod(input: string) {
  const result = parseStatsPeriod(input);

  if (!result) {
    return undefined;
  }

  const {period, periodLength} = result;

  return `${period}${periodLength}`;
}

function getStatsPeriodValue(
  maybe: string | string[] | undefined | null
): string | undefined {
  if (Array.isArray(maybe)) {
    if (maybe.length <= 0) {
      return undefined;
    }

    const result = maybe.find(coerceStatsPeriod);
    if (!result) {
      return undefined;
    }
    return coerceStatsPeriod(result);
  }

  if (typeof maybe === 'string') {
    return coerceStatsPeriod(maybe);
  }

  return undefined;
}

// We normalize potential datetime strings into the form that would be valid
// if it were to be parsed by datetime.strptime using the format %Y-%m-%dT%H:%M:%S.%f
// This format was transformed to the form that moment.js understands using
// https://gist.github.com/asafge/0b13c5066d06ae9a4446
const normalizeDateTimeString = (
  input: Date | string | undefined | null
): string | undefined => {
  if (!input) {
    return undefined;
  }

  const parsed = moment.utc(input);

  if (!parsed.isValid()) {
    return undefined;
  }

  return parsed.format('YYYY-MM-DDTHH:mm:ss.SSS');
};

const getDateTimeString = (
  maybe: Date | string | string[] | undefined | null
): string | undefined => {
  if (Array.isArray(maybe)) {
    if (maybe.length <= 0) {
      return undefined;
    }

    const result = maybe.find(needle => moment.utc(needle).isValid());

    return normalizeDateTimeString(result);
  }

  return normalizeDateTimeString(maybe);
};

const parseUtcValue = (utc: any) => {
  if (defined(utc)) {
    return utc === true || utc === 'true' ? 'true' : 'false';
  }
  return undefined;
};

const getUtcValue = (
  maybe: string | string[] | boolean | undefined | null
): string | undefined => {
  if (Array.isArray(maybe)) {
    if (maybe.length <= 0) {
      return undefined;
    }

    return maybe.find(needle => !!parseUtcValue(needle));
  }

  return parseUtcValue(maybe);
};

type ParamValue = string | string[] | undefined | null;

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

type GetParamsOptions = {
  allowEmptyPeriod?: boolean;
  allowAbsoluteDatetime?: boolean;
  allowAbsolutePageDatetime?: boolean;
  defaultStatsPeriod?: string;
};
export function getParams(
  params: InputParams,
  {
    allowEmptyPeriod = false,
    allowAbsoluteDatetime = true,
    allowAbsolutePageDatetime = false,
    defaultStatsPeriod = DEFAULT_STATS_PERIOD,
  }: GetParamsOptions = {}
): ParsedParams {
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

  if (!(dateTimeStart && dateTimeEnd)) {
    if (!coercedPeriod && !allowEmptyPeriod) {
      coercedPeriod = defaultStatsPeriod;
    }
  }

  return Object.fromEntries(
    Object.entries({
      statsPeriod: coercedPeriod,
      start: coercedPeriod ? null : dateTimeStart,
      end: coercedPeriod ? null : dateTimeEnd,
      // coerce utc into a string (it can be both: a string representation from router,
      // or a boolean from time range picker)
      utc: getUtcValue(pageUtc ?? utc),
      ...otherParams,
    })
      // Filter null values
      .filter(([_key, value]) => defined(value))
  );
}
