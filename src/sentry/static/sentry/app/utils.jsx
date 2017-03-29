import _ from 'underscore';

/*eslint no-use-before-define:0*/
export const modelsEqual = function(obj1, obj2) {
  if (!obj1 && !obj2)
    return true;
  if (obj1.id && !obj2)
    return false;
  if (obj2.id && !obj1)
    return false;
  return obj1.id === obj2.id;
};

export const arrayIsEqual = function(arr, other, deep) {
  // if the other array is a falsy value, return
  if (!arr && !other) {
    return true;
  }

  if (!arr || !other) {
    return false;
  }

  // compare lengths - can save a lot of time
  if (arr.length != other.length) {
    return false;
  }

  for (let i = 0, l = Math.max(arr.length, other.length); i < l; i++) {
    return valueIsEqual(arr[i], other[i], deep);
  }
};

export const valueIsEqual = function(value, other, deep) {
  if (value === other) {
    return true;
  } else if (_.isArray(value) || _.isArray(other)) {
    if (arrayIsEqual(value, other, deep)) {
      return true;
    }
  } else if (_.isObject(value) || _.isObject(other)) {
    if (objectMatchesSubset(value, other, deep)) {
      return true;
    }
  }
  return false;
};

export const objectMatchesSubset = function(obj, other, deep){
  let k;

  if (obj === other) {
    return true;
  }

  if (!obj || !other) {
    return false;
  }

  if (deep !== true) {
    for (k in other) {
      if (obj[k] != other[k]) {
        return false;
      }
    }
    return true;
  }

  for (k in other) {
    if (!valueIsEqual(obj[k], other[k], deep)) {
      return false;
    }
  }
  return true;
};

// XXX(dcramer): the previous mechanism of using _.map here failed
// miserably if a param was named 'length'
export const objectToArray = function(obj) {
  let result = [];
  for (let key in obj) {
    result.push([key, obj[key]]);
  }
  return result;
};

export const compareArrays = function(arr1, arr2, compFunc) {
  if (arr1 === arr2) {
    return true;
  }
  if (!arr1) {
    arr1 = [];
  }
  if (!arr2) {
    arr2 = [];
  }

  if (arr1.length != arr2.length) {
    return false;
  }

  for (let i = 0; i < Math.max(arr1.length, arr2.length); i++) {
    if (!arr1[i]) {
      return false;
    }
    if (!arr2[i]) {
      return false;
    }
    if (!compFunc(arr1[i], arr2[i])) {
      return false;
    }
  }
  return true;
};

export const intcomma = function(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

export function getQueryParams() {
  let hashes, hash;
  let vars = {}, href = window.location.href;

  if (href.indexOf('?') == -1)
    return vars;

  hashes = href.slice(
    href.indexOf('?') + 1,
    (href.indexOf('#') != -1 ? href.indexOf('#') : href.length)
  ).split('&');

  hashes.forEach((chunk) => {
    hash = chunk.split('=');
    if (!hash[0] && !hash[1]) {
      return;
    }

    vars[decodeURIComponent(hash[0])] = (hash[1] ? decodeURIComponent(hash[1]).replace(/\+/, ' ') : '');
  });

  return vars;
}

export function sortArray(arr, score_fn) {
  arr.sort((a, b) => {
    let a_score = score_fn(a), b_score = score_fn(b);

    for (let i = 0; i < a_score.length; i++) {
      if (a_score[i] > b_score[i]) {
        return 1;
      }
      if (a_score[i] < b_score[i]) {
        return -1;
      }
    }
    return 0;
  });

  return arr;
}

export function objectIsEmpty(obj) {
  for (let prop in obj) {
    if (obj.hasOwnProperty(prop)) {
      return false;
    }
  }

  return true;
}

export function trim(str) {
  return str.replace(/^\s+|\s+$/g,'');
}

export function defined(item) {
  return !_.isUndefined(item) && item !== null;
}

export function nl2br(str) {
  return str.replace(/(?:\r\n|\r|\n)/g, '<br />');
}

export function isUrl(str) {
  return !!str && _.isString(str) && (str.indexOf('http://') === 0 || str.indexOf('https://') === 0);
}

export function escape(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

export function percent(value, totalValue, precise) {
  return value / totalValue * 100;
}

export function urlize(str) {
  // TODO
  return str;
}

export function toTitleCase(str) {
  return str.replace(/\w\S*/g, (txt) => {
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
}

export function formatBytes(bytes) {
  let units = ['KB','MB','GB','TB','PB','EB','ZB','YB'];
  let thresh = 1024;
  if (bytes < thresh) {
    return bytes + ' B';
  }

  let u = -1;
  do {
    bytes /= thresh;
    ++u;
  } while (bytes >= thresh);
  return bytes.toFixed(1) + ' ' + units[u];
}

export function getShortVersion(version) {
  return version.match(/^[a-f0-9]{40}$/) ? version.substr(0, 12) : version;
}

/**
 * Converts a multi-line textarea input value into an array,
 * eliminating empty lines
 */
export function extractMultilineFields(value) {
  return value.split('\n').map(f => trim(f)).filter(f => f !== '');
}

// import/export sub-utils
import parseLinkHeader from './utils/parseLinkHeader';
import deviceNameMapper from './utils/deviceNameMapper';
import Collection from './utils/collection';
import PendingChangeQueue from './utils/pendingChangeQueue';
import CursorPoller from './utils/cursorPoller';
import StreamManager from './utils/streamManager';

// re-export under utils
export {
  parseLinkHeader,
  deviceNameMapper,
  Collection,
  PendingChangeQueue,
  CursorPoller
};


// backwards compatible default export for use w/ getsentry (exported
// as a single object w/ function refs for consumption by getsentry)
export default {
  getQueryParams: getQueryParams,
  sortArray: sortArray,
  objectIsEmpty: objectIsEmpty,
  trim: trim,
  defined: defined,
  nl2br: nl2br,
  isUrl: isUrl,
  escape: escape,
  percent: percent,
  urlize: urlize,
  toTitleCase: toTitleCase,
  arrayIsEqual: arrayIsEqual,
  objectMatchesSubset: objectMatchesSubset,
  compareArrays: compareArrays,
  intcomma: intcomma,
  modelsEqual: modelsEqual,
  valueIsEqual: valueIsEqual,
  parseLinkHeader: parseLinkHeader,

  // external imports
  deviceNameMapper: deviceNameMapper,
  objectToArray: objectToArray,
  Collection: Collection,
  PendingChangeQueue: PendingChangeQueue,
  StreamManager: StreamManager,
  CursorPoller: CursorPoller
};
