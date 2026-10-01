import {
  ATTRIBUTE_SEARCH_METADATA,
  type AttributeSearchMetadata,
} from '@sentry/conventions/attributes/search';

import {td} from 'sentry/locale';

import {attributeSearchTypeToFieldValueType} from './attributeSearchTypeToFieldValueType';
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
    desc: td(metadata.brief),
    valueType,
    ...(keywords.length ? {keywords} : {}),
    ...(preferredKey && preferredKey !== key ? {deprecated: true} : {}),
  };
}

/**
 * Field definitions sourced from `@sentry/conventions`. Iterate this instead of
 * hand-writing desc/valueType for attributes that already live in the package.
 */
export const ATTRIBUTE_SEARCH_FIELD_DEFINITIONS: Record<string, FieldDefinition> =
  Object.fromEntries(
    Object.entries(ATTRIBUTE_SEARCH_METADATA).map(([key, metadata]) => [
      key,
      getFieldDefinitionFromAttributeSearchMetadata(key, metadata),
    ])
  );
