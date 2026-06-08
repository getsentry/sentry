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
});
