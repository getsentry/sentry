import {
  descopeFeatureName,
  escapeDoubleQuotes,
  escapeIssueTagKey,
  explodeSlug,
  extractMultilineFields,
  generateQueryWithTag,
  isWebpackChunkLoadingError,
} from 'sentry/utils';

describe('utils.escapeIssueTagKey', () => {
  it('should escape conflicting tag keys', () => {
    expect(escapeIssueTagKey('status')).toBe('tags[status]');
    expect(escapeIssueTagKey('message')).toBe('tags[message]');
  });

  it('should not escape environment and project', () => {
    expect(escapeIssueTagKey('environment')).toBe('environment');
    expect(escapeIssueTagKey('project')).toBe('project');
  });

  it('escapes empty keys for missing tag labels', () => {
    expect(escapeIssueTagKey('')).toBe('""');
  });
});

describe('utils.extractMultilineFields', () => {
  it('should work for basic, simple values', () => {
    expect(extractMultilineFields('one\ntwo\nthree')).toEqual(['one', 'two', 'three']);
  });

  it('should return an empty array if only whitespace', () => {
    expect(extractMultilineFields('    \n    \n\n\n   \n')).toEqual([]);
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

describe('utils.generateQueryWithTag', () => {
  it('produces !has query when tag value missing', () => {
    expect(
      generateQueryWithTag({referrer: 'tag-details-drawer'}, {key: 'device', value: ''})
    ).toEqual({
      referrer: 'tag-details-drawer',
      query: '!has:device',
    });
  });
});

describe('utils.isWebpackChunkLoadingError', () => {
  it('detects standard webpack chunk loading errors', () => {
    const error = new Error('Loading chunk 123 failed');
    expect(isWebpackChunkLoadingError(error)).toBe(true);
  });

  it('detects chunk loading errors with different casing', () => {
    const error = new Error('LOADING CHUNK 456 FAILED');
    expect(isWebpackChunkLoadingError(error)).toBe(true);
  });

  it('detects SyntaxError: Unexpected EOF from incomplete chunks', () => {
    const error = new SyntaxError('Unexpected EOF');
    expect(isWebpackChunkLoadingError(error)).toBe(true);
  });

  it('detects SyntaxError: Unexpected end of script from incomplete chunks', () => {
    const error = new SyntaxError('Unexpected end of script');
    expect(isWebpackChunkLoadingError(error)).toBe(true);
  });

  it('detects SyntaxError: Unexpected end of input from incomplete chunks', () => {
    const error = new SyntaxError('Unexpected end of input');
    expect(isWebpackChunkLoadingError(error)).toBe(true);
  });

  it('handles mixed case in SyntaxError messages', () => {
    const error = new SyntaxError('UNEXPECTED EOF');
    expect(isWebpackChunkLoadingError(error)).toBe(true);
  });

  it('does not detect other SyntaxErrors', () => {
    const error = new SyntaxError('Invalid or unexpected token');
    expect(isWebpackChunkLoadingError(error)).toBe(false);
  });

  it('does not detect other generic errors', () => {
    const error = new Error('Something else went wrong');
    expect(isWebpackChunkLoadingError(error)).toBe(false);
  });

  it('handles null error gracefully', () => {
    expect(isWebpackChunkLoadingError(null as any)).toBe(false);
  });

  it('handles undefined error gracefully', () => {
    expect(isWebpackChunkLoadingError(undefined as any)).toBe(false);
  });

  it('handles error without message gracefully', () => {
    const error = new Error();
    delete (error as any).message;
    expect(isWebpackChunkLoadingError(error)).toBe(false);
  });
});
