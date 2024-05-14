import {joinTokens, parseFormula} from 'sentry/views/metrics/formulaParser/parser';
import {TokenType} from 'sentry/views/metrics/formulaParser/types';

const complexFormula = '2 / ((foo + 3) * c - (3 / 5))';
const complexTokenList = [
  {type: TokenType.NUMBER, content: '2'},
  {type: TokenType.WHITESPACE, content: ' '},
  {type: TokenType.DIVIDE, content: '/'},
  {type: TokenType.WHITESPACE, content: ' '},
  {type: TokenType.OPENPAREN, content: '('},
  {type: TokenType.WHITESPACE, content: ''},
  {type: TokenType.OPENPAREN, content: '('},
  {type: TokenType.WHITESPACE, content: ''},
  {type: TokenType.VARIABLE, content: 'foo'},
  {type: TokenType.WHITESPACE, content: ' '},
  {type: TokenType.PLUS, content: '+'},
  {type: TokenType.WHITESPACE, content: ' '},
  {type: TokenType.NUMBER, content: '3'},
  {type: TokenType.WHITESPACE, content: ''},
  {type: TokenType.CLOSEPAREN, content: ')'},
  {type: TokenType.WHITESPACE, content: ' '},
  {type: TokenType.MULTIPLY, content: '*'},
  {type: TokenType.WHITESPACE, content: ' '},
  {type: TokenType.VARIABLE, content: 'c'},
  {type: TokenType.WHITESPACE, content: ' '},
  {type: TokenType.MINUS, content: '-'},
  {type: TokenType.WHITESPACE, content: ' '},
  {type: TokenType.OPENPAREN, content: '('},
  {type: TokenType.WHITESPACE, content: ''},
  {type: TokenType.NUMBER, content: '3'},
  {type: TokenType.WHITESPACE, content: ' '},
  {type: TokenType.DIVIDE, content: '/'},
  {type: TokenType.WHITESPACE, content: ' '},
  {type: TokenType.NUMBER, content: '5'},
  {type: TokenType.WHITESPACE, content: ''},
  {type: TokenType.CLOSEPAREN, content: ')'},
  {type: TokenType.WHITESPACE, content: ''},
  {type: TokenType.CLOSEPAREN, content: ')'},
];

describe('formula > parseFormula', () => {
  it('parses a simple formula', () => {
    expect(parseFormula('1 +  1')).toEqual([
      {type: TokenType.NUMBER, content: '1'},
      {type: TokenType.WHITESPACE, content: ' '},
      {type: TokenType.PLUS, content: '+'},
      {type: TokenType.WHITESPACE, content: '  '},
      {type: TokenType.NUMBER, content: '1'},
    ]);
  });

  it('parses a variable', () => {
    expect(parseFormula('a')).toEqual([{type: TokenType.VARIABLE, content: 'a'}]);
    expect(parseFormula('bar')).toEqual([{type: TokenType.VARIABLE, content: 'bar'}]);
  });

  it('parses a number', () => {
    expect(parseFormula('1')).toEqual([{type: TokenType.NUMBER, content: '1'}]);
    expect(parseFormula('1.1')).toEqual([{type: TokenType.NUMBER, content: '1.1'}]);
    expect(parseFormula('1.01')).toEqual([{type: TokenType.NUMBER, content: '1.01'}]);
    expect(parseFormula('1.010')).toEqual([{type: TokenType.NUMBER, content: '1.010'}]);
  });

  it('parses a more complex formula', () => {
    expect(parseFormula(complexFormula)).toEqual(complexTokenList);
  });

  it('fails to parse an invalid formula', () => {
    expect(() => parseFormula('1 1')).toThrow();
  });
});

describe('formula > joinTokens', () => {
  it('joins a list of tokens', () => {
    expect(joinTokens(complexTokenList)).toEqual(complexFormula);
  });
});
