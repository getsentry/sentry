import {
  buildKeyValueTree,
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

    expect(column?.map(row => [row.treeKey, row.spacerCount, row.hasStem])).toEqual([
      ['device', 0, false],
      ['model', 1, false],
      ['version', 2, false],
      ['family', 1, false],
      ['os', 0, true],
    ]);
  });

  it('returns no columns when the tree is empty', () => {
    const columns = getKeyValueTreeColumns(new Map(), 3);

    expect(columns).toEqual([]);
  });

  it('draws a stem on a childless branch when a sibling follows it', () => {
    const tree = buildKeyValueTree([item('os.name', 'macOS'), item('os.version', '15')]);

    const [column] = getKeyValueTreeColumns(tree, 1);

    expect(column?.map(row => [row.treeKey, row.hasStem])).toEqual([
      ['os', false],
      ['name', true],
      ['version', false],
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
