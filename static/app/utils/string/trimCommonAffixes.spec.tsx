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
  it('returns empty array for empty input', () => {
    expect(trimCommonAffixes([])).toEqual([]);
  });

  it('returns values unchanged when no common affixes', () => {
    expect(trimCommonAffixes(['Chrome', 'Firefox', 'Safari'])).toEqual([
      'Chrome',
      'Firefox',
      'Safari',
    ]);
  });

  it('returns values unchanged when common affixes are too short', () => {
    // Common prefix 'abc' is exactly 3 chars, not over the threshold
    expect(trimCommonAffixes(['abcfoo', 'abcbar'])).toEqual(['abcfoo', 'abcbar']);
  });

  it('trims common prefix longer than 3 characters', () => {
    expect(trimCommonAffixes(['/api/v2/users', '/api/v2/teams'])).toEqual([
      '…users',
      '…teams',
    ]);
  });

  it('trims common suffix longer than 3 characters', () => {
    // Common suffix is 's_count' (7 chars)
    expect(trimCommonAffixes(['users_count', 'teams_count'])).toEqual(['user…', 'team…']);
  });

  it('trims both common prefix and suffix', () => {
    // Common prefix '/api/v2/' (8 chars), common suffix 's_count' (7 chars)
    expect(trimCommonAffixes(['/api/v2/users_count', '/api/v2/teams_count'])).toEqual([
      '…user…',
      '…team…',
    ]);
  });

  it('trims affixes of 4 characters (just over threshold)', () => {
    // Common prefix 'abcd' (4 chars > 3 threshold)
    expect(trimCommonAffixes(['abcdusers', 'abcdteams'])).toEqual(['…users', '…teams']);
  });

  it('handles overlapping prefix and suffix by only trimming prefix', () => {
    // Identical strings: prefix = suffix = whole string, overlap detected
    expect(trimCommonAffixes(['abcdef', 'abcdef'])).toEqual(['…', '…']);
  });

  it('respects custom minAffixLength', () => {
    // With default (3), 'abc' prefix wouldn't be trimmed
    expect(trimCommonAffixes(['abcfoo', 'abcbar'])).toEqual(['abcfoo', 'abcbar']);
    // With minAffixLength 0, it should be trimmed
    expect(trimCommonAffixes(['abcfoo', 'abcbar'], 0)).toEqual(['…foo', '…bar']);
  });
});
