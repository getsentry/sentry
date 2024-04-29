import {
  filterTypeConfig,
  interchangeableFilterOperators,
  type ParseResult,
  type ParseResultToken,
  type TermOperator,
  Token,
  type TokenResult,
} from 'sentry/components/searchSyntax/parser';
import {escapeDoubleQuotes} from 'sentry/utils';

export function makeTokenKey(token: TokenResult<Token>) {
  return `${token.type}:${token.location.start.offset}`;
}

const isSimpleTextToken = (
  token: ParseResultToken
): token is TokenResult<Token.FREE_TEXT> | TokenResult<Token.SPACES> => {
  return [Token.FREE_TEXT, Token.SPACES].includes(token.type);
};

/**
 * Collapse adjacent FREE_TEXT and SPACES tokens into a single token.
 * This is useful for rendering the minimum number of inputs in the UI.
 */
export function collapseTextTokens(tokens: ParseResult | null) {
  if (!tokens) {
    return null;
  }

  return tokens.reduce<ParseResult>((acc, token) => {
    if (acc.length === 0) {
      return [token];
    }

    const lastToken = acc[acc.length - 1];

    if (isSimpleTextToken(token) && isSimpleTextToken(lastToken)) {
      lastToken.value += token.value;
      lastToken.text += token.value;
      lastToken.location.end = token.location.end;
      lastToken.type = Token.FREE_TEXT;
      return acc;
    }

    return [...acc, token];
  }, []);
}

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
