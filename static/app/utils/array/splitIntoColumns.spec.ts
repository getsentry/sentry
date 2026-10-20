import {splitIntoColumns} from 'sentry/utils/array/splitIntoColumns';

describe('splitIntoColumns', () => {
  it('returns no columns when there are no items', () => {
    const columns = splitIntoColumns([], 3);

    expect(columns).toEqual([]);
  });

  it('fills earlier columns first when items do not divide evenly', () => {
    const columns = splitIntoColumns([1, 2, 3, 4, 5], 2);

    expect(columns).toEqual([
      [1, 2, 3],
      [4, 5],
    ]);
  });

  it('gives each item its own column when there are as many columns as items', () => {
    const columns = splitIntoColumns(['a', 'b', 'c'], 3);

    expect(columns).toEqual([['a'], ['b'], ['c']]);
  });

  it('balances columns by size when provided a size getter', () => {
    const columns = splitIntoColumns(['aaaa', 'b', 'c', 'dd'], 2, item => item.length);

    expect(columns).toEqual([['aaaa'], ['b', 'c', 'dd']]);
  });
});
