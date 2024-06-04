import {
  descopeFeatureName,
  escapeDoubleQuotes,
  explodeSlug,
  extractMultilineFields,
  parseRepo,
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

describe('utils.parseRepo', function () {
  it('should work for simple github url', function () {
    expect(parseRepo('github.com/example/example')).toEqual('example/example');
  });
  it('should work for full github url', function () {
    expect(parseRepo('https://github.com/example/example')).toEqual('example/example');
  });
  it('should work for trailing slash', function () {
    expect(parseRepo('https://github.com/example/example/')).toEqual('example/example');
  });
  it('should work for simple BitBucket url', function () {
    expect(parseRepo('bitbucket.org/example/example')).toEqual('example/example');
  });
  it('should work for full BitBucket url', function () {
    expect(parseRepo('https://bitbucket.org/example/example')).toEqual('example/example');
  });
  it('should work for trailing Bitbucket slash', function () {
    expect(parseRepo('https://bitbucket.org/example/example/')).toEqual(
      'example/example'
    );
  });
  it('should work for repo only', function () {
    expect(parseRepo('example/example')).toEqual('example/example');
  });
  it('should parse repo from url with extra info', function () {
    expect(parseRepo('github.com/example/example/commits/adsadsa')).toEqual(
      'example/example'
    );
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
      expect(escapeDoubleQuotes(input)).toBe(expected);
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
