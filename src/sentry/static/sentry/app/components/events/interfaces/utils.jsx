import {isString} from 'lodash';
import {defined} from 'app/utils';

export function escapeQuotes(v) {
  return v.replace(/"/g, '\\"');
}

// TODO(dcramer): support cookies
export function getCurlCommand(data) {
  let result = 'curl';

  if (defined(data.method) && data.method !== 'GET') {
    result += ' \\\n -X ' + data.method;
  }

  // TODO(benvinegar): just gzip? what about deflate?
  let compressed = data.headers.find(
    h => h[0] === 'Accept-Encoding' && h[1].indexOf('gzip') !== -1
  );
  if (compressed) {
    result += ' \\\n --compressed';
  }

  // sort headers
  let headers = data.headers.sort(function(a, b) {
    return a[0] === b[0] ? 0 : a[0] < b[0] ? -1 : 1;
  });

  for (let header of headers) {
    result += ' \\\n -H "' + header[0] + ': ' + escapeQuotes(header[1] + '') + '"';
  }

  if (defined(data.data)) {
    switch (data.inferredContentType) {
      case 'application/json':
        result += ' \\\n --data "' + escapeQuotes(JSON.stringify(data.data)) + '"';
        break;
      case 'application/x-www-form-urlencoded':
        result += ' \\\n --data "' + escapeQuotes(jQuery.param(data.data)) + '"';
        break;
      default:
        if (isString(data.data)) {
          result += ' \\\n --data "' + escapeQuotes(data.data) + '"';
        } else {
          Raven.captureMessage('Unknown event data', {
            extra: data,
          });
        }
    }
  }

  result += ' \\\n "' + data.url;

  if (defined(data.query) && data.query) {
    result += '?' + data.query;
  }

  result += '"';
  return result;
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
      let val = obj[k];
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
