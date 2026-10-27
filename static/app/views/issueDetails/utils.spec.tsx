import {TagValuesFixture} from 'sentry-fixture/tagvalues';

import {mergeAndSortTagValues} from 'sentry/views/issueDetails/utils';

describe('mergeAndSortTagValues', () => {
  it('merges null and empty values into one entry across both lists', () => {
    const tagValue = TagValuesFixture()[0]!;

    const merged = mergeAndSortTagValues(
      [
        {...tagValue, value: null, count: 5, lastSeen: '2024-01-01T00:00:00Z'},
        {...tagValue, value: '', count: 2, lastSeen: '2024-01-03T00:00:00Z'},
      ],
      [{...tagValue, value: '', count: 3, lastSeen: '2024-01-02T00:00:00Z'}],
      'count'
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]).toEqual(
      expect.objectContaining({count: 10, lastSeen: '2024-01-03T00:00:00Z'})
    );
  });

  it('keeps tag values named like Object properties', () => {
    const tagValue = TagValuesFixture()[0]!;

    const merged = mergeAndSortTagValues(
      [
        {...tagValue, value: 'constructor', count: 1},
        {...tagValue, value: '__proto__', count: 2},
      ],
      [
        {...tagValue, value: 'toString', count: 3},
        {...tagValue, value: '__proto__', count: 4},
      ],
      'count'
    );

    expect(merged.map(({value, count}) => [value, count])).toEqual([
      ['__proto__', 6],
      ['toString', 3],
      ['constructor', 1],
    ]);
    expect(Object.hasOwn(Object.prototype, 'count')).toBe(false);
  });
});
