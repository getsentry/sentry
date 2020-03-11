import queryString from 'query-string';
import parseurl from 'parseurl';
import isString from 'lodash/isString';

import RESERVED_TAGS from './queryStringReservedTags';

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
  value: string
): string {
  if (RESERVED_TAGS.includes(key)) {
    //Use the explicit tag syntax to handle the case when the tag name (key) is a
    //reserved tag (keyword).
    //https://docs.sentry.io/workflow/search/?platform=node#explicit-tag-syntax
    key = `tags[${key}]`;
  }

  let currentQuery = Array.isArray(query) ? query.pop() : isString(query) ? query : '';

  // The user key values have additional key data inside them.
  if (key === 'user' && value.includes(':')) {
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

export default {
  formatQueryString,
  addQueryParamsToExistingUrl,
  appendTagCondition,
};
