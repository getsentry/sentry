import isString from 'lodash/isString';
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
  let url;

  try {
    url = new URL(origUrl);
  } catch {
    return '';
  }

  const searchEntries = url.searchParams.entries();
  // Order the query params alphabetically.
  // Otherwise ``queryString`` orders them randomly and it's impossible to test.
  const params = JSON.parse(JSON.stringify(queryParams));
  const query = {...Object.fromEntries(searchEntries), ...params};

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

// This function has multiple signatures to help with typing in callers.
export function decodeScalar(value: QueryValue): string | undefined;
export function decodeScalar(value: QueryValue, fallback: string): string;

export function decodeScalar(value: QueryValue, fallback?: string): string | undefined {
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

export function decodeInteger(value: QueryValue, fallback?: number): number | undefined {
  const unwrapped = decodeScalar(value);

  if (unwrapped === undefined) {
    return fallback;
  }

  const parsed = parseInt(unwrapped, 10);
  if (isFinite(parsed)) {
    return parsed;
  }
  return fallback;
}

export default {
  decodeInteger,
  decodeList,
  decodeScalar,
  formatQueryString,
  addQueryParamsToExistingUrl,
  appendTagCondition,
};
