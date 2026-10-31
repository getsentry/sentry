import type {Location} from 'history';
import {
  createLoader,
  createMultiParser,
  createParser,
  parseAsNativeArrayOf,
  parseAsString,
  parseAsStringEnum,
  type inferParserType,
  type ParserMap,
} from 'nuqs';
import * as qs from 'query-string';

import {parseAsStringArray} from 'sentry/utils/url/parseAsStringArray';
import {Mode} from 'sentry/views/explore/queryParams/mode';

export const parseAsMode = parseAsStringEnum<Mode>(Object.values(Mode));

/**
 * A string param where a blank value means absent, matching `decodeScalar`.
 */
export const parseAsScalar = createParser({
  parse: value => value || null,
  serialize: String,
});

/**
 * A string param that's ignored when it's blank or repeated.
 */
export const parseAsSingleScalar = createMultiParser({
  parse: values => (values.length === 1 && values[0] ? values[0] : null),
  serialize: (value: string) => [value],
});

/**
 * A repeated-key list that keeps blank values, for params where an empty
 * string is meaningful (e.g. a blank group by).
 */
export const parseAsRawList = parseAsNativeArrayOf(parseAsString);

export {parseAsStringArray as parseAsFieldList};

export type QueryParamsValues<Parsers extends ParserMap> = inferParserType<Parsers>;

/**
 * Changes to apply to a page's query params.
 *  - `undefined` leaves a key as is
 *  - `null` removes it the key
 *  - any other value overrides the key
 */
export type QueryParamsUpdates<Parsers extends ParserMap> = {
  [Key in keyof Parsers]?: inferParserType<Parsers>[Key] | null;
};

export function loadQueryParamsFromLocation<Parsers extends ParserMap>(
  parsers: Parsers,
  location: Location
) {
  return createLoader(parsers)(qs.stringify(location.query));
}

export function applyQueryParamsUpdates<Parsers extends ParserMap>(
  parsers: Parsers,
  location: Location,
  updates: QueryParamsUpdates<Parsers>
): Location {
  const target: Location = {...location, query: {...location.query}};

  for (const key of Object.keys(updates) as Array<keyof Parsers & string>) {
    const value = updates[key];
    if (value === undefined) {
      continue;
    }
    if (value === null) {
      if (target.query[key]) {
        delete target.query[key];
      }
      continue;
    }
    const serialize = parsers[key]?.serialize;
    target.query[key] = serialize ? serialize(value) : value;
  }

  return target;
}
