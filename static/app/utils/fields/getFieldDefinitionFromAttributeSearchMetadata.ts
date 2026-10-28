import {
  ATTRIBUTE_SEARCH_METADATA,
  type AttributeSearchMetadata,
} from '@sentry/conventions/attributes/search';

import {td} from 'sentry/locale';

import {attributeSearchTypeToFieldValueType} from './attributeSearchTypeToFieldValueType';
import {getAttributeSearchMetadata} from './getAttributeSearchMetadata';
import {
  getAttributeSearchDeprecationAliases,
  getPreferredAttributeSearchKey,
} from './getAttributeSearchSecondaryAliases';
import {FieldKind, FieldValueType, type FieldDefinition} from './types';

function getFieldDefinitionFromAttributeSearchMetadata(
  key: string,
  metadata: AttributeSearchMetadata
): FieldDefinition {
  const keywords = getAttributeSearchDeprecationAliases(key);
  const preferredKey = getPreferredAttributeSearchKey(key);
  const valueType = attributeSearchTypeToFieldValueType(metadata.type);

  return {
    kind: valueType === FieldValueType.ARRAY ? FieldKind.ARRAY : FieldKind.FIELD,
    desc: td(ATTRIBUTE_SEARCH_METADATA[key]!.brief),
    valueType,
    ...(keywords.length ? {keywords} : {}),
    ...(preferredKey && preferredKey !== key ? {deprecated: true} : {}),
  };
}

const definitions = new Map<string, FieldDefinition>();

/**
 * Field definition sourced from `@sentry/conventions` for an attribute search key,
 * or `undefined` when the key is not a convention attribute. Use this instead of
 * hand-writing desc/valueType for attributes that already live in the package.
 *
 * Definitions are built on first lookup and reused, rather than all at import.
 */
export function getAttributeSearchFieldDefinition(
  key: string
): FieldDefinition | undefined {
  const cached = definitions.get(key);
  if (cached) {
    return cached;
  }
  const metadata = getAttributeSearchMetadata(key);
  if (!metadata) {
    return undefined;
  }
  const definition = getFieldDefinitionFromAttributeSearchMetadata(key, metadata);
  definitions.set(key, definition);
  return definition;
}
