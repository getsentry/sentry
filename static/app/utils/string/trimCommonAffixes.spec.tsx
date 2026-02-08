import {trimCommonAffixes} from './trimCommonAffixes';

describe('trimCommonAffixes', () => {
  it('returns empty array for empty input', () => {
    expect(trimCommonAffixes([])).toEqual([]);
  });

  it('returns single-element array unchanged', () => {
    expect(trimCommonAffixes(['/api/v2/organizations/:orgId/projects'])).toEqual([
      '/api/v2/organizations/:orgId/projects',
    ]);
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
