import moment from 'moment-timezone';
import {createParser} from 'nuqs';

/**
 * Parses an ISO 8601 date-time query param, reading a value without a UTC
 * offset as UTC.
 *
 * The page filters write `start`/`end` without an offset (see
 * `getUtcDateString`), and nuqs' `parseAsIsoDateTime` reads such values in
 * the browser's local timezone, which shifts the window for anyone not in UTC.
 */
export const parseAsUtcDateTime = createParser({
  parse: value => {
    const parsed = moment.utc(value, moment.ISO_8601, true);
    return parsed.isValid() ? parsed.toDate() : null;
  },
  serialize: (value: Date) => value.toISOString(),
  eq: (a, b) => a.getTime() === b.getTime(),
});
