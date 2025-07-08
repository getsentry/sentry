import type {LocationRange} from 'peggy';

import {defined} from 'sentry/utils';

export enum TokenKind {
  UNKNOWN = 'unknown',
  CLOSE_PARENTHESIS = 'close_paren',
  OPEN_PARENTHESIS = 'open_paren',
  OPERATOR = 'op',
  FREE_TEXT = 'str',
  ATTRIBUTE = 'attr',
  FUNCTION = 'func',
}

export abstract class Token {
  kind: TokenKind = TokenKind.UNKNOWN;

  key = '';
  location: LocationRange;
  text = '';

  constructor(location: LocationRange, text: string) {
    this.location = location;
    this.text = text;
  }
}

export enum Parenthesis {
  OPEN = '(',
  CLOSE = ')',
}

export abstract class TokenParenthesis extends Token {
  parenthesis: Parenthesis;

  constructor(location: LocationRange, parenthesis: Parenthesis) {
    super(location, parenthesis);
    this.parenthesis = parenthesis;
  }
}

export class TokenOpenParenthesis extends TokenParenthesis {
  kind: TokenKind = TokenKind.OPEN_PARENTHESIS;

  constructor(location: LocationRange) {
    super(location, Parenthesis.OPEN);
  }
}

export class TokenCloseParenthesis extends TokenParenthesis {
  kind: TokenKind = TokenKind.CLOSE_PARENTHESIS;

  constructor(location: LocationRange) {
    super(location, Parenthesis.CLOSE);
  }
}

export enum Operator {
  PLUS = '+',
  MINUS = '-',
  MULTIPLY = '*',
  DIVIDE = '/',
}

export class TokenOperator extends Token {
  kind: TokenKind = TokenKind.OPERATOR;

  operator: Operator;

  constructor(location: LocationRange, operator: Operator) {
    super(location, operator);
    this.operator = operator;
  }
}

export class TokenAttribute extends Token {
  kind: TokenKind = TokenKind.ATTRIBUTE;

  attribute: string;
  type?: string;

  constructor(location: LocationRange, attribute: string, type?: string) {
    const text = defined(type) ? `tags[${attribute},${type}]` : attribute;
    super(location, text);
    this.attribute = attribute;
    this.type = type;
  }
}

export class TokenFunction extends Token {
  kind: TokenKind = TokenKind.FUNCTION;

  function: string;
  attributes: TokenAttribute[];

  constructor(location: LocationRange, func: string, attributes: TokenAttribute[]) {
    const args = attributes.map(attr => attr.text);
    const text = `${func}(${args.join(',')})`;
    super(location, text);
    this.function = func;
    this.attributes = attributes;
  }
}

export class TokenFreeText extends Token {
  kind: TokenKind = TokenKind.FREE_TEXT;

  merge(token: TokenFreeText) {
    // Assumes `this` and `token` are adjacent tokens with 0 more spaces between them.
    // Merges the 2 tokens into 1 token and fills the missing text with spaces.
    const spaces = token.location.start.offset - this.location.end.offset;
    this.location.end = token.location.end;
    this.text = `${this.text}${' '.repeat(spaces)}${token.text}`;
  }
}

export function isTokenParenthesis(
  token: Token | null | undefined
): token is TokenParenthesis {
  return (
    token?.kind === TokenKind.OPEN_PARENTHESIS ||
    token?.kind === TokenKind.CLOSE_PARENTHESIS
  );
}

export function isTokenOperator(token: Token | null | undefined): token is TokenOperator {
  return token?.kind === TokenKind.OPERATOR;
}

export function isTokenFreeText(token: Token | null | undefined): token is TokenFreeText {
  return token?.kind === TokenKind.FREE_TEXT;
}

export function isTokenFunction(token: Token | null | undefined): token is TokenFunction {
  return token?.kind === TokenKind.FUNCTION;
}
