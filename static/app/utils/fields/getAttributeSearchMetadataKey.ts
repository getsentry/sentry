import {ATTRIBUTE_SEARCH_METADATA} from '@sentry/conventions';

const TYPED_TAG_KEY_RE = /tags\[(\S*),(\S*)\]/;
const ATTRIBUTE_SEARCH_METADATA_KEY_BY_KEY = new Map<string, string | undefined>();

/**
 * Returns the canonical attribute key for an attribute key or one of its
 * deprecated aliases, or the requested key when no metadata exists. Metadata
 * lookups, including misses, are cached.
 */
export function getAttributeSearchMetadataKey(key: string): string {
  const unwrappedKey = key.match(TYPED_TAG_KEY_RE)?.[1] ?? key;
  const cachedMetadataKey = ATTRIBUTE_SEARCH_METADATA_KEY_BY_KEY.get(unwrappedKey);
  if (ATTRIBUTE_SEARCH_METADATA_KEY_BY_KEY.has(unwrappedKey)) {
    return cachedMetadataKey ?? key;
  }

  const metadata =
    ATTRIBUTE_SEARCH_METADATA[unwrappedKey] ??
    Object.values(ATTRIBUTE_SEARCH_METADATA).find(({deprecationChain}) =>
      deprecationChain.includes(unwrappedKey)
    );
  const metadataKey = metadata?.canonicalName;

  ATTRIBUTE_SEARCH_METADATA_KEY_BY_KEY.set(unwrappedKey, metadataKey);
  return metadataKey ?? key;
}
