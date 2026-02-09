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
    expect(trimCommonAffixes(['abcfoo', 'abcbar'], {minAffixLength: 0})).toEqual([
      '…foo',
      '…bar',
    ]);
  });

  it('returns values unchanged when an empty string is in the array', () => {
    // Empty string shares no characters with anything, so both affixes drop to 0
    expect(trimCommonAffixes(['/api/v2/users', '', '/api/v2/teams'])).toEqual([
      '/api/v2/users',
      '',
      '/api/v2/teams',
    ]);
  });

  it('produces just an ellipsis when prefix trim consumes an entire shorter string', () => {
    // Common prefix is 'abcde' (5 chars). Slicing the shorter string leaves nothing.
    expect(trimCommonAffixes(['abcdefgh', 'abcde'])).toEqual(['…fgh', '…']);
  });

  it('constrains prefix to the shortest string length', () => {
    // The short string '/api/v2/u' (9 chars) limits the raw prefix to 9
    expect(trimCommonAffixes(['/api/v2/users/list', '/api/v2/u'])).toEqual([
      '…sers/list',
      '…',
    ]);
  });

  it('handles many strings where one outlier constrains the prefix', () => {
    // First three share '/api/v2/' but the fourth only shares '/api/'
    expect(
      trimCommonAffixes([
        '/api/v2/users',
        '/api/v2/teams',
        '/api/v2/projects',
        '/api/other',
      ])
    ).toEqual(['…v2/users', '…v2/teams', '…v2/projects', '…other']);
  });

  it('trims strings that differ only in the last character', () => {
    expect(trimCommonAffixes(['configX', 'configY', 'configZ'])).toEqual([
      '…X',
      '…Y',
      '…Z',
    ]);
  });

  it('does not trim two-character strings even when identical prefix', () => {
    // Common prefix is 1 char, well below threshold
    expect(trimCommonAffixes(['ax', 'ay'])).toEqual(['ax', 'ay']);
  });

  describe('separator snapping', () => {
    it('snaps prefix to last separator, keeping separator visible', () => {
      // Raw prefix '/api/v2/pro' (11 chars) snaps to '/' at index 7.
      // Visible remainder starts WITH the '/' → '…/projects/frontend'
      expect(
        trimCommonAffixes(
          [
            '/api/v2/projects/frontend',
            '/api/v2/projects/backend',
            '/api/v2/processing/queue',
          ],
          {separator: '/'}
        )
      ).toEqual(['…/projects/frontend', '…/projects/backend', '…/processing/queue']);
    });

    it('keeps prefix at boundary with separator visible', () => {
      // Raw prefix '/api/v2/' (8 chars). Last '/' at 7 → snap to 7.
      // Visible: '/users', '/teams'
      expect(
        trimCommonAffixes(['/api/v2/users', '/api/v2/teams'], {separator: '/'})
      ).toEqual(['…/users', '…/teams']);
    });

    it('falls back to raw prefix when no separator in strings', () => {
      expect(trimCommonAffixes(['abcdusers', 'abcdteams'], {separator: '/'})).toEqual([
        '…users',
        '…teams',
      ]);
    });

    it('cuts mid-segment without separator option (backward compat)', () => {
      // Raw prefix '/api/v2/pro' (11 chars) is NOT snapped — trims mid-word
      expect(
        trimCommonAffixes([
          '/api/v2/projects/frontend',
          '/api/v2/projects/backend',
          '/api/v2/processing/queue',
        ])
      ).toEqual(['…jects/frontend', '…jects/backend', '…cessing/queue']);
    });

    it('drops prefix when snap reduces below minAffixLength', () => {
      // Common prefix 'ab' (2 chars), snap finds no '/' → keeps 2.
      // 2 ≤ 3 (default threshold) → no trim
      expect(trimCommonAffixes(['abfoo', 'abbar'], {separator: '/'})).toEqual([
        'abfoo',
        'abbar',
      ]);
    });

    it('snaps suffix to nearest separator boundary', () => {
      // Raw suffix '_end' (4 chars). No '/' in suffix region → keeps raw boundary.
      expect(trimCommonAffixes(['foo/one_end', 'bar/two_end'], {separator: '/'})).toEqual(
        ['foo/one…', 'bar/two…']
      );

      // Suffix '/shared' (7 chars). '/' at cut point → snap keeps same boundary.
      expect(
        trimCommonAffixes(['prefix/seg1/shared', 'prefix/seg2/shared'], {
          separator: '/',
        })
      ).toEqual(['…/seg1…', '…/seg2…']);
    });

    it('keeps raw suffix when no separator exists between cut point and end', () => {
      // Raw suffix 'shared' (6 chars). No '/' in that region → raw is kept.
      expect(
        trimCommonAffixes(['a/foo/xxshared', 'b/bar/yyshared'], {separator: '/'})
      ).toEqual(['a/foo/xx…', 'b/bar/yy…']);
    });

    it('snaps suffix inward when raw boundary cuts mid-segment', () => {
      // Raw suffix 'x/shared/tail' (13 chars) starts mid-segment ('x' is part of 'segAx').
      // Snap finds '/' at cutPoint+1, snaps to '/shared/tail' (12 chars).
      expect(
        trimCommonAffixes(['abc/segAx/shared/tail', 'xyz/segBx/shared/tail'], {
          separator: '/',
        })
      ).toEqual(['abc/segAx…', 'xyz/segBx…']);

      // Without separator, raw 13 chars removes the partial 'x' too
      expect(
        trimCommonAffixes(['abc/segAx/shared/tail', 'xyz/segBx/shared/tail'])
      ).toEqual(['abc/segA…', 'xyz/segB…']);
    });

    it('snaps back further with multi-character separator', () => {
      // Raw prefix 'data::key_' (10 chars). '::' at index 4 → snap to 4.
      // Visible: '::key_alpha'. Separator remains visible as structural context.
      expect(
        trimCommonAffixes(['data::key_alpha', 'data::key_beta'], {separator: '::'})
      ).toEqual(['…::key_alpha', '…::key_beta']);
    });

    it('treats empty separator string as a no-op', () => {
      expect(trimCommonAffixes(['abcdusers', 'abcdteams'], {separator: ''})).toEqual([
        '…users',
        '…teams',
      ]);
    });

    it('handles identical paths by applying overlap guard after snapping', () => {
      // Identical strings: raw prefix = suffix = 13.
      // Snap prefix: '/' at index 7 → snappedPrefix = 7.
      // Snap suffix: cutPoint = 0, '/' at 0 → snappedSuffix = 13.
      // 7 + 13 >= 13 → overlap → prefix only.
      expect(
        trimCommonAffixes(['/api/v2/users', '/api/v2/users'], {separator: '/'})
      ).toEqual(['…/users', '…/users']);
    });

    it('prevents prefix trim when snap reduces a large raw prefix below threshold', () => {
      // Raw prefix 'a/bbbbb' (7 chars > 3, would normally be trimmed).
      // Snap finds '/' at index 1, snaps to 1. 1 ≤ 3 → NOT trimmed.
      expect(trimCommonAffixes(['a/bbbbbccc', 'a/bbbbbddd'], {separator: '/'})).toEqual([
        'a/bbbbbccc',
        'a/bbbbbddd',
      ]);

      // Without separator: raw 7 > 3 → trims mid-segment
      expect(trimCommonAffixes(['a/bbbbbccc', 'a/bbbbbddd'])).toEqual(['…ccc', '…ddd']);
    });

    it('prevents suffix trim when snap reduces a large raw suffix below threshold', () => {
      // Raw suffix 'ab/cd' (5 chars > 3, would normally be trimmed).
      // Snap: cutPoint = 1, '/' at index 3 → snappedSuffix = 3. 3 ≤ 3 → NOT trimmed.
      expect(trimCommonAffixes(['Xab/cd', 'Yab/cd'], {separator: '/'})).toEqual([
        'Xab/cd',
        'Yab/cd',
      ]);

      // Without separator: raw 5 > 3 → trims
      expect(trimCommonAffixes(['Xab/cd', 'Yab/cd'])).toEqual(['X…', 'Y…']);
    });

    it('does not trim when only the separator itself is common', () => {
      // Common prefix '/' (1 char). Snap: '/' at index 0 → snappedPrefix = 0.
      // 0 is not > anything, so no trim — there's nothing before the separator.
      expect(
        trimCommonAffixes(['/xxxx', '/yyyy'], {minAffixLength: 0, separator: '/'})
      ).toEqual(['/xxxx', '/yyyy']);
    });

    it('handles consecutive separators in paths', () => {
      // Raw prefix '//ab' (4 chars > 3). Snap: lastIndexOf('/', 3) → '/' at index 1.
      // snappedPrefix = 1. 1 ≤ 3 → no trim.
      expect(trimCommonAffixes(['//abXfoo', '//abYbar'], {separator: '/'})).toEqual([
        '//abXfoo',
        '//abYbar',
      ]);

      // Without separator: raw 4 > 3 → trims mid-segment
      expect(trimCommonAffixes(['//abXfoo', '//abYbar'])).toEqual(['…Xfoo', '…Ybar']);
    });

    it('snaps both prefix and suffix in the same call', () => {
      // Raw prefix 'a/common/seg' (12 chars) → snap to '/' at 8 → snappedPrefix = 8.
      // Raw suffix '/suffix/z' (9 chars) → already at '/' → stays 9.
      // prefix 8, suffix 9, total 17 < 22. Both > 3.
      // After prefix: '…/seg1/suffix/z'. After suffix (remove 9): '…/seg1…'.
      expect(
        trimCommonAffixes(['a/common/seg1/suffix/z', 'a/common/seg2/suffix/z'], {
          separator: '/',
        })
      ).toEqual(['…/seg1…', '…/seg2…']);
    });

    it('handles an outlier that constrains prefix, with separator adjusting', () => {
      // Outlier '/api/other' constrains raw prefix to '/api/' (5 chars).
      // Snap: lastIndexOf('/', 4) → '/' at index 4 → snappedPrefix = 4.
      // 4 > 3 → trim.
      expect(
        trimCommonAffixes(
          ['/api/v2/users', '/api/v2/teams', '/api/v2/projects', '/api/other'],
          {separator: '/'}
        )
      ).toEqual(['…/v2/users', '…/v2/teams', '…/v2/projects', '…/other']);
    });

    it('handles an outlier where separator snaps prefix below threshold', () => {
      // Without outlier, prefix would be '/api/v2/' (8 chars).
      // Outlier 'x/other' constrains raw prefix to just 0 (no common chars).
      // No trim at all.
      expect(
        trimCommonAffixes(['/api/v2/users', '/api/v2/teams', 'x/other'], {
          separator: '/',
        })
      ).toEqual(['/api/v2/users', '/api/v2/teams', 'x/other']);
    });

    it('handles short string constraining prefix with separator snap', () => {
      // Short string '/api/v2/u' constrains raw prefix to 9 chars.
      // Snap: lastIndexOf('/', 8) → '/' at 7 → snappedPrefix = 7.
      // 7 > 3 → trim. Visible starts with '/'.
      expect(
        trimCommonAffixes(['/api/v2/users/list', '/api/v2/u'], {separator: '/'})
      ).toEqual(['…/users/list', '…/u']);
    });
  });
});
