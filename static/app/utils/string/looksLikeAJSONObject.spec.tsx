import {looksLikeAJSONObject} from './looksLikeAJSONObject';

describe('looksLikeAJSONObject', () => {
  it.each([
    ['{}', true],
    ['{"hello": "world"}', true],
    ['{"key": 1}', true],
    ['{"key": true}', true],
    ['  {}  ', true],
    ['[Filtered]', false],
    ['[]', false],
    ['hello world', false],
    ['{incomplete', false],
    ['incomplete}', false],
    ['', false],
  ])('"%s" should return %s', (input, expected) => {
    expect(looksLikeAJSONObject(input)).toBe(expected);
  });
});
