import {isEmpty, isString} from 'lodash';
import * as Sentry from '@sentry/browser';
import queryString from 'query-string';

import {defined} from 'app/utils';

export function escapeQuotes(v) {
  return v.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

// TODO(dcramer): support cookies
export function getCurlCommand(data) {
  let result = 'curl';

  if (defined(data.method) && data.method !== 'GET') {
    result += ' \\\n -X ' + data.method;
  }

  // TODO(benvinegar): just gzip? what about deflate?
  const compressed = data.headers.find(
    h => h[0] === 'Accept-Encoding' && h[1].indexOf('gzip') !== -1
  );
  if (compressed) {
    result += ' \\\n --compressed';
  }

  // sort headers
  const headers = data.headers.sort(function(a, b) {
    return a[0] === b[0] ? 0 : a[0] < b[0] ? -1 : 1;
  });

  for (const header of headers) {
    result += ' \\\n -H "' + header[0] + ': ' + escapeQuotes(header[1] + '') + '"';
  }

  if (defined(data.data)) {
    switch (data.inferredContentType) {
      case 'application/json':
        result += ' \\\n --data "' + escapeQuotes(JSON.stringify(data.data)) + '"';
        break;
      case 'application/x-www-form-urlencoded':
        result += ' \\\n --data "' + escapeQuotes(queryString.stringify(data.data)) + '"';
        break;

      default:
        if (isString(data.data)) {
          result += ' \\\n --data "' + escapeQuotes(data.data) + '"';
        } else if (Object.keys(data.data).length === 0) {
          // Do nothing with empty object data.
        } else {
          Sentry.withScope(scope => {
            scope.setExtra('data', data);
            Sentry.captureException(new Error('Unknown event data'));
          });
        }
    }
  }

  result += ' \\\n "' + getFullUrl(data) + '"';
  return result;
}

export function stringifyQueryList(query) {
  if (isString(query)) {
    return query;
  }

  const queryObj = {};
  for (const [k, v] of query) {
    queryObj[k] = v;
  }
  return queryString.stringify(queryObj);
}

export function getFullUrl(data) {
  let fullUrl = data && data.url;
  if (!fullUrl) {
    return fullUrl;
  }

  if (!isEmpty(data.query)) {
    fullUrl += '?' + stringifyQueryList(data.query);
  }

  if (data.fragment) {
    fullUrl += '#' + data.fragment;
  }

  return fullUrl;
}

/**
 * Converts an object of body/querystring key/value pairs
 * into a tuple of [key, value] pairs, and sorts them.
 *
 * This handles the case for query strings that were decoded like so:
 *
 *   ?foo=bar&foo=baz => { foo: ['bar', 'baz'] }
 *
 * By converting them to [['foo', 'bar'], ['foo', 'baz']]
 */
export function objectToSortedTupleArray(obj) {
  return Object.keys(obj)
    .reduce((out, k) => {
      const val = obj[k];
      return out.concat(
        {}.toString.call(val) === '[object Array]'
          ? val.map(v => [k, v]) // key has multiple values (array)
          : [[k, val]] // key has single value
      );
    }, [])
    .sort(function([keyA, valA], [keyB, valB]) {
      // if keys are identical, sort on value
      if (keyA === keyB) {
        return valA < valB ? -1 : 1;
      }

      return keyA < keyB ? -1 : 1;
    });
}
