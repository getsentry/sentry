import type {Token} from 'sentry/components/arithmeticBuilder/token';
import {
  TokenAttribute,
  TokenCloseParenthesis,
  TokenFreeText,
  TokenFunction,
  TokenLiteral,
  TokenOpenParenthesis,
  TokenOperator,
} from 'sentry/components/arithmeticBuilder/token';
import {
  makeTokenKey,
  tokenizeExpression,
  toOperator,
} from 'sentry/components/arithmeticBuilder/tokenizer';

function k<T extends Token>(i: number, token: T): T {
  token.key = makeTokenKey(token.kind, i);
  return token;
}

function po(i: number): TokenOpenParenthesis {
  return k(i, new TokenOpenParenthesis(expect.objectContaining({})));
}

function pc(i: number): TokenCloseParenthesis {
  return k(i, new TokenCloseParenthesis(expect.objectContaining({})));
}

function o(i: number, op: '+' | '-' | '*' | '/'): TokenOperator {
  return k(i, new TokenOperator(expect.objectContaining({}), toOperator(op)));
}

function l(i: number, literal: string): TokenLiteral {
  return k(i, new TokenLiteral(expect.objectContaining({}), literal));
}

function s(i: number, value = ''): TokenFreeText {
  return k(i, new TokenFreeText(expect.objectContaining({}), value));
}

function a(i: number, attribute: string, type?: string): TokenAttribute {
  return k(i, new TokenAttribute(expect.objectContaining({}), attribute, type));
}

function f(i: number, func: string, attributes: TokenAttribute[]): TokenFunction {
  return k(i, new TokenFunction(expect.objectContaining({}), func, attributes));
}

