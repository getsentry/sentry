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
    flatten(tokens[i]!);
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
    with_implicit_and.push(tokens[i]!);

    // If current is not a logic boolean and next is not a logic boolean, insert an implicit AND.
    if (
      next &&
      next.type !== Token.LOGIC_BOOLEAN &&
      tokens[i]!.type !== Token.LOGIC_BOOLEAN &&
      tokens[i]!.type !== 'L_PAREN' &&
      next.type !== 'R_PAREN'
    ) {
      with_implicit_and.push(AND);
    }
  }

  return with_implicit_and;
}

function processTokenResults(tokens: TokenResult<Token>[]): ProcessedTokenResult[] {
  const flattened = toFlattened(tokens);
  const withImplicitAnd = insertImplicitAND(flattened);

  return withImplicitAnd;
}

function isBooleanAND(token: ProcessedTokenResult): boolean {
  return token?.type === Token.LOGIC_BOOLEAN && token?.value === BooleanOperator.AND;
}

// https://en.wikipedia.org/wiki/Shunting_yard_algorithm
export function toPostFix(tokens: TokenResult<Token>[]): ProcessedTokenResult[] {
  const processed = processTokenResults(tokens);

  const result: ProcessedTokenResult[] = [];
  const stack: ProcessedTokenResult[] = [];

  for (const token of processed) {
    switch (token.type) {
      case Token.LOGIC_BOOLEAN: {
        while (
          // Establishes higher precedence for AND operators.
          // Whenever the current operator is an OR and the top of the stack is an AND,
          // we need to pop the AND operator from the stack and push it to the output.
          stack.length > 0 &&
          token.value === BooleanOperator.OR &&
          stack[stack.length - 1]!.type === Token.LOGIC_BOOLEAN &&
          stack[stack.length - 1]!.type !== 'L_PAREN' &&
          isBooleanAND(stack[stack.length - 1]!)
        ) {
          result.push(stack.pop()!);
        }
        stack.push(token);
        break;
      }
      case 'L_PAREN':
        stack.push(token);
        break;
      case 'R_PAREN': {
        while (stack.length > 0) {
          const top = stack[stack.length - 1]!;
          if (top.type === 'L_PAREN') {
            stack.pop();
            break;
          }
          // we dont need to check for balanced parens as the parser grammar will only succeed
          // in parsing the input string if the parens are balanced.
          result.push(stack.pop() as ProcessedTokenResult);
        }
        break;
      }
      default: {
        result.push(token);
        break;
      }
    }
  }

  // Push the remained of the operators to the output
  while (stack.length > 0) {
    result.push(stack.pop() as ProcessedTokenResult);
  }

  return result;
}
