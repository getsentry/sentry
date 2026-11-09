import type {Node} from '@react-types/shared';

import {
  estimateRowHeight,
  getMountedIndexes,
  getSectionIndexes,
  ROW_HEIGHT_ESTIMATES,
} from './virtualCollectionLayout';

type TestNode = Node<Record<PropertyKey, unknown>>;

function item(key: string, parentKey?: string, props: Record<string, unknown> = {}) {
  return {key, type: 'item', parentKey, props} as TestNode;
}

function section(key: string) {
  return {key, type: 'section', props: {}} as TestNode;
}

// Two sections of two items each, followed by a top-level item.
const sectioned = [
  section('a'),
  item('a-0', 'a'),
  item('a-1', 'a'),
  section('b'),
  item('b-0', 'b'),
  item('b-1', 'b'),
  item('top'),
];

describe('getSectionIndexes', () => {
  it('points each item at its section row', () => {
    expect(getSectionIndexes(sectioned)).toEqual([
      undefined,
      0,
      0,
      undefined,
      3,
      3,
      undefined,
    ]);
  });

  it('leaves items whose section is not in the list without a section row', () => {
    expect(getSectionIndexes([item('orphan', 'missing')])).toEqual([undefined]);
  });
});

describe('getMountedIndexes', () => {
  const none = {focusedIndex: -1, widestIndex: -1, sectionIndexes: []};

  it('mounts only the window when there is nothing else to keep', () => {
    expect(getMountedIndexes({...none, windowIndexes: [4, 5, 6]})).toEqual([4, 5, 6]);
  });

  it('keeps the focused row mounted when it is outside the window', () => {
    expect(
      getMountedIndexes({...none, focusedIndex: 0, windowIndexes: [40, 41]})
    ).toEqual([0, 40, 41]);
  });

  it('keeps the widest row mounted when it is outside the window', () => {
    expect(
      getMountedIndexes({...none, widestIndex: 90, windowIndexes: [40, 41]})
    ).toEqual([40, 41, 90]);
  });

  it('does not repeat a row that is already in the window', () => {
    expect(
      getMountedIndexes({
        ...none,
        focusedIndex: 41,
        widestIndex: 41,
        windowIndexes: [40, 41],
      })
    ).toEqual([40, 41]);
  });

  it('mounts the section row of every mounted row, sorted before its items', () => {
    expect(
      getMountedIndexes({
        focusedIndex: -1,
        widestIndex: -1,
        sectionIndexes: getSectionIndexes(sectioned),
        windowIndexes: [4, 5],
      })
    ).toEqual([3, 4, 5]);
  });

  it('mounts the section row of a focused row outside the window', () => {
    expect(
      getMountedIndexes({
        focusedIndex: 1,
        widestIndex: -1,
        sectionIndexes: getSectionIndexes(sectioned),
        windowIndexes: [4, 5],
      })
    ).toEqual([0, 1, 3, 4, 5]);
  });
});

describe('estimateRowHeight', () => {
  const {regular, withDetails} = ROW_HEIGHT_ESTIMATES.md;
  const gap = 2;

  it('uses the regular height for a row without details', () => {
    expect(estimateRowHeight([item('a')], 0, 'md', gap)).toBe(regular);
  });

  it('uses the taller height for a row with details', () => {
    expect(
      estimateRowHeight([item('a', undefined, {details: 'More'})], 0, 'md', gap)
    ).toBe(withDetails);
  });

  it('scales with the item size', () => {
    expect(estimateRowHeight([item('a')], 0, 'xs', gap)).toBe(
      ROW_HEIGHT_ESTIMATES.xs.regular
    );
  });

  it('adds the gap above a row that is not first in its section', () => {
    expect(estimateRowHeight(sectioned, 2, 'md', gap)).toBe(regular + gap);
  });

  it('adds no gap above the first row of a section', () => {
    expect(estimateRowHeight(sectioned, 1, 'md', gap)).toBe(regular);
    expect(estimateRowHeight(sectioned, 4, 'md', gap)).toBe(regular);
  });

  it('adds no gap to a section row or a row outside any section', () => {
    expect(estimateRowHeight(sectioned, 0, 'md', gap)).toBe(regular);
    expect(estimateRowHeight(sectioned, 6, 'md', gap)).toBe(regular);
  });
});
