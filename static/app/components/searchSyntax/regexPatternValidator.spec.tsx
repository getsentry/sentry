import {loadRegexPatternValidator} from 'sentry/components/searchSyntax/regexPatternValidator';

describe('loadRegexPatternValidator', () => {
  it('accepts patterns when RE2 can compile them', async () => {
    const isValid = await loadRegexPatternValidator();

    expect(['^a.*b', '\\pL+', 'GET (api) v2', '[0-9]{1,2}'].map(isValid)).toEqual([
      true,
      true,
      true,
      true,
    ]);
  });

  it('rejects patterns that RE2 cannot compile, including ones native JS accepts', async () => {
    const isValid = await loadRegexPatternValidator();

    expect(
      ['(?=a)b', '(?<=a)b', '(a)\\1', '(unclosed', 'a{2,1}', '[z-a]', 'a**'].map(isValid)
    ).toEqual([false, false, false, false, false, false, false]);
  });

  it('resolves to the same validator when called more than once', async () => {
    const [first, second] = await Promise.all([
      loadRegexPatternValidator(),
      loadRegexPatternValidator(),
    ]);

    expect(first).toBe(second);
  });
});
