import {ATTRIBUTE_METADATA} from '@sentry/conventions/attributes';

import {attributeSearchTypeToFieldValueType} from './attributeSearchTypeToFieldValueType';
import {FieldKind, FieldValueType, type FieldDefinition} from './types';

export function getTraceItemAttributeFieldDefinition(
  key: string
): FieldDefinition | null {
  if (!Object.hasOwn(ATTRIBUTE_METADATA, key)) {
    return null;
  }

  const metadata = ATTRIBUTE_METADATA[key as keyof typeof ATTRIBUTE_METADATA];
  const valueType = attributeSearchTypeToFieldValueType(metadata.type);

  return {
    desc: metadata.brief,
    kind: valueType === FieldValueType.ARRAY ? FieldKind.ARRAY : FieldKind.FIELD,
    valueType,
  };
}
