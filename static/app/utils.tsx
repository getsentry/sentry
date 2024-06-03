import type {Query} from 'history';

import type {EventTag} from 'sentry/types/event';
import {formatNumberWithDynamicDecimalPoints} from 'sentry/utils/formatters';
import {appendTagCondition} from 'sentry/utils/queryString';

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
  }
  if (Array.isArray(value) || Array.isArray(other)) {
    if (arrayIsEqual(value, other, deep)) {
      return true;
    }
  } else if (
    (value && typeof value === 'object') ||
    (other && typeof other === 'object')
  ) {
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

/**
 * Replaces slug special chars with a space
 */
export function explodeSlug(slug: string): string {
  return slug.replace(/[-_]+/g, ' ').trim();
}

export function defined<T>(item: T): item is Exclude<T, null | undefined> {
  return item !== undefined && item !== null;
}

export function nl2br(str: string): string {
  return str.replace(/(?:\r\n|\r|\n)/g, '<br />');
}

export function escape(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function percent(value: number, totalValue: number): number {
  // prevent division by zero
  if (totalValue === 0) {
    return 0;
  }

  return (value / totalValue) * 100;
}

/**
 * Note the difference between *a-bytes (base 10) vs *i-bytes (base 2), which
 * means that:
 * - 1000 megabytes is equal to 1 gigabyte
 * - 1024 mebibytes is equal to 1 gibibytes
 *
 * We will use base 10 throughout billing for attachments. This function formats
 * quota/usage values for display.
 *
 * For storage/memory/file sizes, please take a look at formatBytesBase2
 */
export function formatBytesBase10(bytes: number, u: number = 0) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const threshold = 1000;

  while (bytes >= threshold) {
    bytes /= threshold;
    u += 1;
  }

  return formatNumberWithDynamicDecimalPoints(bytes) + ' ' + units[u];
}

/**
 * Note the difference between *a-bytes (base 10) vs *i-bytes (base 2), which
 * means that:
 * - 1000 megabytes is equal to 1 gigabyte
 * - 1024 mebibytes is equal to 1 gibibytes
 *
 * We will use base 2 to display storage/memory/file sizes as that is commonly
 * used by Windows or RAM or CPU cache sizes, and it is more familiar to the user
 *
 * For billing-related code around attachments. please take a look at
 * formatBytesBase10
 */
export function formatBytesBase2(bytes: number, fixPoints: number | false = 1): string {
  const units = ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
  const thresh = 1024;
  if (bytes < thresh) {
    return (
      (fixPoints === false
        ? formatNumberWithDynamicDecimalPoints(bytes)
        : bytes.toFixed(fixPoints)) + ' B'
    );
  }

  let u = -1;
  do {
    bytes /= thresh;
    ++u;
  } while (bytes >= thresh);
  return (
    (fixPoints === false
      ? formatNumberWithDynamicDecimalPoints(bytes)
      : bytes.toFixed(fixPoints)) +
    ' ' +
    units[u]
  );
}

export function getShortCommitHash(hash: string): string {
  if (hash.match(/^[a-f0-9]{40}$/)) {
    hash = hash.substring(0, 7);
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
export function extractMultilineFields(value: string): string[] {
  return value
    .split('\n')
    .map(f => f.trim())
    .filter(f => f !== '');
}

/**
 * If the value is of type Array, converts it to type string, keeping the line breaks, if there is any
 */
export function convertMultilineFieldValue<T extends string | string[]>(
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

// build actorIds
export const buildUserId = (id: string) => `user:${id}`;
export const buildTeamId = (id: string) => `team:${id}`;

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

export function generateQueryWithTag(prevQuery: Query, tag: EventTag): Query {
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

// NOTE: only escapes a " if it's not already escaped
export function escapeDoubleQuotes(str: string) {
  return str.replace(/\\([\s\S])|(")/g, '\\$1$2');
}

export function generateOrgSlugUrl(orgSlug) {
  const sentryDomain = window.__initialData.links.sentryUrl.split('/')[2];
  return `${window.location.protocol}//${orgSlug}.${sentryDomain}${window.location.pathname}`;
}
