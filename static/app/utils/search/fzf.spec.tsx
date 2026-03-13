import {fzf} from 'sentry/utils/search/fzf';

describe('fzf', () => {
  it('merges matched ranges', () => {
    expect(fzf('a_bc', 'abc', false).matches).toEqual([
      [0, 1],
      [2, 4],
    ]);
  });

  it('prioritizes exact matches over partial matches', () => {
    const pattern = 'path';
    const options = ['binary_path', 'code.file.path', 'path'];

    const [binaryPath, codeFilePath, exactPath] = options.map(option =>
      fzf(option, pattern, false)
    );

    // Verify all options matched
    expect(binaryPath!.end).not.toBe(-1);
    expect(codeFilePath!.end).not.toBe(-1);
    expect(exactPath!.end).not.toBe(-1);

    // Exact match should have a higher score than all partial matches
    expect(exactPath!.score).toBeGreaterThan(binaryPath!.score);
    expect(exactPath!.score).toBeGreaterThan(codeFilePath!.score);
  });
});
