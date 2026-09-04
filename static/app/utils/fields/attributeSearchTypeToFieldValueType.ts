import type {AttributeSearchType} from '@sentry/conventions';

import {FieldValueType} from './types';

/**
 * Map sentry-conventions search types onto FieldValueType.
 * Convention types like `double` don't exist in search, so they collapse to `number`.
 */
export function attributeSearchTypeToFieldValueType(
  type: AttributeSearchType
): FieldValueType {
  switch (type) {
    case 'string':
    case 'any':
      return FieldValueType.STRING;
    case 'boolean':
      return FieldValueType.BOOLEAN;
    case 'integer':
      return FieldValueType.INTEGER;
    case 'double':
      return FieldValueType.NUMBER;
    case 'string[]':
    case 'boolean[]':
    case 'integer[]':
    case 'double[]':
      return FieldValueType.ARRAY;
    case 'byte':
      return FieldValueType.SIZE;
    case 'currency':
      return FieldValueType.CURRENCY;
    case 'millisecond':
    case 'second':
      return FieldValueType.DURATION;
    case 'percentage':
      return FieldValueType.PERCENTAGE;
    default: {
      const exhaustive: never = type;
      return exhaustive;
    }
  }
}
