import {Query} from 'history';
import isArray from 'lodash/isArray';
import isObject from 'lodash/isObject';
import isString from 'lodash/isString';
import isUndefined from 'lodash/isUndefined';

import {Project} from 'app/types';
import {appendTagCondition} from 'app/utils/queryString';

function arrayIsEqual(arr?: any[], other?: any[], deep?: boolean): boolean {
  // if the other array is a falsy value, return
  if (!arr && !other) {
    return true;
  }

  if (!arr || !other) {
    return false;
  }

  // compare lengths - can save a lot of time
  if (arr.length !== other.length) {
    return false;
  }

  return arr.every((val, idx) => valueIsEqual(val, other[idx], deep));
}

export function valueIsEqual(value?: any, other?: any, deep?: boolean): boolean {
  if (value === other) {
    return true;
  } else if (isArray(value) || isArray(other)) {
    if (arrayIsEqual(value, other, deep)) {
      return true;
    }
  } else if (isObject(value) || isObject(other)) {
    if (objectMatchesSubset(value, other, deep)) {
      return true;
    }
  }
  return false;
}

function objectMatchesSubset(obj?: object, other?: object, deep?: boolean): boolean {
  let k: string;

  if (obj === other) {
    return true;
  }

  if (!obj || !other) {
    return false;
  }

  if (deep !== true) {
    for (k in other) {
      if (obj[k] !== other[k]) {
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

export function intcomma(x: number): string {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function sortArray<T>(arr: Array<T>, score_fn: (entry: T) => string): Array<T> {
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

export function objectIsEmpty(obj?: object): boolean {
  for (const prop in obj) {
    if (obj.hasOwnProperty(prop)) {
      return false;
    }
  }

  return true;
}

export function trim(str: string): string {
  return str.replace(/^\s+|\s+$/g, '');
}

/**
 * Replaces slug special chars with a space
 */
export function explodeSlug(slug: string): string {
  return trim(slug.replace(/[-_]+/g, ' '));
}

export function defined<T>(item: T): item is Exclude<T, null | undefined> {
  return !isUndefined(item) && item !== null;
}

export function nl2br(str: string): string {
  return str.replace(/(?:\r\n|\r|\n)/g, '<br />');
}

/**
 * This function has a critical security impact, make sure to check all usages before changing this function.
 * In some parts of our code we rely on that this only really is a string starting with http(s).
 */
export function isUrl(str: any): boolean {
  return (
    !!str &&
    isString(str) &&
    (str.indexOf('http://') === 0 || str.indexOf('https://') === 0)
  );
}

export function escape(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function percent(value: number, totalValue: number): number {
  // prevent division by zero
  if (totalValue === 0) {
    return 0;
  }

  return (value / totalValue) * 100;
}

export function toTitleCase(str: string): string {
  return str.replace(
    /\w\S*/g,
    txt => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  );
}

export function formatBytes(bytes: number): string {
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

export function getShortCommitHash(hash: string): string {
  if (hash.match(/^[a-f0-9]{40}$/)) {
    hash = hash.substr(0, 7);
  }
  return hash;
}

export function parseRepo<T>(repo: T): T {
  if (typeof repo === 'string') {
    const re = /(?:github\.com|bitbucket\.org)\/([^\/]+\/[^\/]+)/i;
    const match = repo.match(re);
    const parsedRepo = match ? match[1] : repo;
    return parsedRepo as any;
  }

  return repo;
}

/**
 * Converts a multi-line textarea input value into an array,
 * eliminating empty lines
 */
export function extractMultilineFields(value: string): Array<string> {
  return value
    .split('\n')
    .map(f => trim(f))
    .filter(f => f !== '');
}

/**
 * If the value is of type Array, converts it to type string, keeping the line breaks, if there is any
 */
export function convertMultilineFieldValue<T extends string | Array<string>>(
  value: T
): string {
  if (Array.isArray(value)) {
    return value.join('\n');
  }

  if (typeof value === 'string') {
    return value.split('\n').join('\n');
  }

  return '';
}

function projectDisplayCompare(a: Project, b: Project): number {
  if (a.isBookmarked !== b.isBookmarked) {
    return a.isBookmarked ? -1 : 1;
  }
  return a.slug.localeCompare(b.slug);
}

// Sort a list of projects by bookmarkedness, then by id
export function sortProjects(projects: Array<Project>): Array<Project> {
  return projects.sort(projectDisplayCompare);
}

//build actorIds
export const buildUserId = id => `user:${id}`;
export const buildTeamId = id => `team:${id}`;

/**
 * Removes the organization / project scope prefix on feature names.
 */
export function descopeFeatureName<T>(feature: T): T | string {
  if (typeof feature !== 'string') {
    return feature;
  }

  const results = feature.match(/(?:^(?:projects|organizations):)?(.*)/);

  if (results && results.length > 0) {
    return results.pop()!;
  }

  return feature;
}

export function isWebpackChunkLoadingError(error: Error): boolean {
  return (
    error &&
    typeof error.message === 'string' &&
    error.message.toLowerCase().includes('loading chunk')
  );
}

export function deepFreeze<T>(object: T) {
  // Retrieve the property names defined on object
  const propNames = Object.getOwnPropertyNames(object);
  // Freeze properties before freezing self
  for (const name of propNames) {
    const value = object[name];

    object[name] = value && typeof value === 'object' ? deepFreeze(value) : value;
  }

  return Object.freeze(object);
}

export type OmitHtmlDivProps<P extends object> = Omit<
  React.HTMLProps<HTMLDivElement>,
  keyof P
> &
  P;

export function generateQueryWithTag(
  prevQuery: Query,
  tag: {key: string; value: string}
): Query {
  const query = {...prevQuery};

  // some tags are dedicated query strings since other parts of the app consumes this,
  // for example, the global selection header.
  switch (tag.key) {
    case 'environment':
      query.environment = tag.value;
      break;
    case 'project':
      query.project = tag.value;
      break;
    default:
      query.query = appendTagCondition(query.query, tag.key, tag.value);
  }

  return query;
}

export const isFunction = (value: any): value is Function => typeof value === 'function';

// NOTE: only escapes a " if it's not already escaped
export function escapeDoubleQuotes(str) {
  return str.replace(/\\([\s\S])|(")/g, '\\$1$2');
}
