import type {Node} from '@react-types/shared';

import {
  estimateRowHeight,
  getMountedIndexes,
  getSectionIndexes,
  isAfterFirstInSection,
  ROW_HEIGHT_ESTIMATES,
} from './virtualCollectionLayout';

type TestNode = Node<Record<PropertyKey, unknown>>;

function item(key: string, parentKey?: string, props: Record<string, unknown> = {}) {
  return {key, type: 'item', parentKey, props} as TestNode;
}

function section(key: string, childNodes: TestNode[] = []) {
  const node: Partial<TestNode> = {key, type: 'section', props: {}, childNodes};
  return node as TestNode;
}

// Two sections of two items each, followed by a top-level item.
const a0 = item('a-0', 'a');
const a1 = item('a-1', 'a');
const b0 = item('b-0', 'b');
const b1 = item('b-1', 'b');
const sectionA = section('a', [a0, a1]);
const sectionB = section('b', [b0, b1]);
const sectioned = [sectionA, a0, a1, sectionB, b0, b1, item('top')];

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

describe('isAfterFirstInSection', () => {
  it('is true for an item after the first in its section', () => {
    expect(isAfterFirstInSection(a1, sectionA)).toBe(true);
  });

  it('is false for the first item of a section', () => {
    expect(isAfterFirstInSection(a0, sectionA)).toBe(false);
  });

  it('is false for an item outside the given section', () => {
    expect(isAfterFirstInSection(a1, sectionB)).toBe(false);
    expect(isAfterFirstInSection(item('top'), undefined)).toBe(false);
  });
});

describe('estimateRowHeight', () => {
  const {regular, withDetails} = ROW_HEIGHT_ESTIMATES.md;
  const space = 2;
  it('uses the regular height for a row without details', () => {
    expect(estimateRowHeight(item('a'), undefined, 'md', space)).toBe(regular);
  });

  it('uses the taller height for a row with details', () => {
    expect(
      estimateRowHeight(item('a', undefined, {details: 'More'}), undefined, 'md', space)
    ).toBe(withDetails);
  });

  it('scales with the item size', () => {
    expect(estimateRowHeight(item('a'), undefined, 'xs', space)).toBe(
      ROW_HEIGHT_ESTIMATES.xs.regular
    );
  });

  it('adds the space above a row that is not first in its section', () => {
    expect(estimateRowHeight(a1, sectionA, 'md', space)).toBe(regular + space);
  });

  it('adds no space above the first row of a section', () => {
    expect(estimateRowHeight(a0, sectionA, 'md', space)).toBe(regular);
  });

  it('adds no space to a section row or a row outside any section', () => {
    expect(estimateRowHeight(sectionA, undefined, 'md', space)).toBe(regular);
    expect(estimateRowHeight(item('top'), undefined, 'md', space)).toBe(regular);
  });
});
