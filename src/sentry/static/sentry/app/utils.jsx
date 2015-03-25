/*** @jsx React.DOM */

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

  parseLinkHeader: require('./utils/parseLinkHeader'),

  Collection: require('./utils/collection'),
  PendingChangeQueue: require('./utils/pendingChangeQueue'),
  StreamManager: require('./utils/streamManager'),
  StreamPoller: require('./utils/streamPoller')
};
