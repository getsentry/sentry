import type {Tag, TagCollection} from 'sentry/types/group';
import {FieldKey, FieldKind, prettifyTagKey} from 'sentry/utils/fields';

export const getHasTag = (tags: TagCollection) => ({
  key: FieldKey.HAS,
  name: 'Has property',
  values: Object.keys(tags).sort((a, b) => {
    return a.toLowerCase().localeCompare(b.toLowerCase());
  }),
  predefined: true,
  kind: FieldKind.FIELD,
});

const EXPLICIT_TAG_KEY_PATTERN = /^tags\[(.*),(string|number|boolean)\]$/;

type ExplicitTagType = 'string' | 'number' | 'boolean';

export type TagResolverItem = {
  options?: TagResolverItem[];
  tag?: Tag;
  textValue?: string;
  value?: string;
};

function getExplicitTagType(key: string): ExplicitTagType | null {
  const tagType = key.match(EXPLICIT_TAG_KEY_PATTERN)?.[2];
  switch (tagType) {
    case 'string':
    case 'number':
    case 'boolean':
      return tagType;
    default:
      return null;
  }
}

export function getExplicitTagBaseKey(key: string): string {
  return key.match(EXPLICIT_TAG_KEY_PATTERN)?.[1] ?? key;
}

function isQuotedExplicitTagKey(key: string): boolean {
  const tagName = getExplicitTagBaseKey(key);
  return !!tagName?.startsWith('"') && tagName.endsWith('"');
}

function tagMatchesInput(tag: Tag, input: string): boolean {
  const prettyKey = prettifyTagKey(tag.key);
  const matchValues = new Set([tag.key, prettyKey]);

  // Quoted explicit tag keys must be typed with their quotes. Their `name` can be
  // unquoted, so do not allow it as an alias unless it exactly matches the visible
  // pretty key.
  if (tag.name && (!isQuotedExplicitTagKey(tag.key) || tag.name === prettyKey)) {
    matchValues.add(tag.name);
  }

  return matchValues.has(input);
}

function tagFromResolverItem(item: TagResolverItem): Tag | null {
  if (item.tag) {
    return item.tag;
  }

  if (!item.value) {
    return null;
  }

  return {
    key: item.value,
    name: item.textValue ?? prettifyTagKey(item.value),
  };
}

export function getTagsFromResolverItems(items: TagResolverItem[]): Tag[] {
  return items.flatMap(item => {
    if (item.options) {
      return getTagsFromResolverItems(item.options);
    }

    const tag = tagFromResolverItem(item);
    return tag ? [tag] : [];
  });
}

export function findExplicitTagKeyMatch(tags: Tag[], input: string): string | null {
  for (const tagType of ['string', 'number', 'boolean'] satisfies ExplicitTagType[]) {
    const match = tags.find(
      tag => getExplicitTagType(tag.key) === tagType && tagMatchesInput(tag, input)
    );
    if (match) {
      return match.key;
    }
  }

  return null;
}
