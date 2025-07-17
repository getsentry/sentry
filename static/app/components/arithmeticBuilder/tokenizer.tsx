import type {ListState} from '@react-stately/list';
import type {LocationRange} from 'peggy';

import {
  isTokenFreeText,
  isTokenFunction,
  isTokenLiteral,
  Operator,
  type Token,
  TokenAttribute,
  TokenCloseParenthesis,
  TokenFreeText,
  TokenFunction,
  TokenKind,
  TokenLiteral,
  TokenOpenParenthesis,
  TokenOperator,
  type TokenParenthesis,
} from 'sentry/components/arithmeticBuilder/token';
import {defined} from 'sentry/utils';

import grammar from './grammar.pegjs';

function space(prev: LocationRange | null, next: LocationRange | null): TokenFreeText {
  const location: LocationRange = {
    source: undefined,
    start: prev
      ? prev.end
      : {
          offset: 0,
          line: 1,
          column: 1,
        },
    end: next
      ? next.start
      : prev
        ? prev.end
        : {
            offset: 0,
            line: 1,
            column: 1,
          },
  };
  return new TokenFreeText(location, '');
}

function tryTokenizeExpression(expression: string): Token[] {
  if (!expression.trim()) {
    return [];
  }

  const tc = new TokenConverter();
  return grammar.parse(expression, {tc});
}

export function tokenizeExpression(expression: string): Token[] {
  let loc: LocationRange | null = null;

  const tokens: Token[] = [];

  for (const token of tryTokenizeExpression(expression)) {
    const prev = tokens[tokens.length - 1];
    if (isTokenFreeText(token) && isTokenFreeText(prev)) {
      prev.merge(token);
    } else if (
      isTokenLiteral(token) &&
      defined(token.sign) &&
      (isTokenLiteral(prev) || isTokenFunction(prev))
    ) {
      // Because we're tokenizing expressions, we have to permit some intermedate
      // invalid states. As a result, we greedily pair positive/negative signs with
      // a trailing literal. This means an expression like  `1+1` gets tokenized as
      // `1` and `+1`. But what we want is to tokenize it was `1` `+` `1`. To handle
      // this situation, we check to see if a signed literal trails another valid
      // literal or expression, and in this case we treat the sign as an operation.
      const [op, lit] = token.split();

      // make sure to inject a free text token before the operator
      tokens.push(space(loc, op.location));
      tokens.push(op);
      loc = op.location;

      // make sure to inject a free text token before the literal
      tokens.push(space(loc, lit.location));
      tokens.push(lit);
      loc = lit.location;
    } else {
      // make sure to inject a free text token between every pair of non free space
      // tokens to allow users to enter things between them
      if (!isTokenFreeText(token) && !isTokenFreeText(prev)) {
        tokens.push(space(loc, token.location));
      }

      tokens.push(token);
      loc = token.location;
    }
  }

  // make sure to check if we need a space at the end
  if (tokens.length <= 0 || !isTokenFreeText(tokens[tokens.length - 1])) {
    tokens.push(space(loc, null));
  }

  const counters: Record<TokenKind, number> = {
    [TokenKind.UNKNOWN]: 0,
    [TokenKind.OPEN_PARENTHESIS]: 0,
    [TokenKind.CLOSE_PARENTHESIS]: 0,
    [TokenKind.OPERATOR]: 0,
    [TokenKind.FREE_TEXT]: 0,
    [TokenKind.ATTRIBUTE]: 0,
    [TokenKind.FUNCTION]: 0,
    [TokenKind.LITERAL]: 0,
  };

  // assign an unique key to each token based on it's type
  // and it's position in the list
  for (const token of tokens) {
    const i = counters[token.kind]++;
    token.key = makeTokenKey(token.kind, i);

    if (isTokenFunction(token)) {
      for (const attr of token.attributes) {
        const j = counters[attr.kind]++;
        attr.key = makeTokenKey(attr.kind, j);
      }
    }
  }

  return tokens;
}

export function makeTokenKey(kind: TokenKind, i = 0): string {
  return `${kind}:${i}`;
}

function parseTokenKey(key: string) {
  const [kind, indexStr] = key.split(':');
  const index = parseInt(indexStr!, 10);
  return {kind: toTokenKind(kind!), index};
}

function isTokenKeyOfKind(key: string, kind: TokenKind) {
  return key.startsWith(kind);
}

export function nextSimilarTokenKey(key: string, offset = 1): string {
  const {kind, index} = parseTokenKey(key);
  return makeTokenKey(kind, index + offset);
}

export function nextTokenKeyOfKind(
  state: ListState<Token>,
  token: Token,
  kind: TokenKind,
  offset?: number
): string {
  let key: string | null = null;

  for (const tokenKey of state.collection.getKeys()) {
    if (tokenKey === token.key) {
      break;
    }

    // assumes we only use string keys
    if (typeof tokenKey === 'string' && isTokenKeyOfKind(tokenKey, kind)) {
      key = tokenKey;
    }
  }

  return defined(key)
    ? nextSimilarTokenKey(key, offset)
    : // unable to find any tokens of the given kind, so assume this will be the first one
      makeTokenKey(kind);
}

class ArithmeticError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ArithmeticError';
  }
}

class TokenConverter {
  tokenParenthesis(parenthesis: string, location: LocationRange): TokenParenthesis {
    if (parenthesis === '(') {
      return new TokenOpenParenthesis(location);
    }

    if (parenthesis === ')') {
      return new TokenCloseParenthesis(location);
    }

    throw new ArithmeticError(`Unknown parenthesis: ${parenthesis}`);
  }

  tokenOperator(operator: string, location: LocationRange): TokenOperator {
    return new TokenOperator(location, toOperator(operator));
  }

  tokenFreeText(value: string, location: LocationRange): TokenFreeText {
    return new TokenFreeText(location, value);
  }

  tokenLiteral(value: string, location: LocationRange): TokenLiteral {
    return new TokenLiteral(location, value);
  }

  tokenAttribute(
    attribute: string,
    type: string | undefined,
    location: LocationRange
  ): TokenAttribute {
    return new TokenAttribute(location, attribute, type);
  }

  tokenFunction(
    func: string,
    attributes: TokenAttribute[],
    location: LocationRange
  ): TokenFunction {
    return new TokenFunction(location, func, attributes);
  }
}

export function toOperator(operator: string): Operator {
  switch (operator) {
    case '+':
      return Operator.PLUS;
    case '-':
      return Operator.MINUS;
    case '*':
      return Operator.MULTIPLY;
    case '/':
      return Operator.DIVIDE;
    default:
      throw new ArithmeticError(`Unknown operator: ${operator}`);
  }
}

function toTokenKind(kind: string): TokenKind {
  switch (kind) {
    case TokenKind.OPEN_PARENTHESIS:
      return TokenKind.OPEN_PARENTHESIS;
    case TokenKind.CLOSE_PARENTHESIS:
      return TokenKind.CLOSE_PARENTHESIS;
    case TokenKind.OPERATOR:
      return TokenKind.OPERATOR;
    case TokenKind.FREE_TEXT:
      return TokenKind.FREE_TEXT;
    case TokenKind.ATTRIBUTE:
      return TokenKind.ATTRIBUTE;
    case TokenKind.FUNCTION:
      return TokenKind.FUNCTION;
    case TokenKind.LITERAL:
      return TokenKind.LITERAL;
    default:
      throw new ArithmeticError(`Unknown token kind: ${kind}`);
  }
}
