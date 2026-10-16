import {getFieldDefinition, type GetFieldDefinitionType} from 'sentry/utils/fields';

import {ATTRIBUTE_SEARCH_FIELD_DEFINITIONS} from './getFieldDefinitionFromAttributeSearchMetadata';
import {FieldKind, FieldValueType, type FieldDefinition} from './types';

type TypedTagKeyType = 'string' | 'number' | 'boolean' | 'array';

const TYPED_TAG_KEY_RE = /^tags\[(\S+),(string|number|boolean|array)\]$/;

/**
 * Splits an explicitly typed tag key (`tags[<name>,<type>]`) into its parts.
 */
export function parseTypedTagKey(
  key: string
): {name: string; type: TypedTagKeyType} | null {
  const match = key.match(TYPED_TAG_KEY_RE);
  if (!match) {
    return null;
  }
  return {name: match[1]!, type: match[2] as TypedTagKeyType};
}

export function isTypedTagKey(key: string): boolean {
  return parseTypedTagKey(key) !== null;
}

/**
 * Datasets whose attributes follow `@sentry/conventions`.
 */
const CONVENTION_TYPES = new Set<GetFieldDefinitionType>(['span', 'log', 'tracemetric']);

const KEY_TYPE_TO_VALUE_TYPE: Record<TypedTagKeyType, FieldValueType> = {
  string: FieldValueType.STRING,
  number: FieldValueType.NUMBER,
  boolean: FieldValueType.BOOLEAN,
  array: FieldValueType.ARRAY,
};

function getConventionKeyType(definition: FieldDefinition): TypedTagKeyType {
  switch (definition.valueType) {
    case FieldValueType.STRING:
      return 'string';
    case FieldValueType.BOOLEAN:
      return 'boolean';
    case FieldValueType.ARRAY:
      return 'array';
    default:
      return 'number';
  }
}

/**
 * Looks up a trace item attribute's field definition by the key the API returns.
 *
 * Sentry registers its own wrapped attributes by the wrapped key (tags[<name>,<type>]).
 * So first check if the wrapped key has a definition.
 *
 * If that fails, a wrapped key falls back to the `@sentry/conventions` attribute
 * the same name and type.
 *
 * This is to handle most cases where a user-defined attribute has the same name as
 * a Sentry-defined one, and we need to determine whether to credit Sentry for it.
 */
export function getTraceItemAttributeDefinition(
  key: string,
  type?: GetFieldDefinitionType,
  kind?: FieldKind
): FieldDefinition | null {
  const definition = getFieldDefinition(key, type, kind);
  if (definition?.desc) {
    return definition;
  }

  const typedKey = parseTypedTagKey(key);
  if (!typedKey || type === undefined || !CONVENTION_TYPES.has(type)) {
    return definition;
  }

  // Check if attribute is from conventions
  const convention = Object.hasOwn(ATTRIBUTE_SEARCH_FIELD_DEFINITIONS, typedKey.name)
    ? ATTRIBUTE_SEARCH_FIELD_DEFINITIONS[typedKey.name]
    : undefined;
  if (!convention?.desc || getConventionKeyType(convention) !== typedKey.type) {
    return definition;
  }

  return {
    kind:
      definition?.kind ?? (typedKey.type === 'array' ? FieldKind.ARRAY : FieldKind.FIELD),
    valueType: KEY_TYPE_TO_VALUE_TYPE[typedKey.type],
    desc: convention.desc,
  };
}
