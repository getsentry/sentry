/**
 * Replaces slug special chars with a space
 */
export function explodeSlug(slug: string): string {
  return slug.replace(/[-_]+/g, ' ').trim();
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
 * Converts a multi-line textarea input value into an array, eliminating empty lines.
 * Safely handles unknown input types for form field getValue callbacks.
 */
export function extractMultilineFields(value: unknown): string[] {
  // User input
  if (typeof value === 'string') {
    return value
      .split('\n')
      .map(f => f.trim())
      .filter(f => f !== '');
  }
  // API response / undo form save action
  if (Array.isArray(value) && value.every(item => typeof item === 'string')) {
    return value;
  }

  return [];
}

/**
 * Converts a value to a multi-line string for display in textarea.
 * Safely handles unknown input types for form field setValue callbacks.
 */
export function convertMultilineFieldValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value) && value.every(item => typeof item === 'string')) {
    return value.join('\n');
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

// NOTE: only escapes a " if it's not already escaped
export function escapeDoubleQuotes(str: string) {
  return str.replace(/\\([\s\S])|(")/g, '\\$1$2');
}

export function generateOrgSlugUrl(orgSlug: any) {
  const sentryDomain = window.__initialData.links.sentryUrl.split('/')[2];
  return `${window.location.protocol}//${orgSlug}.${sentryDomain}${window.location.pathname}`;
}

export function isNumericString(value: string): boolean {
  const s = value.trim();

  if (!s) {
    return false;
  }

  return /^-?(?:\d+|\d*\.\d+)(?:[eE][+-]?\d+)?$/.test(s);
}
