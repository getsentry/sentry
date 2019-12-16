import queryString from 'query-string';
import parseurl from 'parseurl';
import isString from 'lodash/isString';
import {Query} from 'history';

// remove leading and trailing whitespace and remove double spaces
export function formatQueryString(qs: string): string {
  return qs.trim().replace(/\s+/g, ' ');
}

export function addQueryParamsToExistingUrl(
  origUrl: string,
  queryParams: object
): string {
  const url = parseurl({url: origUrl});
  if (!url) {
    return '';
  }
  // Order the query params alphabetically.
  // Otherwise `queryString` orders them randomly and it's impossible to test.
  const params = JSON.parse(JSON.stringify(queryParams));
  const query = url.query ? {...queryString.parse(url.query), ...params} : params;

  return `${url.protocol}//${url.host}${url.pathname}?${queryString.stringify(query)}`;
}

/**
 * Add a key-value to the queryString.
 *
 * If there is an existing value on the same key, this function will replace it.
 *
 * However, if the key is `query`, it will append the new value to the existing
 * value, delimiting the values with a space.
 *
 * Handles spacing and quoting if necessary.
 */
export function addKeyValueToQueryString(
  query: Query = {},
  key: string,
  value: string
): Query {
  // console.log('addKeyValueToQueryString', key, value);
  if (key === 'query') {
    return addKeyValueToQueryStringQuery(query, value);
  }

  // Wrap value if there are spaces
  return {
    ...query,
    [key]: value.indexOf(' ') > -1 ? `"${value}"` : value,
  };
}

/**
 * Used by `addKeyValueToQueryStringQuery`, `decodeQueryValueToObject` and
 * `encodeObjectToQueryValue` as a marker when they receive a value with either
 * no keys or the wrong format.
 */
const NO_KEY = '__NO_KEY__';

/**
 * Append a tag (key:value) to QueryString.query. This method ensures uniqueness
 * of keys in QueryString.query. If there is an existing key with a value, it
 * will be overwritten by the new value.
 *
 * Handles spacing and quoting if necessary.
 */
export function addKeyValueToQueryStringQuery(qs: Query = {}, tag: string): Query {
  const {query} = qs;
  const queryObject = _decodeQueryValueToObject(query);

  let key, value;
  const keyValue = tag.split(':');
  if (keyValue.length === 2) {
    [key, value] = keyValue;
  } else {
    key = NO_KEY;
    value = tag;
  }

  // Wrap value if there are spaces
  if (value.indexOf(' ') > -1) {
    value = `"${value.trim()}"`;
  }

  // Add new key-value into QueryObject
  if (key === NO_KEY) {
    queryObject[key] = `${queryObject[key]} ${value}`.trim();
  } else {
    queryObject[key] = value.trim();
  }

  return {
    ...qs,
    // query: _encodeObjectToQueryValue(queryObject),
  };
}

/**
 * This method specifically parses "?query=key:value" into an object and
 * resolves duplicate keys. In the case of duplicate keys, the last value will
 * be used.
 *
 * Do not include this in `export default`. This is currently exported for
 * testing purposes only.
 */
export function _decodeQueryValueToObject(
  query: Query['query']
): {[key: string]: string} {
  const currQuery: string = isString(query)
    ? query
    : Array.isArray(query)
    ? query.reduce((acc, q) => `${acc} ${q}`, '')
    : '';

  // There
  // 1) Start with the QueryValue: "key1:value1 key2:value2"
  // 2) Split it into their pairs: ["key1:value1", "key2:value2"]
  // 3) Split it into key-values:  { key1: value1, key2: value2 }
  return currQuery.split(' ').reduce((acc, keyValue) => {
    const pair = keyValue.split(':');

    if (pair.length === 2) {
      acc[pair[0]] = pair[1];
    } else {
      acc[NO_KEY] =
        typeof acc[NO_KEY] === 'undefined' ? keyValue : `${acc[NO_KEY]} ${keyValue}`;
    }

    return acc;
  }, {});
}

