import * as qs from 'query-string';

import {escapeDoubleQuotes} from 'sentry/utils';
import type {Sort} from 'sentry/utils/discover/fields';
import {safeURL} from 'sentry/utils/url/safeURL';

// remove leading and trailing whitespace and remove double spaces
export function formatQueryString(query: string): string {
  return query.trim().replace(/\s+/g, ' ');
}

export function addQueryParamsToExistingUrl(
  origUrl: string,
  queryParams: Record<PropertyKey, unknown>
): string {
  const url = safeURL(origUrl);

  if (!url) {
    return '';
  }

  const searchEntries = url.searchParams.entries();
  // Order the query params alphabetically.
  // Otherwise ``queryString`` orders them randomly and it's impossible to test.
  const params = JSON.parse(JSON.stringify(queryParams));
  const query = {...Object.fromEntries(searchEntries), ...params};

  return `${url.protocol}//${url.host}${url.pathname}?${qs.stringify(query)}`;
}

export type QueryValue = string | string[] | undefined | null;

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
  let currentQuery = Array.isArray(query)
    ? query.pop()
    : typeof query === 'string'
      ? query
      : '';

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

export function appendExcludeTagValuesCondition(
  query: QueryValue,
  key: string,
  values: string[]
): string {
  let currentQuery = Array.isArray(query)
    ? query.pop()
    : typeof query === 'string'
      ? query
      : '';
  const filteredValuesCondition = `[${values
    .map(value => {
      if (typeof value === 'string' && /[\s"]/g.test(value)) {
        value = `"${escapeDoubleQuotes(value)}"`;
      }
      return value;
    })
    .join(', ')}]`;

  if (currentQuery) {
    currentQuery += ` !${key}:${filteredValuesCondition}`;
  } else {
    currentQuery = `!${key}:${filteredValuesCondition}`;
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
      : typeof value === 'string'
        ? value
        : fallback;
  return typeof unwrapped === 'string' ? unwrapped : fallback;
}

export function decodeList(value: string[] | string | undefined | null): string[] {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
}

// This function has multiple signatures to help with typing in callers.
export function decodeInteger(value: QueryValue): number | undefined;
export function decodeInteger(value: QueryValue, fallback: number): number;
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

export function decodeSorts(value: QueryValue): Sort[];
export function decodeSorts(value: QueryValue, fallback: string): Sort[];
export function decodeSorts(value: QueryValue, fallback?: string): Sort[] {
  const sorts = decodeList(value).filter(Boolean);
  if (!sorts.length) {
    return fallback ? decodeSorts(fallback) : [];
  }
  return sorts.map(sort =>
    sort.startsWith('-')
      ? {kind: 'desc', field: sort.substring(1)}
      : {kind: 'asc', field: sort}
  );
}

export function decodeBoolean(value: QueryValue): boolean | undefined;
export function decodeBoolean(value: QueryValue, fallback: boolean): boolean;
export function decodeBoolean(
  value: QueryValue,
  fallback?: boolean
): boolean | undefined {
  const unwrapped = decodeScalar(value);

  if (unwrapped === 'true') {
    return true;
  }

  if (unwrapped === 'false') {
    return false;
  }

  return fallback;
}

const queryString = {
  decodeBoolean,
  decodeInteger,
  decodeList,
  decodeScalar,
  decodeSorts,
  formatQueryString,
  addQueryParamsToExistingUrl,
  appendTagCondition,
  appendExcludeTagValuesCondition,
};

export default queryString;
