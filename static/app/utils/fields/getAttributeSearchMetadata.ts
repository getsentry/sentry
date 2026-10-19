import {
  ATTRIBUTE_SEARCH_METADATA,
  type AttributeSearchMetadata,
} from '@sentry/conventions/attributes/search';

export function getAttributeSearchMetadata(
  key: string
): AttributeSearchMetadata | undefined {
  return Object.hasOwn(ATTRIBUTE_SEARCH_METADATA, key)
    ? ATTRIBUTE_SEARCH_METADATA[key]
    : undefined;
}
