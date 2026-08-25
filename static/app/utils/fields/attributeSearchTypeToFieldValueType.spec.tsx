import type {AttributeSearchType} from '@sentry/conventions';

import {attributeSearchTypeToFieldValueType} from './attributeSearchTypeToFieldValueType';
import {FieldValueType} from './types';

describe('attributeSearchTypeToFieldValueType', () => {
  it.each<[AttributeSearchType, FieldValueType]>([
    ['string', FieldValueType.STRING],
    ['any', FieldValueType.STRING],
    ['boolean', FieldValueType.BOOLEAN],
    ['integer', FieldValueType.INTEGER],
    ['double', FieldValueType.NUMBER],
    ['byte', FieldValueType.SIZE],
    ['currency', FieldValueType.CURRENCY],
    ['millisecond', FieldValueType.DURATION],
    ['second', FieldValueType.DURATION],
    ['percentage', FieldValueType.PERCENTAGE],
    ['string[]', FieldValueType.ARRAY],
    ['boolean[]', FieldValueType.ARRAY],
    ['integer[]', FieldValueType.ARRAY],
    ['double[]', FieldValueType.ARRAY],
  ])('maps %s onto %s', (searchType, fieldValueType) => {
    expect(attributeSearchTypeToFieldValueType(searchType)).toBe(fieldValueType);
  });
});
