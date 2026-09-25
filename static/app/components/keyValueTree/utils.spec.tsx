import {
  buildKeyValueTree,
  distributeRowGroupsIntoColumns,
  getKeyValueTreeColumns,
} from 'sentry/components/keyValueTree/utils';

function item(key: string, value: string) {
  return {key, value, original: {key, value}};
}

describe('buildKeyValueTree', () => {
  it('keeps a key flat when it has no branches', () => {
    const tree = buildKeyValueTree([item('os', 'macOS')]);

    expect(Array.from(tree.keys())).toEqual(['os']);
    expect(tree.get('os')?.value).toBe('macOS');
  });

  it('nests keys under a shared trunk when they share a prefix', () => {
    const tree = buildKeyValueTree([
      item('device.model', 'iPhone'),
      item('device.family', 'Apple'),
    ]);

    expect(Array.from(tree.keys())).toEqual(['device']);
    expect(tree.get('device')?.value).toBe('');
    expect(Array.from(tree.get('device')!.subtree.keys())).toEqual(['model', 'family']);
  });

  it('keeps a key flat when it nests deeper than the maximum depth', () => {
    const tree = buildKeyValueTree([item('a.b.c.d.e.f', 'deep')]);

    expect(Array.from(tree.keys())).toEqual(['a.b.c.d.e.f']);
  });

  it('keeps a key flat when it contains sequential dots', () => {
    const tree = buildKeyValueTree([item('some..key', 'value')]);

    expect(Array.from(tree.keys())).toEqual(['some..key']);
  });

  it('keeps the existing branches when a trunk also arrives as a flat key', () => {
    const tree = buildKeyValueTree([
      item('device.model', 'iPhone'),
      item('device', 'mobile'),
    ]);

    expect(tree.get('device')?.value).toBe('mobile');
    expect(tree.get('device')?.subtree.get('model')?.value).toBe('iPhone');
  });

  it('drops a key when it is empty', () => {
    const tree = buildKeyValueTree([item('', 'value')]);

    expect(tree.size).toBe(0);
  });
});

describe('getKeyValueTreeColumns', () => {
  it('returns rows in render order with a spacer per level of nesting', () => {
    const tree = buildKeyValueTree([
      item('device.model.version', '17'),
      item('device.family', 'Apple'),
      item('os', 'macOS'),
    ]);

    const [column] = getKeyValueTreeColumns(tree, 1);

    expect(column?.map(row => [row.treeKey, row.spacerCount, row.isLast])).toEqual([
      ['device', 0, false],
      ['model', 1, false],
      ['version', 2, true],
      ['family', 1, true],
      ['os', 0, false],
    ]);
  });

  it('keeps a trunk and its branches in one column when splitting into columns', () => {
    const tree = buildKeyValueTree([
      item('a.b', '1'),
      item('a.c', '2'),
      item('d', '3'),
      item('e.f', '4'),
    ]);

    const columns = getKeyValueTreeColumns(tree, 2);

    expect(columns.map(column => column.map(row => row.treeKey))).toEqual([
      ['a', 'b', 'c'],
      ['d', 'e', 'f'],
    ]);
  });
});

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
