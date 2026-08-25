import {ATTRIBUTE_SEARCH_METADATA, type AttributeSearchType} from '@sentry/conventions';

import {td} from 'sentry/locale';

import {attributeSearchTypeToFieldValueType} from './attributeSearchTypeToFieldValueType';
import {FieldKind, type FieldDefinition} from './types';

export const ARRAY_ATTRIBUTE_SEARCH_TYPES = new Set<AttributeSearchType>([
  'string[]',
  'boolean[]',
  'integer[]',
  'double[]',
]);

export function getFieldDefinitionFromAttributeSearchMetadata(
  key: string
): FieldDefinition | null {
  const metadata = ATTRIBUTE_SEARCH_METADATA[key];
  if (!metadata) {
    return null;
  }

  return {
    kind: ARRAY_ATTRIBUTE_SEARCH_TYPES.has(metadata.type)
      ? FieldKind.ARRAY
      : FieldKind.FIELD,
    desc: td(ATTRIBUTE_SEARCH_METADATA[key]!.brief),
    valueType: attributeSearchTypeToFieldValueType(metadata.type),
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
