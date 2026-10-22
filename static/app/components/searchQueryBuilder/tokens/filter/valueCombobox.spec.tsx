import {parseQueryBuilderValue} from 'sentry/components/searchQueryBuilder/utils';
import {Token} from 'sentry/components/searchSyntax/parser';
import {FieldKind, FieldValueType, type FieldDefinition} from 'sentry/utils/fields';

import {
  getSelectedValuesFromText,
  prepareInputValueForSaving,
  tokenSupportsMultipleValues,
} from './valueCombobox';

describe('prepareInputValueForSaving', () => {
  it('preserves manual asterisks in unquoted string values', () => {
    expect(prepareInputValueForSaving(FieldValueType.STRING, 'foo*bar')).toBe('foo*bar');
  });

  it('preserves manual asterisks in quoted string values', () => {
    expect(prepareInputValueForSaving(FieldValueType.STRING, '"foo*bar"')).toBe(
      '"foo*bar"'
    );
  });

  it('preserves manual asterisks in multi-select string values', () => {
    expect(prepareInputValueForSaving(FieldValueType.STRING, 'foo*bar,baz*qux')).toBe(
      '[foo*bar,baz*qux]'
    );
  });

  it('preserves already-escaped dropdown values', () => {
    expect(prepareInputValueForSaving(FieldValueType.STRING, 'foo\\*bar,baz\\*qux')).toBe(
      '[foo\\*bar,baz\\*qux]'
    );
  });

  it('preserves already-escaped quoted dropdown values', () => {
    expect(prepareInputValueForSaving(FieldValueType.STRING, '"foo\\*bar"')).toBe(
      '"foo\\*bar"'
    );
  });
});

describe('getSelectedValuesFromText', () => {
  it('returns both the unescaped value and the stored text for each item', () => {
    expect(getSelectedValuesFromText('\\*\\*\\*\\*,')).toEqual([
      {value: '****', text: '\\*\\*\\*\\*', selected: true},
    ]);
  });

  it('round-trips representable backslashes before literal asterisks', () => {
    expect(getSelectedValuesFromText('foo\\\\\\*bar,')).toEqual([
      {value: 'foo\\\\*bar', text: 'foo\\\\\\*bar', selected: true},
    ]);
  });

  it('preserves manual wildcards as stored text while exposing the unescaped form', () => {
    expect(getSelectedValuesFromText('foo*,bar\\*,')).toEqual([
      {value: 'foo*', text: 'foo*', selected: true},
      {value: 'bar*', text: 'bar\\*', selected: true},
    ]);
  });
});

describe('tokenSupportsMultipleValues', () => {
  const filterKeys = {
    'release.version': {
      key: 'release.version',
      name: 'release.version',
      kind: FieldKind.FIELD,
    },
  };

  function getReleaseVersionFieldDefinition(
    overrides: Partial<FieldDefinition> = {}
  ): FieldDefinition {
    return {
      kind: FieldKind.FIELD,
      valueType: FieldValueType.STRING,
      allowComparisonOperators: true,
      ...overrides,
    };
  }

  function getFilterToken(
    query: string,
    fieldDefinition = getReleaseVersionFieldDefinition()
  ) {
    const parsed = parseQueryBuilderValue(
      query,
      key => (key === 'release.version' ? fieldDefinition : null),
      {filterKeys}
    );
    const token = parsed?.find(t => t.type === Token.FILTER);

    if (!token) {
      throw new Error(`No filter token found in query: ${query}`);
    }

    return token;
  }

  it('allows multiple values for string filters by default', () => {
    const fieldDefinition = getReleaseVersionFieldDefinition();

    expect(
      tokenSupportsMultipleValues(
        getFilterToken('release.version:1.0.0', fieldDefinition),
        filterKeys,
        fieldDefinition
      )
    ).toBe(true);
  });

  it('does not allow multiple values when the field definition opts out', () => {
    const fieldDefinition = getReleaseVersionFieldDefinition({
      allowMultipleValues: false,
    });

    expect(
      tokenSupportsMultipleValues(
        getFilterToken('release.version:1.0.0', fieldDefinition),
        filterKeys,
        fieldDefinition
      )
    ).toBe(false);
  });

  it('does not allow multiple values for wildcard operators when the field definition opts out', () => {
    const fieldDefinition = getReleaseVersionFieldDefinition({
      allowMultipleValues: false,
    });

    expect(
      tokenSupportsMultipleValues(
        getFilterToken('release.version:*1.0.0*', fieldDefinition),
        filterKeys,
        fieldDefinition
      )
    ).toBe(false);
  });

  it('does not allow multiple values for comparison operators when the field definition opts out', () => {
    const fieldDefinition = getReleaseVersionFieldDefinition({
      allowMultipleValues: false,
    });

    expect(
      tokenSupportsMultipleValues(
        getFilterToken('release.version:>1.0.0', fieldDefinition),
        filterKeys,
        fieldDefinition
      )
    ).toBe(false);
  });

  it('allows multiple values for comparison operators when the field definition allows them', () => {
    const fieldDefinition: FieldDefinition = {
      kind: FieldKind.FIELD,
      valueType: FieldValueType.STRING,
      allowComparisonOperators: true,
    };

    expect(
      tokenSupportsMultipleValues(
        getFilterToken('release.version:>1.0.0', fieldDefinition),
        filterKeys,
        fieldDefinition
      )
    ).toBe(true);
  });
});
