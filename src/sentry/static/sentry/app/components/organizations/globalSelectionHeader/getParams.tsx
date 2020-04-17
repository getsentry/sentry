import moment from 'moment';

import {DEFAULT_STATS_PERIOD} from 'app/constants';
import {defined} from 'app/utils';

const STATS_PERIOD_PATTERN = '^(\\d+)([hdmsw])?$';

export function parseStatsPeriod(input: string) {
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
  input: string | undefined | null
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
  maybe: string | string[] | undefined | null
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

const getUtcValue = (maybe: string | string[] | undefined | null): string | undefined => {
  if (Array.isArray(maybe)) {
    if (maybe.length <= 0) {
      return undefined;
    }

    return maybe.find(needle => !!parseUtcValue(needle));
  }

  maybe = parseUtcValue(maybe);

  if (typeof maybe === 'string') {
    return maybe;
  }

  return undefined;
};

type ParamValue = string | string[] | undefined | null;
type Params = {
  start?: ParamValue;
  end?: ParamValue;
  period?: ParamValue;
  statsPeriod?: ParamValue;
  utc?: ParamValue;
};
type RestParams = {[others: string]: ParamValue};

export function getParams(
  params: Params & RestParams,
  {allowEmptyPeriod = false}: {allowEmptyPeriod?: boolean} = {}
): {
  [K in keyof Params]: Exclude<NonNullable<Params[K]>, string[]>;
} &
  RestParams {
  const {start, end, period, statsPeriod, utc, ...otherParams} = params;

  // `statsPeriod` takes precendence for now
  let coercedPeriod = getStatsPeriodValue(statsPeriod) || getStatsPeriodValue(period);

  const dateTimeStart = getDateTimeString(start);
  const dateTimeEnd = getDateTimeString(end);

  if (!(dateTimeStart && dateTimeEnd)) {
    if (!coercedPeriod && !allowEmptyPeriod) {
      coercedPeriod = DEFAULT_STATS_PERIOD;
    }
  }

  return Object.fromEntries(
    Object.entries({
      statsPeriod: coercedPeriod,
      start: coercedPeriod ? null : dateTimeStart,
      end: coercedPeriod ? null : dateTimeEnd,
      // coerce utc into a string (it can be both: a string representation from router,
      // or a boolean from time range picker)
      utc: getUtcValue(utc),
      ...otherParams,
    })
      // Filter null values
      .filter(([_key, value]) => defined(value))
  );
}
