import isString from 'lodash/isString';
import parseurl from 'parseurl';
import * as queryString from 'query-string';

import {escapeDoubleQuotes} from 'app/utils';

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

  if (typeof value === 'string' && /[:\s\(\)\\"]/g.test(value)) {
    value = `"${escapeDoubleQuotes(value)}"`;
  }
  if (currentQuery) {
    currentQuery += ` ${key}:${value}`;
  } else {
    currentQuery = `${key}:${value}`;
  }

  return currentQuery;
}

export function decodeScalar(
  value: string[] | string | undefined | null,
  fallback = ''
): string {
  if (!value) {
    return fallback;
  }
  const unwrapped =
    Array.isArray(value) && value.length > 0
      ? value[0]
      : isString(value)
      ? value
      : fallback;
  return isString(unwrapped) ? unwrapped : fallback;
}

export function decodeList(value: string[] | string | undefined | null): string[] {
  if (!value) {
    return [];
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
