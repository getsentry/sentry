import {distributeRowGroupsIntoColumns} from 'sentry/components/keyValueTree/utils';

describe('distributeRowGroupsIntoColumns', () => {
  it('returns no columns when there are no row groups', () => {
    const columns = distributeRowGroupsIntoColumns([], 3);

    expect(columns).toEqual([]);
  });

  it('keeps every group in one column when the column count is one', () => {
    const columns = distributeRowGroupsIntoColumns([['a'], ['b', 'c'], ['d']], 1);

    expect(columns).toEqual([[['a'], ['b', 'c'], ['d']]]);
  });

  it('splits groups into columns without breaking up a group when there are multiple columns', () => {
    const columns = distributeRowGroupsIntoColumns(
      [['a', 'a1', 'a2'], ['b'], ['c', 'c1'], ['d']],
      2
    );

    expect(columns).toEqual([
      [['a', 'a1', 'a2'], ['b']],
      [['c', 'c1'], ['d']],
    ]);
  });
});
