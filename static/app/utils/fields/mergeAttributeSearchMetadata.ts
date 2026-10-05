import {ATTRIBUTE_SEARCH_FIELD_DEFINITIONS} from './getFieldDefinitionFromAttributeSearchMetadata';
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

const mergedDefinitions = new WeakMap<FieldDefinition, Map<string, FieldDefinition>>();

export function mergeAttributeSearchMetadata(
  key: string,
  definition: FieldDefinition,
  {keepLocalDescription = false}: {keepLocalDescription?: boolean} = {}
): FieldDefinition {
  const fromSearch = ATTRIBUTE_SEARCH_FIELD_DEFINITIONS[key];
  if (!Object.hasOwn(ATTRIBUTE_SEARCH_FIELD_DEFINITIONS, key) || !fromSearch) {
    return definition;
  }

  const cacheKey = `${keepLocalDescription}:${key}`;
  let cache = mergedDefinitions.get(definition);
  const cached = cache?.get(cacheKey);
  if (cached) {
    return cached;
  }

  const valueTypeFromSearch = fromSearch.valueType;
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

  const keywords = [
    ...new Set([...(fromSearch.keywords ?? []), ...(definition.keywords ?? [])]),
  ];

  const merged = {
    ...fromSearch,
    ...definition,
    desc: keepLocalDescription ? (definition.desc ?? fromSearch.desc) : fromSearch.desc,
    valueType: keepLocalValueType ? definition.valueType : fromSearch.valueType,
    ...(fromSearch.kind === FieldKind.ARRAY ? {kind: FieldKind.ARRAY} : {}),
    ...(keywords.length ? {keywords} : {}),
  };

  if (!cache) {
    cache = new Map();
    mergedDefinitions.set(definition, cache);
  }
  cache.set(cacheKey, merged);
  return merged;
}
