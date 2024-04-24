import type {QueryBuilderFocusState} from 'sentry/components/searchQueryBuilder/types';
import {
  filterTypeConfig,
  interchangeableFilterOperators,
  type TermOperator,
  Token,
  type TokenResult,
} from 'sentry/components/searchSyntax/parser';
import {escapeDoubleQuotes} from 'sentry/utils';

export function getValidOpsForFilter(
  filterToken: TokenResult<Token.FILTER>
): readonly TermOperator[] {
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

export function focusIsWithinToken(
  focus: QueryBuilderFocusState | null,
  token: TokenResult<Token>
) {
  if (!focus) {
    return false;
  }

  return (
    focus.range.start >= token.location.start.offset &&
    focus.range.end <= token.location.end.offset
  );
}

export function escapeTagValue(value: string): string {
  // Wrap in quotes if there is a space
  return value.includes(' ') || value.includes('"')
    ? `"${escapeDoubleQuotes(value)}"`
    : value;
}

export function unescapeTagValue(value: string): string {
  return value.replace(/\\"/g, '"');
}

export function formatFilterValue(token: TokenResult<Token.FILTER>): string {
  switch (token.value.type) {
    case Token.VALUE_TEXT:
      return unescapeTagValue(token.value.value);
    default:
      return token.value.text;
  }
}