/**
 * This method is the opposite of `decodeQueryValueToObject`.
 *
 * Do not include this in `export default`. This is currently exported for
 * testing purposes only.
 export function _encodeObjectToQueryValue(obj: {[key: string]: string}): Query['query'] {
   const queryValue = Object.keys(obj).reduce((acc, key) => {
     if (key === NO_KEY) {
       return `${acc} ${obj[key]}`;
      }

      const validatedKey = _encodeKey(key);
      const validatedValue = _encodeValue(obj[key]);

      return `${acc} ${validatedKey}:${validatedValue}`;
    }, '');

    return queryValue.trim();
  }
  */

/**
const regexKey = /^[a-zA-Z0-9_\.-]+$/; // myKeyToEncode
const regexKeyWithColon = /^[a-zA-Z0-9_\.-]+:[[a-zA-Z0-9_\.:-]+$/; // myKey:ToEncode
const regexKeyWithColonQuoted = /^"[a-zA-Z0-9_\.-]+:[[a-zA-Z0-9_\.:-]+"$/; // "myKey:ToEncode"
 *  The 2 accepted formats for keys are
 export function _encodeKey(key: string): string {
   if (regexKeyWithColonQuoted.test(key)) {
     return key;
    }

    if (regexKeyWithColon.test(key)) {
      return `"${key}"`;
    }

    if (regexKey.test(key)) {
      return key;
    }

    throw new Error('Invalid key');
  }
  */

// const regexValue = /^[a-zA-Z0-9_\.-\s]+$/; // value space
// const regexValueWithQuote = /^"[a-zA-Z0-9_\.-\s]+"$/; // "value space"
// const regexValueNoSpace = /^[a-zA-Z0-9_\.-]+$/; // value
// const regexValueNoSpaceWithQuote = /^"[a-zA-Z0-9_\.-]+"$/; // "value"
// const regexValueWithNamespaceValueSpaceOuterQuoted = /^"[a-zA-Z0-9_\.-]+:[a-zA-Z0-9_\.-\s]+"$/; // "namespace:value space"
// const regexValueWithNamespace = /^[a-zA-Z0-9_\.-]+:[a-zA-Z0-9_\.-]+$/; // namespace:value
// const regexValueWithNamespaceWithOuterQuote = /^[a-zA-Z0-9_\.-]+:[a-zA-Z0-9_\.-]+$/; // "namespace:value"
// const regexValueWithNamespaceWithSpaceWithInnerQuote = /^[a-zA-Z0-9_\.-]+:(\\\")[a-zA-Z0-9_\.-\s]+(\\\")$/; // namespace:\"value space\"
// const regexValueWithNamespaceWithOuterQuote = /^[a-zA-Z0-9_\.-]+:(\\\")[a-zA-Z0-9_\.-\s]+(\\\")$/; // "namespace:value space"
// const regexValueWithNamespaceNoSpaceWithInnerOuterQuote = /^"[a-zA-Z0-9_\.-]+:(\\\")[a-zA-Z0-9_\.-\s]+(\\\")"$/; // "namespace:\"value\""
// const regexValueWithNamespaceWithInnerOuterQuote = /^"[a-zA-Z0-9_\.-]+:(\\\")[a-zA-Z0-9_\.-\s]+(\\\")"$/; // "namespace:\"value space\""
/**
 * This will add TODO(leedongwei)
 export function _encodeValue(value: string): string {
   const term = value.replace(/(\"\\)/, '');
   const terms = term.split(':');

   if (terms.length === 2) {
     const key = _encodeKey(terms[0]);
     const val = _encodeValue(terms[1]);
     return `"${key}:${val}"`;
    }

    if (terms.length === 1) {
      //
    }

    throw new Error('Invalid value');
  }
  */

export default {
  formatQueryString,
  addQueryParamsToExistingUrl,
  addKeyValueToQueryString,
  addKeyValueToQueryStringQuery,
};
