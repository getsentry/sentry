import type {ListState} from '@react-stately/list';
import type {LocationRange} from 'peggy';

import type {Token} from 'sentry/components/arithmeticBuilder/token';
import {
  isTokenFreeText,
  isTokenFunction,
  Operator,
  Parenthesis,
  TokenAttribute,
  TokenFreeText,
  TokenFunction,
  TokenKind,
  TokenOperator,
  TokenParenthesis,
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
    if (isTokenFreeText(prev) && isTokenFreeText(token)) {
      prev.merge(token);
    } else {
      // make sure to inject a free text token between every pair of non free space
      // tokens to allow users to enter things between them
      if (!isTokenFreeText(prev) && !isTokenFreeText(token)) {
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
    [TokenKind.PARENTHESIS]: 0,
    [TokenKind.OPERATOR]: 0,
    [TokenKind.FREE_TEXT]: 0,
    [TokenKind.ATTRIBUTE]: 0,
    [TokenKind.FUNCTION]: 0,
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

export function nextSimilarTokenKey(key: string): string {
  const {kind, index} = parseTokenKey(key);
  return makeTokenKey(kind, index + 1);
}

export function nextTokenKeyOfKind(
  state: ListState<Token>,
  token: Token,
  kind: TokenKind
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

  return defined(key) ? nextSimilarTokenKey(key) : makeTokenKey(kind);
}

class ArithmeticError extends Error {}

class TokenConverter {
  tokenParenthesis(parenthesis: string, location: LocationRange): TokenParenthesis {
    return new TokenParenthesis(location, toParenthesis(parenthesis));
  }

  tokenOperator(operator: string, location: LocationRange): TokenOperator {
    return new TokenOperator(location, toOperator(operator));
  }

  tokenFreeText(value: string, location: LocationRange): TokenFreeText {
    return new TokenFreeText(location, value);
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
    attribute: TokenAttribute,
    location: LocationRange
  ): TokenFunction {
    return new TokenFunction(location, func, [attribute]);
  }
}

export function toParenthesis(parenthesis: string): Parenthesis {
  switch (parenthesis) {
    case '(':
      return Parenthesis.OPEN;
    case ')':
      return Parenthesis.CLOSE;
    default:
      throw new ArithmeticError(`Unknown parenthesis: ${parenthesis}`);
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

export function toTokenKind(kind: string): TokenKind {
  switch (kind) {
    case TokenKind.PARENTHESIS:
      return TokenKind.PARENTHESIS;
    case TokenKind.OPERATOR:
      return TokenKind.OPERATOR;
    case TokenKind.FREE_TEXT:
      return TokenKind.FREE_TEXT;
    case TokenKind.ATTRIBUTE:
      return TokenKind.ATTRIBUTE;
    case TokenKind.FUNCTION:
      return TokenKind.FUNCTION;
    default:
      throw new ArithmeticError(`Unknown token kind: ${kind}`);
  }
}
