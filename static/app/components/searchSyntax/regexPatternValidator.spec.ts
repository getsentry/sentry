import {loadRegexPatternValidator} from 'sentry/components/searchSyntax/regexPatternValidator';

describe('loadRegexPatternValidator', () => {
  it('returns null when RE2 can compile the pattern', async () => {
    const invalidReason = await loadRegexPatternValidator();

    expect(['^a.*b', '\\pL+', 'GET (api) v2', '[0-9]{1,2}'].map(invalidReason)).toEqual([
      null,
      null,
      null,
      null,
    ]);
  });

  it('returns the RE2 reason for patterns it cannot compile, including ones native JS accepts', async () => {
    const invalidReason = await loadRegexPatternValidator();

    expect(
      ['(?=a)b', '(a)\\1', '(unclosed', 'a{2,1}', '[z-a]', 'a**'].map(invalidReason)
    ).toEqual([
      'invalid or unsupported Perl syntax',
      'invalid escape sequence',
      'missing closing )',
      'invalid repeat count',
      'invalid character class range',
      'invalid nested repetition operator',
    ]);
  });
});
