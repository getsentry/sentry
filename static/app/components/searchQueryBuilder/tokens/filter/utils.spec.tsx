import type {TokenResult} from 'sentry/components/searchSyntax/parser';
import {parseSearch, TermOperator, Token} from 'sentry/components/searchSyntax/parser';
import {FieldKind, FieldValueType, type FieldDefinition} from 'sentry/utils/fields';

import {
  areWildcardOperatorsAllowed,
  escapeTagValueForSearch,
  formatFilterValue,
  getValidOpsForFilter,
  unescapeAsteriskSearchValue,
  unescapeTagValue,
} from './utils';

function parseFilterToken(query: string): TokenResult<Token.FILTER> {
  const token = parseSearch(query)?.find(
    (result): result is TokenResult<Token.FILTER> => result.type === Token.FILTER
  );

  expect(token).toBeDefined();

  return token!;
}

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

describe('getValidOpsForFilter', () => {
  it('allows wildcard operators for fields with a null valueType', () => {
    const fieldDefinition: FieldDefinition = {
      kind: FieldKind.FIELD,
      valueType: null,
    };

    expect(
      getValidOpsForFilter({
        filterToken: parseFilterToken('message:hello'),
        fieldDefinition,
      })
    ).toEqual(expect.arrayContaining([TermOperator.CONTAINS]));
  });

  it('allows wildcard operators when the field definition is missing', () => {
    expect(
      getValidOpsForFilter({
        filterToken: parseFilterToken('custom_tag_name:hello'),
        fieldDefinition: null,
      })
    ).toEqual(expect.arrayContaining([TermOperator.CONTAINS]));
  });

  it('does not allow wildcard operators when allowWildcard is false', () => {
    const fieldDefinition: FieldDefinition = {
      kind: FieldKind.FIELD,
      valueType: FieldValueType.STRING,
      allowWildcard: false,
    };

    expect(
      getValidOpsForFilter({
        filterToken: parseFilterToken('message:hello'),
        fieldDefinition,
      })
    ).not.toEqual(expect.arrayContaining([TermOperator.CONTAINS]));
  });

  it('does not allow wildcard operators when disallowWildcardOperators is true', () => {
    const fieldDefinition: FieldDefinition = {
      kind: FieldKind.FIELD,
      valueType: FieldValueType.STRING,
      disallowWildcardOperators: true,
    };

    expect(
      getValidOpsForFilter({
        filterToken: parseFilterToken('message:hello'),
        fieldDefinition,
      })
    ).not.toEqual(expect.arrayContaining([TermOperator.CONTAINS]));
  });

  it('does not allow wildcard operators for non-string effective value types', () => {
    const fieldDefinition: FieldDefinition = {
      kind: FieldKind.FIELD,
      valueType: FieldValueType.NUMBER,
    };

    expect(
      getValidOpsForFilter({
        filterToken: parseFilterToken('timesSeen:10'),
        fieldDefinition,
      })
    ).not.toEqual(expect.arrayContaining([TermOperator.CONTAINS]));
  });
});

describe('escapeTagValueForSearch', () => {
  it('escapes unescaped asterisks', () => {
    expect(escapeTagValueForSearch('foo*bar')).toBe('foo\\*bar');
  });

  it('does not double escape escaped asterisks', () => {
    expect(escapeTagValueForSearch('foo\\*bar')).toBe('foo\\*bar');
  });

  it('preserves representable backslashes before escaped asterisks', () => {
    expect(escapeTagValueForSearch('foo\\\\*bar')).toBe('foo\\\\\\*bar');
  });

  it('preserves quoting when forced', () => {
    expect(escapeTagValueForSearch('foo*bar', {forceQuote: true})).toBe('"foo\\*bar"');
  });

  it('respects allowArrayValue when disabled by the caller', () => {
    expect(escapeTagValueForSearch('[foo*bar]', {allowArrayValue: false})).toBe(
      '[foo\\*bar]'
    );
  });
});

describe('unescapeTagValue', () => {
  it('only unescapes quotes', () => {
    expect(unescapeTagValue('foo\\*bar')).toBe('foo\\*bar');
  });
});

describe('unescapeAsteriskSearchValue', () => {
  it('unescapes escaped asterisks for display', () => {
    expect(unescapeAsteriskSearchValue('foo\\*bar')).toBe('foo*bar');
  });

  it('preserves representable backslashes before escaped asterisks', () => {
    expect(unescapeAsteriskSearchValue('foo\\\\\\*bar')).toBe('foo\\\\*bar');
  });
});

describe('formatFilterValue', () => {
  it('unescapes asterisks for unquoted values', () => {
    expect(
      formatFilterValue({
        token: {
          type: Token.VALUE_TEXT,
          text: '\\*\\*\\*\\*',
          value: '\\*\\*\\*\\*',
          quoted: false,
        } as any,
      })
    ).toBe('****');
  });

  it('unescapes asterisks for quoted values', () => {
    expect(
      formatFilterValue({
        token: {
          type: Token.VALUE_TEXT,
          text: '"foo\\\\*bar"',
          value: 'foo\\*bar',
          quoted: true,
        } as any,
      })
    ).toBe('foo*bar');
  });
});
