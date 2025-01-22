export enum TokenType {
  NUMBER = 'number',
  VARIABLE = 'variable',
  WHITESPACE = 'whitespace',
  OPENPAREN = 'openParen',
  CLOSEPAREN = 'closeParen',
  PLUS = 'plus',
  MINUS = 'minus',
  MULTIPLY = 'multiply',
  DIVIDE = 'divide',
  GENERIC = 'generic',
}

export interface Token {
  content: string;
  type: TokenType;
}

export type TokenList = Token[];
