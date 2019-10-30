import {DEFAULT_STATS_PERIOD} from 'app/constants';
import {defined} from 'app/utils';
import moment from 'moment';

const STATS_PERIOD_PATTERN = '^\\d+[hdmsw]?$';

function validStatsPeriod(input: string) {
  return !!input.match(STATS_PERIOD_PATTERN);
}

const getStatsPeriodValue = (
  maybe: string | string[] | undefined | null
): string | undefined => {
  if (Array.isArray(maybe)) {
    if (maybe.length <= 0) {
      return undefined;
    }

    return maybe.find(validStatsPeriod);
  }

  if (typeof maybe === 'string' && validStatsPeriod(maybe)) {
    return maybe;
  }

  return undefined;
};

const getDateTimeString = (
  maybe: string | string[] | undefined | null
): string | undefined => {
  if (Array.isArray(maybe)) {
    if (maybe.length <= 0) {
      return undefined;
    }

    return maybe.find(needle => {
      return moment.utc(needle).isValid();
    });
  }

  if (typeof maybe === 'string' && moment.utc(maybe).isValid()) {
    return maybe;
  }

  return undefined;
};

const parseUtcValue = (utc: any) => {
  if (typeof utc !== 'undefined') {
    return utc === true || utc === 'true' ? 'true' : 'false';
  }
  return undefined;
};

const getUtcValue = (maybe: string | string[] | undefined | null): string | undefined => {
  if (Array.isArray(maybe)) {
    if (maybe.length <= 0) {
      return undefined;
    }

    return maybe.find(needle => {
      return !!parseUtcValue(needle);
    });
  }

  maybe = parseUtcValue(maybe);

  if (typeof maybe === 'string') {
    return maybe;
  }

  return undefined;
};

interface Params {
  start?: string | string[] | undefined | null;
  end?: string | string[] | undefined | null;
  period?: string | string[] | undefined | null;
  statsPeriod?: string | string[] | undefined | null;
  utc?: string | string[] | undefined | null;
  [others: string]: string | string[] | undefined | null;
}

// Filters out params with null values and returns a default
// `statsPeriod` when necessary.
//
// Accepts `period` and `statsPeriod` but will only return `statsPeriod`
//
// TODO(billy): Make period parameter name consistent
export function getParams(params: Params): {[key: string]: string | string[]} {
  const {start, end, period, statsPeriod, utc, ...otherParams} = params;

  // `statsPeriod` takes precendence for now
  let coercedPeriod = getStatsPeriodValue(statsPeriod) || getStatsPeriodValue(period);

  const dateTimeStart = getDateTimeString(start);
  const dateTimeEnd = getDateTimeString(end);

  if (!(dateTimeStart && dateTimeEnd)) {
    if (!coercedPeriod) {
      coercedPeriod = DEFAULT_STATS_PERIOD;
    }
  }

  // Filter null values
  return Object.entries({
    statsPeriod: coercedPeriod,
    start: coercedPeriod ? null : dateTimeStart,
    end: coercedPeriod ? null : dateTimeEnd,
    // coerce utc into a string (it can be both: a string representation from router,
    // or a boolean from time range picker)
    utc: getUtcValue(utc),
    ...otherParams,
  })
    .filter(([_key, value]) => defined(value))
    .reduce(
      (acc, [key, value]) => ({
        ...acc,
        [key]: value,
      }),
      {}
    );
}
