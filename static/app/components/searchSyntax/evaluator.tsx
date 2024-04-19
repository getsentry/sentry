// To evaluate a result of the search syntax, we flatten the AST,
// transform it to postfix notation which gets rid of parenthesis and tokens
// that do not hold any value as they cannot be evaluated and then evaluate
// the postfix notation.

import {
  type ParseResult,
  Token,
  type TokenResult,
} from 'sentry/components/searchSyntax/parser';
import {treeTransformer} from 'sentry/components/searchSyntax/utils';

// This uses the treeTransformer utility to flatten the AST tree into a flat array of tokens
// that can be evaluated. Since we use the treeTransformer utility, it means we need to return
// the token in the transform function to keep the token we are iterating on.
export function flattenTokenTree(tokens: ParseResult): TokenResult<Token>[] {
  const result: TokenResult<Token>[] = [];

  function visitor(token: TokenResult<Token> | null): TokenResult<Token> | null {
    if (token === null) {
      return null;
    }

    switch (token.type) {
      case Token.SPACES:
      case Token.VALUE_BOOLEAN:
      case Token.VALUE_DURATION:
      case Token.VALUE_ISO_8601_DATE:
      case Token.VALUE_SIZE:
      case Token.VALUE_NUMBER_LIST:
      case Token.VALUE_NUMBER:
      case Token.VALUE_TEXT:
      case Token.VALUE_TEXT_LIST:
      case Token.VALUE_RELATIVE_DATE:
      case Token.VALUE_PERCENTAGE:
      case Token.KEY_SIMPLE:
        return token;
      default:
        break;
    }

    result.push(token);
    return token;
  }
  treeTransformer({tree: tokens, transform: visitor});
  return result;
}
