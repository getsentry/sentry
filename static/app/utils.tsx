import type {Query} from 'history';

import type {EventTag} from 'sentry/types/event';
import {
  ISSUE_EVENT_FIELDS_THAT_MAY_CONFLICT_WITH_TAGS,
  type FieldKey,
} from 'sentry/utils/fields';
import {appendTagCondition} from 'sentry/utils/queryString';

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
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function percent(value: number, totalValue: number): number {
  // prevent division by zero
  if (totalValue === 0) {
    return 0;
  }

  return (value / totalValue) * 100;
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

/**
 * If a tag conflicts with a reserved keyword, change it to `tags[key]:value`
 */
export function escapeIssueTagKey(key: string) {
  if (key === '') {
    return '""';
  }

  // Environment and project should be handled by the page filter
  if (key === 'environment' || key === 'project') {
    return key;
  }

  // Reserved keywords that conflict with issue search query
  if (['project.name', 'project_id'].includes(key)) {
    return `tags[${key}]`;
  }

  if (ISSUE_EVENT_FIELDS_THAT_MAY_CONFLICT_WITH_TAGS.has(key as FieldKey)) {
    return `tags[${key}]`;
  }

  return key;
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

  // Checking for the absence of a tag value.
  if (tag.value === '') {
    query.query = `!has:${tag.key}`;
  }

  return query;
}

// NOTE: only escapes a " if it's not already escaped
export function escapeDoubleQuotes(str: string) {
  return str.replace(/\\([\s\S])|(")/g, '\\$1$2');
}

export function generateOrgSlugUrl(orgSlug: any) {
  const sentryDomain = window.__initialData.links.sentryUrl.split('/')[2];
  return `${window.location.protocol}//${orgSlug}.${sentryDomain}${window.location.pathname}`;
}

/**
 * Encodes given object into url-friendly format
 */
export function urlEncode(object: Record<string, any>): string {
  return Object.keys(object)
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(object[key])}`)
    .join('&');
}
