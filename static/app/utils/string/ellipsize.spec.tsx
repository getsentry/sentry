import {ellipsize} from './ellipsize';

describe('ellipsize', () => {
  it.each([
    ['hello', 10, 'hello'],
    ['test', 5, 'test'],
    ['a', 2, 'a'],
    ['hello', 5, 'hello'],
    ['hello', Infinity, 'hello'],
    ['test', 4, 'test'],
    ['a', 1, 'a'],
    ['hello world', 8, 'hello wo…'],
    ['this is a long string', 10, 'this is a…'],
    ['abcdefghijk', 5, 'abcde…'],
    ['hello', 1, 'h…'],
    ['ab', 1, 'a…'],
    ['abc', 1, 'a…'],
    ['abc', 0, '…'],
    ['hello there', 6, 'hello…'],
    ['  hello there', 6, '  hell…'],
    ['hello@world.com', 10, 'hello@worl…'],
    ['line1\nline2\nline3', 12, 'line1\nline2…'],
    ['café', 3, 'caf…'],
    ['résumé', 5, 'résum…'],
    ['👋 hello world', 8, '👋 hello…'],
    ['   ', 7, '   '],
    ['   ', 2, '  …'],
    ['  hello  ', 6, '  hell…'],
    ['\t\n\r', 2, '\t\n…'],
  ])('should truncate "%s" with maxLength %d to "%s"', (input, maxLength, expected) => {
    expect(ellipsize(input, maxLength)).toBe(expected);
  });

  it.each([[NaN], [-Infinity], [-5]])('throws an error if the input is %s', input => {
    expect(() => {
      ellipsize('string', input);
    }).toThrow();
  });
});
