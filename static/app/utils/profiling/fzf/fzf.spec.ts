import {fzf} from 'sentry/utils/profiling/fzf/fzf';

describe('fzf', () => {
  it('merges matched ranges', () => {
    expect(fzf('a_bc', 'abc', false).matches).toEqual([
      [0, 1],
      [2, 4],
    ]);
  });
});