describe('tokenizeExpression', function () {
  it.each([
    ['(', [s(0), po(0), s(1)]],
    [')', [s(0), pc(0), s(1)]],
  ])('tokenizes parenthesis `%s`', function (expression, expected) {
    expect(tokenizeExpression(expression)).toEqual(expected);
  });

  it.each([
    ['+', [s(0), o(0, '+'), s(1)]],
    ['-', [s(0), o(0, '-'), s(1)]],
    ['*', [s(0), o(0, '*'), s(1)]],
    ['/', [s(0), o(0, '/'), s(1)]],
  ])('tokenizes operator `%s`', function (expression, expected) {
    expect(tokenizeExpression(expression)).toEqual(expected);
  });

  it.each([
    ['0', l(0, '0')],
    ['+0', l(0, '+0')],
    ['-0', l(0, '-0')],
    ['1', l(0, '1')],
    ['+1', l(0, '+1')],
    ['-1', l(0, '-1')],
    ['0.', l(0, '0.')],
    ['+0.', l(0, '+0.')],
    ['-0.', l(0, '-0.')],
    ['0.0', l(0, '0.0')],
    ['+0.0', l(0, '+0.0')],
    ['-0.0', l(0, '-0.0')],
    ['1234567890', l(0, '1234567890')],
    ['+1234567890', l(0, '+1234567890')],
    ['-1234567890', l(0, '-1234567890')],
    ['12345.67890', l(0, '12345.67890')],
    ['+12345.67890', l(0, '+12345.67890')],
    ['-12345.67890', l(0, '-12345.67890')],
  ])('tokenizes literal `%s`', function (expression, expected) {
    expect(tokenizeExpression(expression)).toEqual([s(0), expected, s(1)]);
  });

  it.each([
    ['avg(span.duration)', f(0, 'avg', [a(0, 'span.duration')])],
    ['avg(measurements.lcp)', f(0, 'avg', [a(0, 'measurements.lcp')])],
    ['avg(tags[foo,number])', f(0, 'avg', [a(0, 'foo', 'number')])],
    ['avg(tags[foo,  number])', f(0, 'avg', [a(0, 'foo', 'number')])],
    ['avg(   tags[foo,  number]   )', f(0, 'avg', [a(0, 'foo', 'number')])],
    ['epm()', f(0, 'epm', [])],
  ])('tokenizes function `%s`', function (expression, expected) {
    expect(tokenizeExpression(expression)).toEqual([s(0), expected, s(1)]);
  });

  it.each([
    ['span', [s(0, 'span')]],
    ['span.', [s(0, 'span.')]],
    ['span.duration', [s(0, 'span.duration')]],
    ['tags', [s(0, 'tags')]],
    ['tags[', [s(0, 'tags[')]],
    ['tags[foo', [s(0, 'tags[foo')]],
    ['tags[foo,', [s(0, 'tags[foo,')]],
    ['tags[foo,number', [s(0, 'tags[foo,number')]],
    ['tags[foo,number]', [s(0, 'tags[foo,number]')]],
    ['tags[foo,   number', [s(0, 'tags[foo,   number')]],
    ['tags[foo,   number]', [s(0, 'tags[foo,   number]')]],
    ['avg', [s(0, 'avg')]],
    ['avg(', [s(0, 'avg(')]],
    ['avg(span', [s(0, 'avg(span')]],
    ['avg(span.', [s(0, 'avg(span.')]],
    ['avg(span.duration', [s(0, 'avg(span.duration')]],
    ['avg(tags', [s(0, 'avg(tags')]],
    ['avg(tags[', [s(0, 'avg(tags[')]],
    ['avg(tags[foo', [s(0, 'avg(tags[foo')]],
    ['avg(tags[foo,', [s(0, 'avg(tags[foo,')]],
    ['avg(tags[foo,number', [s(0, 'avg(tags[foo,number')]],
    ['avg(tags[foo,number]', [s(0, 'avg(tags[foo,number]')]],
  ])('tokenizes partial function `%s`', function (expression, expected) {
    expect(tokenizeExpression(expression)).toEqual(expected);
  });

  it.each([
    ['1+1', [s(0), l(0, '1'), s(1), o(0, '+'), s(2), l(1, '1'), s(3)]],
    [
      '1+avg(span.duration)',
      [
        s(0),
        l(0, '1'),
        s(1),
        o(0, '+'),
        s(2),
        f(0, 'avg', [a(0, 'span.duration')]),
        s(3),
      ],
    ],
    [
      '1 + avg(span.duration)',
      [
        s(0),
        l(0, '1'),
        s(1),
        o(0, '+'),
        s(2),
        f(0, 'avg', [a(0, 'span.duration')]),
        s(3),
      ],
    ],
    [
      'avg(span.duration)+1',
      [
        s(0),
        f(0, 'avg', [a(0, 'span.duration')]),
        s(1),
        o(0, '+'),
        s(2),
        l(0, '1'),
        s(3),
      ],
    ],
    [
      'avg(span.duration) + 1',
      [
        s(0),
        f(0, 'avg', [a(0, 'span.duration')]),
        s(1),
        o(0, '+'),
        s(2),
        l(0, '1'),
        s(3),
      ],
    ],
    [
      'avg(span.duration)+avg(tags[foo,number])',
      [
        s(0),
        f(0, 'avg', [a(0, 'span.duration')]),
        s(1),
        o(0, '+'),
        s(2),
        f(1, 'avg', [a(1, 'foo', 'number')]),
        s(3),
      ],
    ],
    [
      'avg(span.duration) + avg(tags[foo,number])',
      [
        s(0),
        f(0, 'avg', [a(0, 'span.duration')]),
        s(1),
        o(0, '+'),
        s(2),
        f(1, 'avg', [a(1, 'foo', 'number')]),
        s(3),
      ],
    ],
    [
      'avg(span.duration)-avg(tags[foo,number])',
      [
        s(0),
        f(0, 'avg', [a(0, 'span.duration')]),
        s(1),
        o(0, '-'),
        s(2),
        f(1, 'avg', [a(1, 'foo', 'number')]),
        s(3),
      ],
    ],
    [
      'avg(span.duration) - avg(tags[foo,number])',
      [
        s(0),
        f(0, 'avg', [a(0, 'span.duration')]),
        s(1),
        o(0, '-'),
        s(2),
        f(1, 'avg', [a(1, 'foo', 'number')]),
        s(3),
      ],
    ],
    [
      'avg(span.duration)*avg(tags[foo,number])',
      [
        s(0),
        f(0, 'avg', [a(0, 'span.duration')]),
        s(1),
        o(0, '*'),
        s(2),
        f(1, 'avg', [a(1, 'foo', 'number')]),
        s(3),
      ],
    ],
    [
      'avg(span.duration) * avg(tags[foo,number])',
      [
        s(0),
        f(0, 'avg', [a(0, 'span.duration')]),
        s(1),
        o(0, '*'),
        s(2),
        f(1, 'avg', [a(1, 'foo', 'number')]),
        s(3),
      ],
    ],
    [
      'avg(span.duration)/avg(tags[foo,number])',
      [
        s(0),
        f(0, 'avg', [a(0, 'span.duration')]),
        s(1),
        o(0, '/'),
        s(2),
        f(1, 'avg', [a(1, 'foo', 'number')]),
        s(3),
      ],
    ],
    [
      'avg(span.duration) / avg(tags[foo,number])',
      [
        s(0),
        f(0, 'avg', [a(0, 'span.duration')]),
        s(1),
        o(0, '/'),
        s(2),
        f(1, 'avg', [a(1, 'foo', 'number')]),
        s(3),
      ],
    ],
  ])('tokenizes binary expressions `%s`', function (expression, expected) {
    expect(tokenizeExpression(expression)).toEqual(expected);
  });

  it.each([
    [
      'avg(span.duration)+',
      [s(0), f(0, 'avg', [a(0, 'span.duration')]), s(1), o(0, '+'), s(2)],
    ],
    [
      'avg(span.duration) + ',
      [s(0), f(0, 'avg', [a(0, 'span.duration')]), s(1), o(0, '+'), s(2)],
    ],
    [
      'avg(span.duration)-',
      [s(0), f(0, 'avg', [a(0, 'span.duration')]), s(1), o(0, '-'), s(2)],
    ],
    [
      'avg(span.duration) - ',
      [s(0), f(0, 'avg', [a(0, 'span.duration')]), s(1), o(0, '-'), s(2)],
    ],
    [
      'avg(span.duration)*',
      [s(0), f(0, 'avg', [a(0, 'span.duration')]), s(1), o(0, '*'), s(2)],
    ],
    [
      'avg(span.duration) * ',
      [s(0), f(0, 'avg', [a(0, 'span.duration')]), s(1), o(0, '*'), s(2)],
    ],
    [
      'avg(span.duration)/',
      [s(0), f(0, 'avg', [a(0, 'span.duration')]), s(1), o(0, '/'), s(2)],
    ],
    [
      'avg(span.duration) / ',
      [s(0), f(0, 'avg', [a(0, 'span.duration')]), s(1), o(0, '/'), s(2)],
    ],
  ])('tokenizes partial binary expressions `%s`', function (expression, expected) {
    expect(tokenizeExpression(expression)).toEqual(expected);
  });

  it.each([
    [
      '(avg(span.duration)+avg(tags[foo,number]))',
      [
        s(0),
        po(0),
        s(1),
        f(0, 'avg', [a(0, 'span.duration')]),
        s(2),
        o(0, '+'),
        s(3),
        f(1, 'avg', [a(1, 'foo', 'number')]),
        s(4),
        pc(0),
        s(5),
      ],
    ],
    [
      '(avg(span.duration) + avg(tags[foo,number]))',
      [
        s(0),
        po(0),
        s(1),
        f(0, 'avg', [a(0, 'span.duration')]),
        s(2),
        o(0, '+'),
        s(3),
        f(1, 'avg', [a(1, 'foo', 'number')]),
        s(4),
        pc(0),
        s(5),
      ],
    ],
    [
      '(avg(span.duration)-avg(tags[foo,number]))',
      [
        s(0),
        po(0),
        s(1),
        f(0, 'avg', [a(0, 'span.duration')]),
        s(2),
        o(0, '-'),
        s(3),
        f(1, 'avg', [a(1, 'foo', 'number')]),
        s(4),
        pc(0),
        s(5),
      ],
    ],
    [
      '(avg(span.duration) - avg(tags[foo,number]))',
      [
        s(0),
        po(0),
        s(1),
        f(0, 'avg', [a(0, 'span.duration')]),
        s(2),
        o(0, '-'),
        s(3),
        f(1, 'avg', [a(1, 'foo', 'number')]),
        s(4),
        pc(0),
        s(5),
      ],
    ],
    [
      '(avg(span.duration)*avg(tags[foo,number]))',
      [
        s(0),
        po(0),
        s(1),
        f(0, 'avg', [a(0, 'span.duration')]),
        s(2),
        o(0, '*'),
        s(3),
        f(1, 'avg', [a(1, 'foo', 'number')]),
        s(4),
        pc(0),
        s(5),
      ],
    ],
    [
      '(avg(span.duration) * avg(tags[foo,number]))',
      [
        s(0),
        po(0),
        s(1),
        f(0, 'avg', [a(0, 'span.duration')]),
        s(2),
        o(0, '*'),
        s(3),
        f(1, 'avg', [a(1, 'foo', 'number')]),
        s(4),
        pc(0),
        s(5),
      ],
    ],
    [
      '(avg(span.duration)/avg(tags[foo,number]))',
      [
        s(0),
        po(0),
        s(1),
        f(0, 'avg', [a(0, 'span.duration')]),
        s(2),
        o(0, '/'),
        s(3),
        f(1, 'avg', [a(1, 'foo', 'number')]),
        s(4),
        pc(0),
        s(5),
      ],
    ],
    [
      '(avg(span.duration) / avg(tags[foo,number]))',
      [
        s(0),
        po(0),
        s(1),
        f(0, 'avg', [a(0, 'span.duration')]),
        s(2),
        o(0, '/'),
        s(3),
        f(1, 'avg', [a(1, 'foo', 'number')]),
        s(4),
        pc(0),
        s(5),
      ],
    ],
    [
      '(   avg(span.duration)+avg(tags[foo,number])   )',
      [
        s(0),
        po(0),
        s(1),
        f(0, 'avg', [a(0, 'span.duration')]),
        s(2),
        o(0, '+'),
        s(3),
        f(1, 'avg', [a(1, 'foo', 'number')]),
        s(4),
        pc(0),
        s(5),
      ],
    ],
    [
      '(   avg(span.duration) + avg(tags[foo,number])   )',
      [
        s(0),
        po(0),
        s(1),
        f(0, 'avg', [a(0, 'span.duration')]),
        s(2),
        o(0, '+'),
        s(3),
        f(1, 'avg', [a(1, 'foo', 'number')]),
        s(4),
        pc(0),
        s(5),
      ],
    ],
    [
      '(   avg(span.duration)-avg(tags[foo,number])   )',
      [
        s(0),
        po(0),
        s(1),
        f(0, 'avg', [a(0, 'span.duration')]),
        s(2),
        o(0, '-'),
        s(3),
        f(1, 'avg', [a(1, 'foo', 'number')]),
        s(4),
        pc(0),
        s(5),
      ],
    ],
    [
      '(   avg(span.duration) - avg(tags[foo,number])   )',
      [
        s(0),
        po(0),
        s(1),
        f(0, 'avg', [a(0, 'span.duration')]),
        s(2),
        o(0, '-'),
        s(3),
        f(1, 'avg', [a(1, 'foo', 'number')]),
        s(4),
        pc(0),
        s(5),
      ],
    ],
    [
      '(   avg(span.duration)*avg(tags[foo,number])   )',
      [
        s(0),
        po(0),
        s(1),
        f(0, 'avg', [a(0, 'span.duration')]),
        s(2),
        o(0, '*'),
        s(3),
        f(1, 'avg', [a(1, 'foo', 'number')]),
        s(4),
        pc(0),
        s(5),
      ],
    ],
    [
      '(   avg(span.duration) * avg(tags[foo,number])   )',
      [
        s(0),
        po(0),
        s(1),
        f(0, 'avg', [a(0, 'span.duration')]),
        s(2),
        o(0, '*'),
        s(3),
        f(1, 'avg', [a(1, 'foo', 'number')]),
        s(4),
        pc(0),
        s(5),
      ],
    ],
    [
      '(   avg(span.duration)/avg(tags[foo,number])   )',
      [
        s(0),
        po(0),
        s(1),
        f(0, 'avg', [a(0, 'span.duration')]),
        s(2),
        o(0, '/'),
        s(3),
        f(1, 'avg', [a(1, 'foo', 'number')]),
        s(4),
        pc(0),
        s(5),
      ],
    ],
    [
      '(   avg(span.duration) / avg(tags[foo,number])   )',
      [
        s(0),
        po(0),
        s(1),
        f(0, 'avg', [a(0, 'span.duration')]),
        s(2),
        o(0, '/'),
        s(3),
        f(1, 'avg', [a(1, 'foo', 'number')]),
        s(4),
        pc(0),
        s(5),
      ],
    ],
  ])('tokenizes parenthesized binary expressions `%s`', function (expression, expected) {
    expect(tokenizeExpression(expression)).toEqual(expected);
  });

  it.each([
    [
      '( + avg(span.duration)',
      [s(0), po(0), s(1), o(0, '+'), s(2), f(0, 'avg', [a(0, 'span.duration')]), s(3)],
    ],
    [
      '( avg(span.duration) +',
      [s(0), po(0), s(1), f(0, 'avg', [a(0, 'span.duration')]), s(2), o(0, '+'), s(3)],
    ],
    ['( avg(span   +', [s(0), po(0), s(1, 'avg(span'), o(0, '+'), s(2)]],
    [
      '( avg(span   + avg(span.duration) ) / ',
      [
        s(0),
        po(0),
        s(1, 'avg(span'),
        o(0, '+'),
        s(2),
        f(0, 'avg', [a(0, 'span.duration')]),
        s(3),
        pc(0),
        s(4),
        o(1, '/'),
        s(5),
      ],
    ],
    [
      ' avg(span.duration) * ( p75(tags[foo, number]) + p50(tags[foo, )',
      [
        s(0),
        f(0, 'avg', [a(0, 'span.duration')]),
        s(1),
        o(0, '*'),
        s(2),
        po(0),
        s(3),
        f(1, 'p75', [a(1, 'foo', 'number')]),
        s(4),
        o(1, '+'),
        s(5, 'p50(tags[foo, )'),
      ],
    ],
  ])('tokenizes complex partial expressions `%s`', function (expression, expected) {
    expect(tokenizeExpression(expression)).toEqual(expected);
  });

  it.each([
    ['', [s(0)]],
    [' ', [s(0)]],
    [',', [s(0, ',')]],
    [',', [s(0, ',')]],
    [', +', [s(0, ','), o(0, '+'), s(1)]],
    [
      ', + avg(span.duration)',
      [s(0, ','), o(0, '+'), s(1), f(0, 'avg', [a(0, 'span.duration')]), s(2)],
    ],
    ['foo,bar(', [s(0, 'foo,bar(')]],
    ['foo     bar(', [s(0, 'foo     bar(')]],
    ['foo     bar(baz)     qux', [s(0, 'foo'), f(0, 'bar', [a(0, 'baz')]), s(1, 'qux')]],
  ])('tokenizes bad expressions `%s`', function (expression, expected) {
    expect(tokenizeExpression(expression)).toEqual(expected);
  });
});
