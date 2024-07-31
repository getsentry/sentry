import {
  allOperators,
  filterTypeConfig,
  interchangeableFilterOperators,
  type TermOperator,
  Token,
  type TokenResult,
} from 'sentry/components/searchSyntax/parser';
import {t} from 'sentry/locale';
import {escapeDoubleQuotes} from 'sentry/utils';
import {getFieldDefinition} from 'sentry/utils/fields';

const SHOULD_ESCAPE_REGEX = /[\s"()]/;

export function getValidOpsForFilter(
  filterToken: TokenResult<Token.FILTER>
): readonly TermOperator[] {
  const fieldDefinition = getFieldDefinition(filterToken.key.text);

  if (fieldDefinition?.allowComparisonOperators) {
    return allOperators;
  }

  // If the token is invalid we want to use the possible expected types as our filter type
  const validTypes = filterToken.invalid?.expectedType ?? [filterToken.filter];

  // Determine any interchangeable filter types for our valid types
  const interchangeableTypes = validTypes.map(
    type => interchangeableFilterOperators[type] ?? []
  );

  // Combine all types
  const allValidTypes = [...new Set([...validTypes, ...interchangeableTypes.flat()])];

  // Find all valid operations
  const validOps = new Set<TermOperator>(
    allValidTypes.flatMap(type => filterTypeConfig[type].validOps)
  );

  return [...validOps];
}

export function escapeTagValue(value: string): string {
  if (!value) {
    return '';
  }

  // Wrap in quotes if there is a space or parens
  return SHOULD_ESCAPE_REGEX.test(value) ? `"${escapeDoubleQuotes(value)}"` : value;
}

export function unescapeTagValue(value: string): string {
  return value.replace(/\\"/g, '"');
}

export function formatFilterValue(token: TokenResult<Token.FILTER>['value']): string {
  switch (token.type) {
    case Token.VALUE_TEXT: {
      if (!token.value) {
        return token.text;
      }

      return token.quoted ? unescapeTagValue(token.value) : token.text;
    }
    case Token.VALUE_RELATIVE_DATE:
      return t('%s', `${token.value}${token.unit} ago`);
    default:
      return token.text;
  }
}

/**
 * Replaces the focused parameter (at cursorPosition) with the new value.
 * If cursorPosition is null, will default to the end of the string.
 *
 * Example:
 * replaceCommaSeparatedValue('foo,bar,baz', 5, 'new') => 'foo,new,baz'
 */
export function replaceCommaSeparatedValue(
  value: string,
  cursorPosition: number | null,
  replacement: string
) {
  const items = value.split(',');

  let characterCount = 0;
  for (let i = 0; i < items.length; i++) {
    characterCount += items[i].length + 1;
    if (characterCount > (cursorPosition ?? value.length + 1)) {
      const newItems = [...items.slice(0, i), replacement, ...items.slice(i + 1)];
      return newItems.map(item => item.trim()).join(',');
    }
  }

  return value;
}
