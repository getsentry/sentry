import {FieldKind, FieldValueType, type FieldDefinition} from 'sentry/utils/fields';

import {areWildcardOperatorsAllowed} from './utils';

describe('areWildcardOperatorsAllowed', () => {
  it('returns false when fieldDefinition is null', () => {
    expect(areWildcardOperatorsAllowed(null)).toBe(false);
  });

  it('returns false when allowWildcard is explicitly false', () => {
    const fieldDefinition: FieldDefinition = {
      kind: FieldKind.FIELD,
      valueType: FieldValueType.STRING,
      allowWildcard: false,
    };

    expect(areWildcardOperatorsAllowed(fieldDefinition)).toBe(false);
  });

  it('returns true when allowWildcard is true, even if disallowWildcardOperators is true', () => {
    const fieldDefinition: FieldDefinition = {
      kind: FieldKind.FIELD,
      valueType: FieldValueType.STRING,
      allowWildcard: true,
      disallowWildcardOperators: true,
    };

    expect(areWildcardOperatorsAllowed(fieldDefinition)).toBe(false);
  });

  it('returns false when allowWildcard is undefined and disallowWildcardOperators is true', () => {
    const fieldDefinition: FieldDefinition = {
      kind: FieldKind.FIELD,
      valueType: FieldValueType.STRING,
      disallowWildcardOperators: true,
    };

    expect(areWildcardOperatorsAllowed(fieldDefinition)).toBe(false);
  });

  it('returns true when allowWildcard is undefined and disallowWildcardOperators is false', () => {
    const fieldDefinition: FieldDefinition = {
      kind: FieldKind.FIELD,
      valueType: FieldValueType.STRING,
      disallowWildcardOperators: false,
    };

    expect(areWildcardOperatorsAllowed(fieldDefinition)).toBe(true);
  });

  it('returns true when allowWildcard is undefined and disallowWildcardOperators is undefined', () => {
    const fieldDefinition: FieldDefinition = {
      kind: FieldKind.FIELD,
      valueType: FieldValueType.STRING,
    };

    expect(areWildcardOperatorsAllowed(fieldDefinition)).toBe(true);
  });

  it('returns false when valueType is not string', () => {
    const fieldDefinition: FieldDefinition = {
      kind: FieldKind.FIELD,
      valueType: FieldValueType.DATE,
    };

    expect(areWildcardOperatorsAllowed(fieldDefinition)).toBe(false);
  });
});
