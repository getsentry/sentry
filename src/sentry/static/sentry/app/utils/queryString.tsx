import queryString from 'query-string';
import parseurl from 'parseurl';
import isString from 'lodash/isString';

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
  // Otherwise ``queryString`` orders them randomly and it's impossible to test.
  const params = JSON.parse(JSON.stringify(queryParams));
  const query = url.query ? {...queryString.parse(url.query), ...params} : params;

  return `${url.protocol}//${url.host}${url.pathname}?${queryString.stringify(query)}`;
}

type QueryValue = string | string[] | undefined | null;

/**
 * Append a tag key:value to a query string.
 *
 * Handles spacing and quoting if necessary.
 */
export function appendTagCondition(
  query: QueryValue,
  key: string,
  value: null | string
): string {
  let currentQuery = Array.isArray(query) ? query.pop() : isString(query) ? query : '';

  // The user key values have additional key data inside them.
  if (key === 'user' && isString(value) && value.includes(':')) {
    const parts = value.split(':', 2);
    key = [key, parts[0]].join('.');
    value = parts[1];
  }

  if (isString(value) && value.includes(' ')) {
    value = `"${value}"`;
  }
  if (currentQuery) {
    currentQuery += ` ${key}:${value}`;
  } else {
    currentQuery = `${key}:${value}`;
  }

  return currentQuery;
}

export function decodeScalar(
  value: string[] | string | undefined | null
): string | undefined {
  if (!value) {
    return undefined;
  }
  const unwrapped =
    Array.isArray(value) && value.length > 0
      ? value[0]
      : isString(value)
      ? value
      : undefined;
  return isString(unwrapped) ? unwrapped : undefined;
}

export function decodeList(
  value: string[] | string | undefined | null
): string[] | undefined {
  if (!value) {
    return undefined;
  }
  return Array.isArray(value) ? value : isString(value) ? [value] : [];
}

export default {
  decodeList,
  decodeScalar,
  formatQueryString,
  addQueryParamsToExistingUrl,
  appendTagCondition,
};
