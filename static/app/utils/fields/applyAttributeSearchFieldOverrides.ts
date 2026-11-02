import type {FieldDefinition} from './types';

export function applyAttributeSearchFieldOverrides(
  definitions: Record<string, FieldDefinition>,
  overrides: Record<string, Partial<FieldDefinition>>
): Record<string, FieldDefinition> {
  const result = {...definitions};
  for (const [key, override] of Object.entries(overrides)) {
    const base = result[key];
    if (!base) {
      continue;
    }
    result[key] = {...base, ...override};
  }
  return result;
}
