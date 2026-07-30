import {WildcardOperators} from 'sentry/components/searchSyntax/parser';
import {FieldKind, FieldValueType, type FieldDefinition} from 'sentry/utils/fields';

import {formatFilterKeyForSearch, getInitialFilterText} from './utils';

describe('formatFilterKeyForSearch', () => {
  it.each([
    [FieldValueType.STRING, 'string'],
    [FieldValueType.NUMBER, 'number'],
    [FieldValueType.BOOLEAN, 'boolean'],
  ])(
    'uses explicit %s tag syntax for typed keys containing colons',
    (valueType, type) => {
      expect(
        formatFilterKeyForSearch('imaginary.attribute:made_up_key', {
          kind: FieldKind.FIELD,
          valueType,
        })
      ).toBe(`tags[imaginary.attribute:made_up_key,${type}]`);
    }
  );

  it('quotes colon-containing keys when their type is unknown', () => {
    expect(formatFilterKeyForSearch('imaginary.attribute:made_up_key', null)).toBe(
      '"imaginary.attribute:made_up_key"'
    );
  });

  it('preserves existing explicit tag keys', () => {
    expect(
      formatFilterKeyForSearch('tags[imaginary.attribute:made_up_key,string]', {
        kind: FieldKind.FIELD,
        valueType: FieldValueType.STRING,
      })
    ).toBe('tags[imaginary.attribute:made_up_key,string]');
  });
});

describe('getInitialFilterText', () => {
  it('defaults missing field definitions to contains', () => {
    expect(getInitialFilterText('custom_tag_name', null)).toBe(
      `custom_tag_name:${WildcardOperators.CONTAINS}""`
    );
  });

  it('uses explicit tag syntax for typed filter keys containing colons', () => {
    expect(
      getInitialFilterText('imaginary.attribute:made_up_key', {
        kind: FieldKind.FIELD,
        valueType: FieldValueType.STRING,
      })
    ).toBe(
      `tags[imaginary.attribute:made_up_key,string]:${WildcardOperators.CONTAINS}""`
    );
  });

  it('defaults null value types to contains', () => {
    const fieldDefinition: FieldDefinition = {
      kind: FieldKind.FIELD,
      valueType: null,
    };

    expect(getInitialFilterText('message', fieldDefinition)).toBe(
      `message:${WildcardOperators.CONTAINS}""`
    );
  });

  it('does not default to contains when wildcard operators are disallowed', () => {
    const fieldDefinition: FieldDefinition = {
      kind: FieldKind.FIELD,
      valueType: FieldValueType.STRING,
      disallowWildcardOperators: true,
    };

    expect(getInitialFilterText('message', fieldDefinition)).toBe('message:""');
  });
});
