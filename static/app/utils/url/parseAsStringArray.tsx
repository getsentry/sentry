import {createMultiParser} from 'nuqs';

/**
 * Reads a list param the way Sentry writes one.
 *
 * Values are repeated keys (`?project=1&project=2`) rather than a single
 * delimited value, so `parseAsArrayOf` is the wrong tool — it would split one
 * value and keep only the first key.
 *
 * Blank values are dropped so a bare `?project=` means no filter rather than a
 * filter on the empty string, matching `decodeList`. `eq` treats an empty list
 * as the default so clearing a filter removes the key instead of writing
 * `?project=` back.
 */
export const parseAsStringArray = createMultiParser<string[]>({
  parse: values => values.filter(Boolean),
  serialize: values => values.filter(Boolean),
  eq: (a, b) => a.length === b.length && a.every((value, index) => value === b[index]),
}).withDefault([]);
