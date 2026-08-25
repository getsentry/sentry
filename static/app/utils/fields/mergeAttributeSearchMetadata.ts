import {ATTRIBUTE_SEARCH_METADATA} from '@sentry/conventions';

import {attributeSearchTypeToFieldValueType} from './attributeSearchTypeToFieldValueType';
import {
  ARRAY_ATTRIBUTE_SEARCH_TYPES,
  getFieldDefinitionFromAttributeSearchMetadata,
} from './getFieldDefinitionFromAttributeSearchMetadata';
import {FieldKind, FieldValueType, type FieldDefinition} from './types';

const UNIT_FIELD_VALUE_TYPES = new Set<FieldValueType>([
  FieldValueType.CURRENCY,
  FieldValueType.DURATION,
  FieldValueType.PERCENTAGE,
  FieldValueType.RATE,
  FieldValueType.SCORE,
  FieldValueType.SIZE,
  FieldValueType.PERCENT_CHANGE,
]);

export function mergeAttributeSearchMetadata(
  key: string,
  definition: FieldDefinition
): FieldDefinition {
  const metadata = ATTRIBUTE_SEARCH_METADATA[key];
  if (!metadata) {
    return definition;
  }

  const valueTypeFromSearch = attributeSearchTypeToFieldValueType(metadata.type);
  const keepLocalValueType =
    definition.valueType !== null &&
    UNIT_FIELD_VALUE_TYPES.has(definition.valueType) &&
    (valueTypeFromSearch === FieldValueType.NUMBER ||
      valueTypeFromSearch === FieldValueType.INTEGER);

  const fromSearch = getFieldDefinitionFromAttributeSearchMetadata(key)!;

  return {
    ...fromSearch,
    ...definition,
    desc: fromSearch.desc,
    valueType: keepLocalValueType ? definition.valueType : fromSearch.valueType,
    ...(ARRAY_ATTRIBUTE_SEARCH_TYPES.has(metadata.type) ? {kind: FieldKind.ARRAY} : {}),
  };
}
