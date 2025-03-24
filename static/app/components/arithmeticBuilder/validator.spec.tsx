import {TokenKind} from 'sentry/components/arithmeticBuilder/token';
import {tokenizeExpression} from 'sentry/components/arithmeticBuilder/tokenizer';
import {
  computeNextAllowedTokenKinds,
  validateTokens,
} from 'sentry/components/arithmeticBuilder/validator';

describe('vaidateTokens', function () {
  it.each([
    '',
    '(',
    ')',
    '()',
    '+',
    '-',
    '*',
    '/',
    '( +',
    'foo',
    'bar',
    'bar bar',
    'avg(',
    'avg(span.duration',
    'avg(span.duration) +',
    '(avg(span.duration) +)',
    '(avg(span.duration) + foobar)',
    'avg(span.duration) + avg(span.duration) /',
    'avg(span.duration) avg(span.duration)',
    'avg(span.duration) + avg(span.duration))',
    'avg(span.duration) ( avg(span.duration) + avg(span.duration) )',
  ])('fails %s', function (expression) {
    const tokens = tokenizeExpression(expression);
    expect(validateTokens(tokens)).toBe(false);
  });

  it.each([
    'avg(span.duration)',
    '(avg(span.duration))',
    '((avg(span.duration)))',
    'avg(span.duration) + avg(span.duration)',
    '(avg(span.duration) + avg(span.duration))',
    '(avg(span.duration) + avg(span.duration)) / avg(span.duration)',
    '(avg(span.duration) + avg(span.duration)) / (avg(span.duration) - avg(span.duration))',
  ])('passes %s', function (expression) {
    const tokens = tokenizeExpression(expression);
    expect(validateTokens(tokens)).toBe(true);
  });
});

describe('computeNextAllowedTokenKinds', function () {
  it.each([
    ['', [[TokenKind.OPEN_PARENTHESIS, TokenKind.FUNCTION]]],
    [
      '(',
      [
        [TokenKind.OPEN_PARENTHESIS, TokenKind.FUNCTION],
        [],
        [TokenKind.OPEN_PARENTHESIS, TokenKind.FUNCTION],
      ],
    ],
    [
      'avg(span.duration)',
      [[TokenKind.OPEN_PARENTHESIS, TokenKind.FUNCTION], [], [TokenKind.OPERATOR]],
    ],
    [
      '(avg(span.duration)',
      [
        [TokenKind.OPEN_PARENTHESIS, TokenKind.FUNCTION],
        [],
        [TokenKind.OPEN_PARENTHESIS, TokenKind.FUNCTION],
        [],
        [TokenKind.CLOSE_PARENTHESIS, TokenKind.OPERATOR],
      ],
    ],
    [
      'avg(span.duration) (',
      [
        [TokenKind.OPEN_PARENTHESIS, TokenKind.FUNCTION],
        [],
        [TokenKind.OPERATOR],
        [],
        [TokenKind.OPEN_PARENTHESIS, TokenKind.FUNCTION],
      ],
    ],
  ])('suggests next token', function (expression, expected) {
    const tokens = tokenizeExpression(expression);
    expect(computeNextAllowedTokenKinds(tokens)).toEqual(expected);
  });
});
