import {toSplicedSorted} from 'sentry/utils/array/toSplicedSorted';

const comparator = (a: string, b: string) => a.localeCompare(b);

describe('toSplicedSorted', () => {
  it('returns just the item when original items is empty', () => {
    const actual = toSplicedSorted([], 'a', comparator);
    expect(actual).toEqual(['a']);
  });

  it('adds the item to the end when an insertion index is not found', () => {
    const actual = toSplicedSorted(['a', 'b'], 'c', comparator);
    expect(actual).toEqual(['a', 'b', 'c']);
  });

  it('adds the item to the beginning when the insertion index is the first element', () => {
    const actual = toSplicedSorted(['b', 'c'], 'a', comparator);
    expect(actual).toEqual(['a', 'b', 'c']);
  });

  it('adds the item between elements when the insertion index is inside the array', () => {
    const actual = toSplicedSorted(['a', 'c'], 'b', comparator);
    expect(actual).toEqual(['a', 'b', 'c']);
  });

  it('adds the item to the end when the insertion index is the last element', () => {
    const actual = toSplicedSorted(['a', 'b'], 'c', comparator);
    expect(actual).toEqual(['a', 'b', 'c']);
  });
});
