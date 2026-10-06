import {ATTRIBUTE_SEARCH_METADATA} from '@sentry/conventions/attributes/search';

import {prettifyTagKey} from 'sentry/utils/fields';

const internalAttributeKeys = new Set(
  Object.entries(ATTRIBUTE_SEARCH_METADATA)
    .filter(([, metadata]) => metadata.internal)
    .flatMap(([key, metadata]) => [
      key,
      metadata.canonicalName,
      ...metadata.deprecationChain,
    ])
);

/**
 * Related storage and search names can disagree about visibility. As in the
 * backend, an internal convention or prefix on any candidate takes precedence.
 */
export function getAttributeVisibility(
  ...attributeKeys: string[]
): 'public' | 'internal' {
  const candidates = new Set(attributeKeys);

  for (const key of candidates) {
    const normalizedKey = prettifyTagKey(key);
    if (normalizedKey !== key) {
      candidates.add(normalizedKey);
    }
    if (key.startsWith('dsc.') || key.startsWith('_internal.')) {
      candidates.add(`sentry.${key}`);
    }

    const lowerKey = key.toLowerCase();
    if (
      lowerKey.startsWith('__sentry_internal') ||
      lowerKey.startsWith('sentry._internal.') ||
      internalAttributeKeys.has(key)
    ) {
      return 'internal';
    }

    const searchMetadata = Object.hasOwn(ATTRIBUTE_SEARCH_METADATA, key)
      ? ATTRIBUTE_SEARCH_METADATA[key]
      : undefined;
    if (searchMetadata) {
      candidates.add(searchMetadata.canonicalName);
      for (const alias of searchMetadata.deprecationChain) {
        candidates.add(alias);
      }
    }
  }

  return 'public';
}
