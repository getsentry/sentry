import {ATTRIBUTE_SEARCH_METADATA} from '@sentry/conventions';

import {td} from 'sentry/locale';

import {attributeSearchTypeToFieldValueType} from './attributeSearchTypeToFieldValueType';
import {
  getAttributeSearchDeprecationAliases,
  getPreferredAttributeSearchKey,
} from './getAttributeSearchSecondaryAliases';
import {FieldKind, FieldValueType, type FieldDefinition} from './types';

export function getFieldDefinitionFromAttributeSearchMetadata(
  key: string
): FieldDefinition | null {
  const metadata = ATTRIBUTE_SEARCH_METADATA[key];
  if (!metadata) {
    return null;
  }

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

/**
 * Field definitions sourced from `@sentry/conventions`. Iterate this instead of
 * hand-writing desc/valueType for attributes that already live in the package.
 */
export const ATTRIBUTE_SEARCH_FIELD_DEFINITIONS: Record<string, FieldDefinition> =
  Object.fromEntries(
    Object.keys(ATTRIBUTE_SEARCH_METADATA).map(key => [
      key,
      getFieldDefinitionFromAttributeSearchMetadata(key)!,
    ])
  );
