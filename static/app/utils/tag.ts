import type {Tag, TagCollection} from 'sentry/types/group';
import {FieldKey, FieldKind, prettifyTagKey} from 'sentry/utils/fields';

export function isBareFilterKey(key: string) {
  return prettifyTagKey(key) === key;
}

/**
 * Prefer bare keys over their explicit `tags[key,type]` twins.
 * Keep distinct typed explicit keys when no bare key exists.
 */
export function collapseDuplicateFilterKeyNames(keys: string[]): string[] {
  const bareKeys = new Set(keys.filter(isBareFilterKey));
  const seen = new Set<string>();
  const collapsed: string[] = [];

  for (const key of keys) {
    if (isBareFilterKey(key)) {
      if (!seen.has(key)) {
        seen.add(key);
        collapsed.push(key);
      }
      continue;
    }

    const prettyKey = prettifyTagKey(key);
    if (bareKeys.has(prettyKey) || seen.has(key)) {
      continue;
    }

    seen.add(key);
    collapsed.push(key);
  }

  return collapsed;
}

/**
 * Collapse bare keys and their explicit `tags[key,type]` twins for display.
 * Prefer the bare/canonical key when both exist.
 */
export function collapseDuplicateFilterKeys(keys: Tag[]): Tag[] {
  const byKey = new Map(keys.map(tag => [tag.key, tag]));
  return collapseDuplicateFilterKeyNames(keys.map(tag => tag.key))
    .map(key => byKey.get(key))
    .filter((tag): tag is Tag => tag !== undefined);
}

export function isRedundantExplicitFilterKey(
  key: string,
  existingKeys: Set<string>
): boolean {
  if (existingKeys.has(key)) {
    return true;
  }

  const prettyKey = prettifyTagKey(key);
  return !isBareFilterKey(key) && existingKeys.has(prettyKey);
}

export const getHasTag = (tags: TagCollection) => ({
  key: FieldKey.HAS,
  name: 'Has property',
  values: collapseDuplicateFilterKeyNames(Object.keys(tags)).sort((a, b) => {
    return a.toLowerCase().localeCompare(b.toLowerCase());
  }),
  predefined: true,
  kind: FieldKind.FIELD,
});
