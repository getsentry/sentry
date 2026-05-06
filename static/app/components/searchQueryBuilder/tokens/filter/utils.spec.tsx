import {Token} from 'sentry/components/searchSyntax/parser';
import {FieldKind, FieldValueType, type FieldDefinition} from 'sentry/utils/fields';

import {
  areWildcardOperatorsAllowed,
  escapeTagValueForSearch,
  formatFilterValue,
  unescapeAsteriskSearchValue,
  unescapeTagValue,
} from './utils';

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
