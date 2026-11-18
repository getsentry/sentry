import {DEFAULT_RESULTS_LIMIT, getResultsLimit} from './utils';

describe('getResultsLimit', () => {
  it('splits the series budget across queries and y-axes', () => {
    expect(getResultsLimit(1, 1)).toBe(10);
    expect(getResultsLimit(1, 2)).toBe(5);
    expect(getResultsLimit(2, 2)).toBe(2);
  });

  it('falls back to the default without queries or y-axes', () => {
    expect(getResultsLimit(0, 3)).toBe(DEFAULT_RESULTS_LIMIT);
    expect(getResultsLimit(1, 0)).toBe(DEFAULT_RESULTS_LIMIT);
  });

  it('never drops below one group', () => {
    expect(getResultsLimit(1, 12)).toBe(1);
    expect(getResultsLimit(2, 6)).toBe(1);
  });
});
