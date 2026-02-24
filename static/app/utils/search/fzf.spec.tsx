import {fzf} from 'sentry/utils/search/fzf';

describe('fzf', () => {
  it('merges matched ranges', () => {
    expect(fzf('a_bc', 'abc', false).matches).toEqual([
      [0, 1],
      [2, 4],
    ]);
  });
});
