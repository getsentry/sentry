/*** @jsx React.DOM */


var objectMatchesSubset = function(obj, other, deep){
  var k;

  if (deep !== true) {
    for (k in other) {
      if (obj[k] != other[k]) {
        return false;
      }
    }
    return true;
  }

  for (k in other) {
    if (obj[k] === other[k]) {
      continue;
    }

    if (obj[k] instanceof Array || other[k] instanceof Array) {
      if (!arrayIsEqual(obj[k], other[k])) {
        return false;
      }
      continue;
    }

    if (obj[k] instanceof Object || other[k] instanceof Object) {
      if (!objectMatchesSubset(obj[k], other[k])) {
        return false;
      }
      continue;
    }
  }
  return true;
};

var arrayIsEqual = function(arr, other) {
  // if the other array is a falsy value, return
  if (!arr || !other) {
    return false;
  }

  // compare lengths - can save a lot of time
  if (arr.length != other.length) {
    return false;
  }

  for (var i = 0, l = arr.length; i < l; i++) {
    // Warning - two different object instances will never be equal: {x:20} != {x:20}
    if (arr[i] != other[i]) {
      return false;
    }
  }
  return true;
};

module.exports = {
  getQueryParams() {
    var vars = {},
        href = window.location.href,
        hashes, hash;

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

  sortArray(arr, score_fn) {
    arr.sort((a, b) => {
      var a_score = score_fn(a),
          b_score = score_fn(b);

      for (var i = 0; i < a_score.length; i++) {
        if (a_score[i] < b_score[i]) {
          return 1;
        }
        if (a_score[i] > b_score[i]) {
          return -1;
        }
      }
      return 0;
    });

    return arr;
  },

  objectIsEmpty(obj) {
    for (var prop in obj) {
      if (obj.hasOwnProperty(prop)) {
        return false;
      }
    }

    return true;
  },

  nl2br(str) {
    return str.replace(/\r?\n/, '<br />');
  },

  escape(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
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

  arrayIsEqual: arrayIsEqual,
  objectMatchesSubset: objectMatchesSubset,
  parseLinkHeader: require('./utils/parseLinkHeader'),

  Collection: require('./utils/collection'),
  PendingChangeQueue: require('./utils/pendingChangeQueue'),
  StreamManager: require('./utils/streamManager'),
  CursorPoller: require('./utils/cursorPoller')
};
