import {looksLikeAJSONArray} from './looksLikeAJSONArray';

describe('looksLikeAJSONArray', () => {
  it.each([
    ['[]', true],
    ['[1, 2, 3]', true],
    ['["hello", "world"]', true],
    ['[{"key": "value"}]', true],
    ['  []  ', true],
    ['[Filtered]', false],
    ['{}', false],
    ['{"key": "value"}', false],
    ['hello world', false],
    ['[incomplete', false],
    ['incomplete]', false],
    ['', false],
  ])('"%s" should return %s', (input, expected) => {
    expect(looksLikeAJSONArray(input)).toBe(expected);
  });
});
