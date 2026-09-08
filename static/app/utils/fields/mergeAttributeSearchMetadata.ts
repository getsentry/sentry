import {ATTRIBUTE_SEARCH_METADATA} from '@sentry/conventions';

import {attributeSearchTypeToFieldValueType} from './attributeSearchTypeToFieldValueType';
import {getFieldDefinitionFromAttributeSearchMetadata} from './getFieldDefinitionFromAttributeSearchMetadata';
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
  definition: FieldDefinition,
  {keepLocalDescription = false}: {keepLocalDescription?: boolean} = {}
): FieldDefinition {
  const metadata = ATTRIBUTE_SEARCH_METADATA[key];
  if (!Object.hasOwn(ATTRIBUTE_SEARCH_METADATA, key) || !metadata) {
    return definition;
  }

  const valueTypeFromSearch = attributeSearchTypeToFieldValueType(metadata.type);
  // DATE has no AttributeSearchType variant, so overlapping local date fields
  // (e.g. timestamp) would otherwise be replaced by string/number and break
  // date filter UI. Unit types are kept only when conventions collapse to
  // double/integer.
  const keepLocalValueType =
    definition.valueType === FieldValueType.DATE ||
    (definition.valueType !== null &&
      UNIT_FIELD_VALUE_TYPES.has(definition.valueType) &&
      (valueTypeFromSearch === FieldValueType.NUMBER ||
        valueTypeFromSearch === FieldValueType.INTEGER));

  const fromSearch = getFieldDefinitionFromAttributeSearchMetadata(key)!;
  const keywords = [
    ...new Set([...(fromSearch.keywords ?? []), ...(definition.keywords ?? [])]),
  ];

  return {
    ...fromSearch,
    ...definition,
    desc: keepLocalDescription ? (definition.desc ?? fromSearch.desc) : fromSearch.desc,
    valueType: keepLocalValueType ? definition.valueType : fromSearch.valueType,
    ...(fromSearch.kind === FieldKind.ARRAY ? {kind: FieldKind.ARRAY} : {}),
    ...(keywords.length ? {keywords} : {}),
  };
}
