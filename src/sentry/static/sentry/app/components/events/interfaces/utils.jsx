import {defined} from '../../../utils';
import _ from 'underscore';

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
  let compressed = data.headers.find(h => h[0] === 'Accept-Encoding' && h[1].indexOf('gzip') !== -1);
  if (compressed) {
    result += ' \\\n --compressed';
  }

  // sort headers
  let headers = data.headers.sort(function (a, b) {
    return a[0] === b[0] ? 0 :
      a[0] < b[0] ? -1 : 1;
  });

  for (let header of headers) {
    result += ' \\\n -H "' + header[0] + ': ' + escapeQuotes(header[1] + '') + '"';
  }

  if (_.isString(data.data)) {
    result += ' \\\n --data "' + escapeQuotes(data.data) + '"';
  } else if (defined(data.data)) {
    result += ' \\\n --data "' + escapeQuotes(jQuery.param(data.data)) + '"';
  }

  result += ' \\\n "' + data.url;

  if (defined(data.query) && data.query) {
    result += '?' + data.query;
  }

  result += '"';
  return result;
}
