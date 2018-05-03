import _ from 'lodash';

// import/export sub-utils
import parseLinkHeader from 'app/utils/parseLinkHeader';
import deviceNameMapper from 'app/utils/deviceNameMapper';
import Collection from 'app/utils/collection';
import PendingChangeQueue from 'app/utils/pendingChangeQueue';
import CursorPoller from 'app/utils/cursorPoller';
import StreamManager from 'app/utils/streamManager';

/*eslint no-use-before-define:0*/

const arrayIsEqual = function(arr, other, deep) {
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

  return arr.every((val, idx) => valueIsEqual(val, other[idx], deep));
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

const objectMatchesSubset = function(obj, other, deep) {
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

export const intcomma = function(x) {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

export function sortArray(arr, score_fn) {
  arr.sort((a, b) => {
    let a_score = score_fn(a),
      b_score = score_fn(b);

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
  return str.replace(/^\s+|\s+$/g, '');
}

/**
 * Replaces slug special chars with a space
 */
export function explodeSlug(slug) {
  return trim(slug.replace(/[-_]+/g, ' '));
}

export function defined(item) {
  return !_.isUndefined(item) && item !== null;
}

export function nl2br(str) {
  return str.replace(/(?:\r\n|\r|\n)/g, '<br />');
}

export function isUrl(str) {
  return (
    !!str &&
    _.isString(str) &&
    (str.indexOf('http://') === 0 || str.indexOf('https://') === 0)
  );
}

export function escape(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function percent(value, totalValue, precise) {
  return value / totalValue * 100;
}

export function toTitleCase(str) {
  return str.replace(/\w\S*/g, txt => {
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
}

export function formatBytes(bytes) {
  let units = ['KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
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
  let match = version.match(
    /^(?:[a-zA-Z][a-zA-Z0-9-]+)(?:\.[a-zA-Z][a-zA-Z0-9-]+)+-(.*)$/
  );
  if (match) {
    version = match[1];
  }
  if (version.match(/^[a-f0-9]{40}$/)) {
    version = version.substr(0, 7);
  }
  return version;
}

export function parseRepo(repo) {
  if (!repo) {
    return repo;
  } else {
    let re = /(?:github\.com|bitbucket\.org)\/([^\/]+\/[^\/]+)/i;
    let match = repo.match(re);
    let parsedRepo = match ? match[1] : repo;
    return parsedRepo;
  }
}

/**
 * Converts a multi-line textarea input value into an array,
 * eliminating empty lines
 */
export function extractMultilineFields(value) {
  return value
    .split('\n')
    .map(f => trim(f))
    .filter(f => f !== '');
}

function projectDisplayCompare(a, b) {
  if (a.isBookmarked !== b.isBookmarked) {
    return a.isBookmarked ? -1 : 1;
  }
  return a.slug.localeCompare(b.slug);
}

// Sort a list of projects by bookmarkedness, then by id
export function sortProjects(projects) {
  return projects.sort(projectDisplayCompare);
}

//build actorIds
export const buildUserId = id => `user:${id}`;
export const buildTeamId = id => `team:${id}`;

// re-export under utils
export {parseLinkHeader, deviceNameMapper, Collection, PendingChangeQueue, CursorPoller};

// backwards compatible default export for use w/ getsentry (exported
// as a single object w/ function refs for consumption by getsentry)
export default {
  sortArray,
  objectIsEmpty,
  defined,
  nl2br,
  isUrl,
  escape,
  percent,
  toTitleCase,
  intcomma,
  valueIsEqual,
  parseLinkHeader,
  buildUserId,
  buildTeamId,

  // external imports
  deviceNameMapper,
  objectToArray,
  Collection,
  PendingChangeQueue,
  StreamManager,
  CursorPoller,
};
