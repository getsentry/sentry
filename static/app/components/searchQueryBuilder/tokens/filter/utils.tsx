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
