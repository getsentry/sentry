import _ from 'underscore';

/*eslint no-use-before-define:0*/
const modelsEqual = function(obj1, obj2) {
  if (!obj1 && !obj2)
    return true;
  if (obj1.id && !obj2)
    return false;
  if (obj2.id && !obj1)
    return false;
  return obj1.id === obj2.id;
};

const objectMatchesSubset = function(obj, other, deep){
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
    if (!_.isEqual(obj[k], other[k], deep)) {
      return false;
    }
  }
  return true;
};

// XXX(dcramer): the previous mechanism of using _.map here failed
// miserably if a param was named 'length'
const objectToArray = function(obj) {
  let result = [];
  for (let key in obj) {
    result.push([key, obj[key]]);
  }
  return result;
};

const compareArrays = function(arr1, arr2, compFunc) {
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

const intcomma = function(x) {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

export default {
  getQueryParams() {
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
  },

  trim(str) {
    return str.replace(/^\s+|\s+$/g,'');
  },

  defined(item) {
    return !_.isUndefined(item) && item !== null;
  },

  nl2br(str) {
    return str.replace(/(?:\r\n|\r|\n)/g, '<br />');
  },

  isUrl(str) {
    return !!str && _.isString(str) && (str.indexOf('http://') === 0 || str.indexOf('https://') === 0);
  },

  percent(value, totalValue, precise) {
    return value / totalValue * 100;
  },

  urlize(str) {
    // TODO
    return str;
  },

  toTitleCase(str) {
    return str.replace(/\w\S*/g, (txt) => {
      return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
  },

  arrayIsEqual: _.isEqual,
  objectMatchesSubset: objectMatchesSubset,
  compareArrays: compareArrays,
  escape: _.escape,
  sortArray: _.sortBy,
  objectIsEmpty: _.isEmpty,
  intcomma: intcomma,
  modelsEqual: modelsEqual,
  valueIsEqual: _.isEqual,
  parseLinkHeader: require('./utils/parseLinkHeader'),
  deviceNameMapper: require('./utils/deviceNameMapper'),
  objectToArray: objectToArray,

  Collection: require('./utils/collection'),
  PendingChangeQueue: require('./utils/pendingChangeQueue'),
  StreamManager: require('./utils/streamManager'),
  CursorPoller: require('./utils/cursorPoller'),
};
