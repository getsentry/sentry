import {WildcardOperators} from 'sentry/components/searchSyntax/parser';
import {FieldKind, FieldValueType, type FieldDefinition} from 'sentry/utils/fields';

import {getInitialFilterText} from './utils';

describe('getInitialFilterText', () => {
  it('defaults missing field definitions to contains', () => {
    expect(getInitialFilterText('custom_tag_name', null)).toBe(
      `custom_tag_name:${WildcardOperators.CONTAINS}""`
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

  it('emits explicit number tag syntax for undocumented measurement attributes', () => {
    const fieldDefinition: FieldDefinition = {
      kind: FieldKind.FIELD,
      valueType: FieldValueType.NUMBER,
    };

    expect(
      getInitialFilterText(
        'my.custom.number.attribute',
        fieldDefinition,
        FieldKind.MEASUREMENT
      )
    ).toBe('tags[my.custom.number.attribute,number]:>100');
  });

  it('emits explicit boolean tag syntax for undocumented boolean attributes', () => {
    const fieldDefinition: FieldDefinition = {
      kind: FieldKind.FIELD,
      valueType: FieldValueType.BOOLEAN,
    };

    expect(
      getInitialFilterText('my.custom.flag', fieldDefinition, FieldKind.BOOLEAN)
    ).toBe('tags[my.custom.flag,boolean]:true');
  });

  it('does not double-wrap keys already in explicit tag syntax', () => {
    const fieldDefinition: FieldDefinition = {
      kind: FieldKind.FIELD,
      valueType: FieldValueType.NUMBER,
    };

    expect(
      getInitialFilterText(
        'tags[my.custom.number.attribute,number]',
        fieldDefinition,
        FieldKind.MEASUREMENT
      )
    ).toBe('tags[my.custom.number.attribute,number]:>100');
  });

  it('does not wrap documented numeric fields', () => {
    // Documented fields carry a description; these should keep their plain key.
    const fieldDefinition: FieldDefinition = {
      desc: 'The duration of the span',
      kind: FieldKind.FIELD,
      valueType: FieldValueType.DURATION,
    };

    expect(
      getInitialFilterText('span.duration', fieldDefinition, FieldKind.MEASUREMENT)
    ).toBe('span.duration:>10ms');
  });
});
