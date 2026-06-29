import {
  convertMultilineFieldValue,
  descopeFeatureName,
  escapeDoubleQuotes,
  explodeSlug,
  extractMultilineFields,
} from 'sentry/utils';

describe('utils.extractMultilineFields', () => {
  it('should split string by newlines', () => {
    expect(extractMultilineFields('one\ntwo\nthree')).toEqual(['one', 'two', 'three']);
  });

  it('should trim values and ignore empty lines', () => {
    expect(
      extractMultilineFields(
        `one
  two

three
        four

five`
      )
    ).toEqual(['one', 'two', 'three', 'four', 'five']);
  });

  it('should return string array as-is', () => {
    expect(extractMultilineFields(['one', 'two', 'three'])).toEqual([
      'one',
      'two',
      'three',
    ]);
  });

  it('should return empty array for invalid input', () => {
    expect(extractMultilineFields(null)).toEqual([]);
    expect(extractMultilineFields(undefined)).toEqual([]);
    expect(extractMultilineFields(['one', 2, 'three'])).toEqual([]);
  });
});

describe('utils.convertMultilineFieldValue', () => {
  it('should return string as-is', () => {
    expect(convertMultilineFieldValue('one\ntwo\nthree')).toBe('one\ntwo\nthree');
  });

  it('should join string array with newlines', () => {
    expect(convertMultilineFieldValue(['one', 'two', 'three'])).toBe('one\ntwo\nthree');
  });

  it('should return empty string for invalid input', () => {
    expect(convertMultilineFieldValue(null)).toBe('');
    expect(convertMultilineFieldValue(undefined)).toBe('');
    expect(convertMultilineFieldValue(['one', 2, 'three'])).toBe('');
  });
});

describe('utils.explodeSlug', () => {
  it('replaces slug special chars with whitespace', () => {
    expect(explodeSlug('test--slug__replace-')).toBe('test slug replace');
  });
});

describe('utils.descopeFeatureName', () => {
  it('descopes the feature name', () => {
    [
      ['organizations:feature', 'feature'],
      ['projects:feature', 'feature'],
      ['unknown-scope:feature', 'unknown-scope:feature'],
      ['', ''],
    ].forEach(([input, expected]) => expect(descopeFeatureName(input)).toEqual(expected));
  });
});

describe('utils.escapeDoubleQuotes', () => {
  // test cases from https://gist.github.com/getify/3667624

  it('should escape any unescaped double quotes', () => {
    const cases = [
      ['a"b', 'a\\"b'], //
      ['a\\"b', 'a\\"b'], //
      ['a\\\\"b', 'a\\\\\\"b'],
      ['a"b"c', 'a\\"b\\"c'],
      ['a""b', 'a\\"\\"b'],
      ['""', '\\"\\"'],
    ];

    for (const testCase of cases) {
      const [input, expected] = testCase;
      expect(escapeDoubleQuotes(input!)).toBe(expected);
    }

    // should return the same input as the output

    const cases2 = ['ab', 'a\\"b', 'a\\\\\\"b'];

    for (const test of cases2) {
      expect(escapeDoubleQuotes(test)).toBe(test);
    }

    // don't unnecessarily escape
    const actual = escapeDoubleQuotes(escapeDoubleQuotes(escapeDoubleQuotes('a"b')));
    expect(actual).toBe('a\\"b');
  });
});
