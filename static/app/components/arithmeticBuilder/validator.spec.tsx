import {tokenizeExpression} from 'sentry/components/arithmeticBuilder/tokenizer';
import {validateTokens} from 'sentry/components/arithmeticBuilder/validator';

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
