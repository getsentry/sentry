// To evaluate a result of the search syntax, we flatten the AST,
// transform it to postfix notation which gets rid of parenthesis and tokens
// that do not hold any value as they cannot be evaluated and then evaluate
// the postfix notation.

import {
  BooleanOperator,
  Token,
  type TokenResult,
} from 'sentry/components/searchSyntax/parser';

export type ProcessedTokenResult =
  | TokenResult<Token>
  | {type: 'L_PAREN'}
  | {type: 'R_PAREN'};

export function toFlattened(tokens: TokenResult<Token>[]): ProcessedTokenResult[] {
  const flattened_result: ProcessedTokenResult[] = [];

  function flatten(token: TokenResult<Token>): void {
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
        return;
      case Token.LOGIC_GROUP:
        flattened_result.push({type: 'L_PAREN'});
        for (const child of token.inner) {
          // Logic groups are wrapped in parenthesis,
          // but those parenthesis are not actual tokens returned by the parser
          flatten(child);
        }
        flattened_result.push({type: 'R_PAREN'});
        break;
      case Token.LOGIC_BOOLEAN:
        flattened_result.push(token);
        break;
      default:
        flattened_result.push(token);
        break;
    }
  }

  for (let i = 0; i < tokens.length; i++) {
    flatten(tokens[i]);
  }

  return flattened_result;
}

// At this point we have a flat list of groups that we can evaluate, however since the syntax allows
// implicit ANDs, we should still insert those as it will make constructing a valid AST easier
export function insertImplicitAND(
  tokens: ProcessedTokenResult[]
): ProcessedTokenResult[] {
  const with_implicit_and: ProcessedTokenResult[] = [];

  const AND = {
    type: Token.LOGIC_BOOLEAN,
    value: BooleanOperator.AND,
    text: 'AND',
    location: null as unknown as PEG.LocationRange,
    invalid: null,
  } as TokenResult<Token>;

  for (let i = 0; i < tokens.length; i++) {
    const next = tokens[i + 1];
    with_implicit_and.push(tokens[i]);

    // If current is not a logic boolean and next is not a logic boolean, insert an implicit AND.
    if (
      next &&
      next.type !== Token.LOGIC_BOOLEAN &&
      tokens[i].type !== Token.LOGIC_BOOLEAN &&
      tokens[i].type !== 'L_PAREN' &&
      next.type !== 'R_PAREN'
    ) {
      with_implicit_and.push(AND);
    }
  }

  return with_implicit_and;
}
