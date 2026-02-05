import {
  computeCommonPrefix,
  computeCommonSuffix,
  trimCommonAffixes,
} from './trimCommonAffixes';

describe('computeCommonPrefix', () => {
  it('returns empty string for empty array', () => {
    expect(computeCommonPrefix([])).toBe('');
  });

  it('returns the full string for a single-element array', () => {
    expect(computeCommonPrefix(['/api/v2/users'])).toBe('/api/v2/users');
  });

  it('finds the common prefix', () => {
    expect(computeCommonPrefix(['/api/v2/users', '/api/v2/teams'])).toBe('/api/v2/');
  });

  it('returns empty string when no common prefix', () => {
    expect(computeCommonPrefix(['Chrome', 'Firefox', 'Safari'])).toBe('');
  });

  it('handles identical strings', () => {
    expect(computeCommonPrefix(['abc', 'abc', 'abc'])).toBe('abc');
  });
});

describe('computeCommonSuffix', () => {
  it('returns empty string for empty array', () => {
    expect(computeCommonSuffix([])).toBe('');
  });

  it('returns the full string for a single-element array', () => {
    expect(computeCommonSuffix(['hello'])).toBe('hello');
  });

  it('finds the common suffix', () => {
    expect(computeCommonSuffix(['users_count', 'teams_count'])).toBe('s_count');
    expect(computeCommonSuffix(['foo.test.ts', 'bar.spec.ts'])).toBe('.ts');
  });

  it('returns empty string when no common suffix', () => {
    expect(computeCommonSuffix(['Chrome', 'Firefox', 'Safari'])).toBe('');
  });

  it('handles identical strings', () => {
    expect(computeCommonSuffix(['abc', 'abc', 'abc'])).toBe('abc');
  });
});

describe('trimCommonAffixes', () => {
  it('returns value unchanged when prefix and suffix are too short', () => {
    expect(trimCommonAffixes('hello', 'he', 'lo')).toBe('hello');
    expect(trimCommonAffixes('hello', '', '')).toBe('hello');
  });

  it('trims prefix longer than 3 characters', () => {
    expect(trimCommonAffixes('/api/v2/users', '/api/v2/', '')).toBe('\u2026users');
  });

  it('trims suffix longer than 3 characters', () => {
    expect(trimCommonAffixes('users_count', '', '_count')).toBe('users\u2026');
  });

  it('trims both prefix and suffix', () => {
    expect(trimCommonAffixes('/api/v2/users_count', '/api/v2/', '_count')).toBe(
      '\u2026users\u2026'
    );
  });

  it('handles overlapping prefix and suffix by only trimming prefix', () => {
    // When prefix + suffix >= value length, only prefix is trimmed
    expect(trimCommonAffixes('abcdef', 'abcdef', 'abcdef')).toBe('\u2026');
    expect(trimCommonAffixes('abcdefgh', 'abcde', 'defgh')).toBe('\u2026fgh');
  });

  it('does not trim affixes of exactly 3 characters', () => {
    expect(trimCommonAffixes('abcusers', 'abc', 'ers')).toBe('abcusers');
  });

  it('trims affixes of 4 characters (just over threshold)', () => {
    expect(trimCommonAffixes('/api/users', '/api', '')).toBe('\u2026/users');
  });
});
