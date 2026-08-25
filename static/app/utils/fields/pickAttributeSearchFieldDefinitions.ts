import {ATTRIBUTE_SEARCH_FIELD_DEFINITIONS} from './getFieldDefinitionFromAttributeSearchMetadata';
import type {FieldDefinition} from './types';

export function pickAttributeSearchFieldDefinitions(
  keys: Iterable<string>
): Record<string, FieldDefinition> {
  const definitions: Record<string, FieldDefinition> = {};
  for (const key of keys) {
    const definition = ATTRIBUTE_SEARCH_FIELD_DEFINITIONS[key];
    if (definition) {
      definitions[key] = definition;
    }
  }
  return definitions;
}
