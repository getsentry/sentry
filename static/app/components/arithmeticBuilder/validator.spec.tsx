import {TokenKind} from 'sentry/components/arithmeticBuilder/token';
import {tokenizeExpression} from 'sentry/components/arithmeticBuilder/tokenizer';
import {
  computeNextAllowedTokenKinds,
  validateTokens,
} from 'sentry/components/arithmeticBuilder/validator';

describe('vaidateTokens', () => {
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
  ])('fails %s', expression => {
    const tokens = tokenizeExpression(expression);
    expect(validateTokens(tokens)).toBe(false);
  });

  it.each([
    '1',
    '(1)',
    '((1))',
    '1 + 1',
    '(1 + 1)',
    '(1 + 1) / 1',
    '(1 + 1) / (1 - 1)',
    'avg(span.duration)',
    '(avg(span.duration))',
    '((avg(span.duration)))',
    'avg(span.duration) + avg(span.duration)',
    '(avg(span.duration) + avg(span.duration))',
    '(avg(span.duration) + avg(span.duration)) / avg(span.duration)',
    '(avg(span.duration) + avg(span.duration)) / (avg(span.duration) - avg(span.duration))',
    'avg(span.duration) + 1',
    '(avg(span.duration) + 1)',
    '1 + avg(span.duration)',
    '(1 + avg(span.duration))',
  ])('passes %s', expression => {
    const tokens = tokenizeExpression(expression);
    expect(validateTokens(tokens)).toBe(true);
  });

  it.each([
    ['A + B', new Set(['A', 'B'])],
    ['A + 1', new Set(['A', 'B'])],
    ['(A + B) - 1', new Set(['A', 'B'])],
    ['(A + B) * (A - B)', new Set(['A', 'B'])],
    ['(A + B) * (A - B) / 100', new Set(['A', 'B'])],
    ['((A + B) * (A - B)) / 100', new Set(['A', 'B'])],
  ])('passes with references `%s`', (expression, references) => {
    const tokens = tokenizeExpression(expression, references);
    expect(validateTokens(tokens)).toBe(true);
  });
});

describe('computeNextAllowedTokenKinds', () => {
  it.each([
    [
      '',
      [
        [
          TokenKind.OPEN_PARENTHESIS,
          TokenKind.FUNCTION,
          TokenKind.LITERAL,
          TokenKind.REFERENCE,
        ],
      ],
    ],
    [
      '(',
      [
        [
          TokenKind.OPEN_PARENTHESIS,
          TokenKind.FUNCTION,
          TokenKind.LITERAL,
          TokenKind.REFERENCE,
        ],
        [],
        [
          TokenKind.OPEN_PARENTHESIS,
          TokenKind.FUNCTION,
          TokenKind.LITERAL,
          TokenKind.REFERENCE,
        ],
      ],
    ],
    [
      'avg(span.duration)',
      [
        [
          TokenKind.OPEN_PARENTHESIS,
          TokenKind.FUNCTION,
          TokenKind.LITERAL,
          TokenKind.REFERENCE,
        ],
        [],
        [TokenKind.OPERATOR],
      ],
    ],
    [
      '(avg(span.duration)',
      [
        [
          TokenKind.OPEN_PARENTHESIS,
          TokenKind.FUNCTION,
          TokenKind.LITERAL,
          TokenKind.REFERENCE,
        ],
        [],
        [
          TokenKind.OPEN_PARENTHESIS,
          TokenKind.FUNCTION,
          TokenKind.LITERAL,
          TokenKind.REFERENCE,
        ],
        [],
        [TokenKind.CLOSE_PARENTHESIS, TokenKind.OPERATOR],
      ],
    ],
    [
      'avg(span.duration) (',
      [
        [
          TokenKind.OPEN_PARENTHESIS,
          TokenKind.FUNCTION,
          TokenKind.LITERAL,
          TokenKind.REFERENCE,
        ],
        [],
        [TokenKind.OPERATOR],
        [],
        [
          TokenKind.OPEN_PARENTHESIS,
          TokenKind.FUNCTION,
          TokenKind.LITERAL,
          TokenKind.REFERENCE,
        ],
      ],
    ],
    [
      '1 1',
      [
        [
          TokenKind.OPEN_PARENTHESIS,
          TokenKind.FUNCTION,
          TokenKind.LITERAL,
          TokenKind.REFERENCE,
        ],
        [],
        [TokenKind.OPERATOR],
        [],
        [TokenKind.OPERATOR],
      ],
    ],
  ])('suggests next token %s', (expression, expected) => {
    const tokens = tokenizeExpression(expression);
    expect(computeNextAllowedTokenKinds(tokens)).toEqual(expected);
  });
});
