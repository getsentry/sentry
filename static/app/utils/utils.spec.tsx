import {
  descopeFeatureName,
  escapeDoubleQuotes,
  explodeSlug,
  extractMultilineFields,
} from 'sentry/utils';

describe('utils.extractMultilineFields', function () {
  it('should work for basic, simple values', function () {
    expect(extractMultilineFields('one\ntwo\nthree')).toEqual(['one', 'two', 'three']);
  });

  it('should return an empty array if only whitespace', function () {
    expect(extractMultilineFields('    \n    \n\n\n   \n')).toEqual([]);
  });

  it('should trim values and ignore empty lines', function () {
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
});

describe('utils.explodeSlug', function () {
  it('replaces slug special chars with whitespace', function () {
    expect(explodeSlug('test--slug__replace-')).toEqual('test slug replace');
  });
});

describe('utils.descopeFeatureName', function () {
  it('descopes the feature name', () => {
    [
      ['organizations:feature', 'feature'],
      ['projects:feature', 'feature'],
      ['unknown-scope:feature', 'unknown-scope:feature'],
      ['', ''],
    ].forEach(([input, expected]) => expect(descopeFeatureName(input)).toEqual(expected));
  });
});

describe('utils.escapeDoubleQuotes', function () {
  // test cases from https://gist.github.com/getify/3667624

  it('should escape any unescaped double quotes', function () {
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
