import {fzf} from 'sentry/utils/search/fzf';

describe('fzf', () => {
  it('merges matched ranges', () => {
    expect(fzf('a_bc', 'abc', false).matches).toEqual([
      [0, 1],
      [2, 4],
    ]);
  });

  // TODO: Unskip this test once exact match boosting is implemented (GH-110680)
  // Currently, all three options score identically (104), but exact matches should score higher
  // eslint-disable-next-line jest/no-disabled-tests
  it.skip('prioritizes exact matches over partial matches', () => {
    const pattern = 'path';
    const options = ['binary_path', 'code.file.path', 'path'];

    const results = options.map(option => ({
      option,
      result: fzf(option, pattern, false),
    }));

    const exactMatchResult = results.find(r => r.option === 'path')!;
    const partialMatchResults = results.filter(r => r.option !== 'path');

    // Exact match should have a higher score than all partial matches
    for (const partialMatch of partialMatchResults) {
      expect(exactMatchResult.result.score).toBeGreaterThan(partialMatch.result.score);
    }

    // Verify all options matched
    for (const {result} of results) {
      expect(result.end).not.toBe(-1);
    }
  });
});
