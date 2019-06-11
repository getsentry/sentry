import _ from 'lodash';

function arrayIsEqual(arr, other, deep) {
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
}

export function valueIsEqual(value, other, deep) {
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
}

function objectMatchesSubset(obj, other, deep) {
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
}

// XXX(dcramer): the previous mechanism of using _.map here failed
// miserably if a param was named 'length'
export function objectToArray(obj) {
  const result = [];
  for (const key in obj) {
    result.push([key, obj[key]]);
  }
  return result;
}

export function intcomma(x) {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function sortArray(arr, score_fn) {
  arr.sort((a, b) => {
    const a_score = score_fn(a),
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
  for (const prop in obj) {
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

/**
 * This function has a critical security impact, make sure to check all usages before changing this function.
 * In some parts of our code we rely on that this only really is a string starting with http(s).
 */
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
  return (value / totalValue) * 100;
}

export function toTitleCase(str) {
  return str.replace(/\w\S*/g, txt => {
    return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
  });
}

export function formatBytes(bytes) {
  const units = ['KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const thresh = 1024;
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
  if (version.length < 12) {
    return version;
  }

  const match = version.match(
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
    const re = /(?:github\.com|bitbucket\.org)\/([^\/]+\/[^\/]+)/i;
    const match = repo.match(re);
    const parsedRepo = match ? match[1] : repo;
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

/**
 * Removes the organization / project scope prefix on feature names.
 */
export function descopeFeatureName(feature) {
  return typeof feature.match !== 'function'
    ? feature
    : feature.match(/(?:^(?:projects|organizations):)?(.*)/).pop();
}

export function isWebpackChunkLoadingError(error) {
  return (
    error &&
    typeof error.message === 'string' &&
    error.message.toLowerCase().includes('loading chunk')
  );
}

/**
 * This parses our period shorthand strings (e.g. <int><unit>)
 * and converts it into hours
 */
export function parsePeriodToHours(str) {
  const [, periodNumber, periodLength] = str.match(/([0-9]+)([smhdw])/);

  switch (periodLength) {
    case 's':
      return periodNumber / (60 * 60);
    case 'm':
      return periodNumber / 60;
    case 'h':
      return periodNumber;
    case 'd':
      return periodNumber * 24;
    case 'w':
      return periodNumber * 24 * 7;
    default:
      return -1;
  }
}

export function deepFreeze(object) {
  // Retrieve the property names defined on object
  const propNames = Object.getOwnPropertyNames(object);
  // Freeze properties before freezing self
  for (const name of propNames) {
    const value = object[name];

    object[name] = value && typeof value === 'object' ? deepFreeze(value) : value;
  }

  return Object.freeze(object);
}
