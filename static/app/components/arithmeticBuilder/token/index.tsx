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

  constructor(location: LocationRange) {
    this.location = location;
  }
}

export enum Parenthesis {
  OPEN = '(',
  CLOSE = ')',
}

export abstract class TokenParenthesis extends Token {
  parenthesis: Parenthesis;

  constructor(location: LocationRange, parenthesis: Parenthesis) {
    super(location);
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
    super(location);
    this.operator = operator;
  }
}

export class TokenAttribute extends Token {
  kind: TokenKind = TokenKind.ATTRIBUTE;

  attribute: string;
  type?: string;

  constructor(location: LocationRange, attribute: string, type?: string) {
    super(location);
    this.attribute = attribute;
    this.type = type;
  }

  format(): string {
    if (defined(this.type)) {
      return `tags[${this.attribute},${this.type}]`;
    }
    return this.attribute;
  }
}

export class TokenFunction extends Token {
  kind: TokenKind = TokenKind.FUNCTION;

  function: string;
  attributes: TokenAttribute[];

  constructor(location: LocationRange, func: string, attributes: TokenAttribute[]) {
    super(location);
    this.function = func;
    this.attributes = attributes;
  }

  format(): string {
    const args = this.attributes.map(attr => attr.format());
    return `${this.function}(${args.join(',')})`;
  }
}

export class TokenFreeText extends Token {
  kind: TokenKind = TokenKind.FREE_TEXT;

  text: string;

  constructor(location: LocationRange, text: string) {
    super(location);
    this.text = text;
  }

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

export function isTokenAttribute(
  token: Token | null | undefined
): token is TokenAttribute {
  return token?.kind === TokenKind.ATTRIBUTE;
}

export function isTokenFunction(token: Token | null | undefined): token is TokenFunction {
  return token?.kind === TokenKind.FUNCTION;
}
