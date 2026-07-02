import type {
  SnapshotDiffPair,
  SnapshotImage,
} from 'sentry/views/preprod/types/snapshotTypes';

import {imageMatchesTagFilters, narrowItemByTags} from './tagFiltering';

function makeImage(
  overrides: Partial<SnapshotImage> & {image_file_name: string}
): SnapshotImage {
  return {
    key: overrides.image_file_name,
    display_name: null,
    height: 100,
    width: 100,
    tags: null,
    ...overrides,
  };
}

function makePair(head: SnapshotImage, base?: Partial<SnapshotImage>): SnapshotDiffPair {
  return {
    head_image: head,
    base_image: makeImage({
      image_file_name: base?.image_file_name ?? `base_${head.image_file_name}`,
      ...base,
    }),
    diff: 0.05,
    diff_image_key: null,
  };
}

describe('imageMatchesTagFilters', () => {
  it('returns false when image has no tags', () => {
    const img = makeImage({image_file_name: 'a.png', tags: null});
    expect(imageMatchesTagFilters(img, {os: 'iOS'})).toBe(false);
  });

  it('returns true when image tags match all filters', () => {
    const img = makeImage({
      image_file_name: 'a.png',
      tags: {os: 'iOS', theme: 'dark'},
    });
    expect(imageMatchesTagFilters(img, {os: 'iOS', theme: 'dark'})).toBe(true);
  });

  it('returns false when one filter key does not match', () => {
    const img = makeImage({
      image_file_name: 'a.png',
      tags: {os: 'iOS', theme: 'dark'},
    });
    expect(imageMatchesTagFilters(img, {os: 'iOS', theme: 'light'})).toBe(false);
  });

  it('returns false when filter key is absent from image tags', () => {
    const img = makeImage({
      image_file_name: 'a.png',
      tags: {os: 'iOS'},
    });
    expect(imageMatchesTagFilters(img, {theme: 'dark'})).toBe(false);
  });

  it('returns true when filters are empty (vacuously true)', () => {
    const img = makeImage({
      image_file_name: 'a.png',
      tags: {os: 'iOS'},
    });
    expect(imageMatchesTagFilters(img, {})).toBe(true);
  });
});

describe('narrowItemByTags', () => {
  it('returns null when no images match', () => {
    const item = {
      type: 'added' as const,
      key: 'added:group',
      name: 'group',
      displayName: 'group',
      images: [
        makeImage({image_file_name: 'a.png', tags: {os: 'iOS'}}),
        makeImage({image_file_name: 'b.png', tags: {os: 'iOS'}}),
      ],
    };
    expect(narrowItemByTags(item, {os: 'Android'})).toBeNull();
  });

  it('returns the original item when all images match', () => {
    const item = {
      type: 'added' as const,
      key: 'added:group',
      name: 'group',
      displayName: 'group',
      images: [
        makeImage({image_file_name: 'a.png', tags: {os: 'iOS'}}),
        makeImage({image_file_name: 'b.png', tags: {os: 'iOS'}}),
      ],
    };
    const result = narrowItemByTags(item, {os: 'iOS'});
    expect(result).toBe(item);
  });

  it('returns a narrowed item when some images match', () => {
    const matching = makeImage({image_file_name: 'a.png', tags: {os: 'iOS'}});
    const item = {
      type: 'added' as const,
      key: 'added:group',
      name: 'group',
      displayName: 'group',
      images: [matching, makeImage({image_file_name: 'b.png', tags: {os: 'Android'}})],
    };
    const result = narrowItemByTags(item, {os: 'iOS'});
    expect(result).not.toBe(item);
    expect(result).toEqual(expect.objectContaining({images: [matching]}));
  });

  it('filters pairs for changed items', () => {
    const matchingHead = makeImage({image_file_name: 'a.png', tags: {os: 'iOS'}});
    const nonMatchingHead = makeImage({image_file_name: 'b.png', tags: {os: 'Android'}});
    const pair1 = makePair(matchingHead);
    const pair2 = makePair(nonMatchingHead);

    const item = {
      type: 'changed' as const,
      key: 'changed:group',
      name: 'group',
      displayName: 'group',
      pairs: [pair1, pair2],
    };
    const result = narrowItemByTags(item, {os: 'iOS'});
    expect(result).toEqual(expect.objectContaining({pairs: [pair1]}));
  });

  it('returns null when all pairs are filtered out', () => {
    const item = {
      type: 'changed' as const,
      key: 'changed:group',
      name: 'group',
      displayName: 'group',
      pairs: [makePair(makeImage({image_file_name: 'a.png', tags: {os: 'iOS'}}))],
    };
    expect(narrowItemByTags(item, {os: 'Android'})).toBeNull();
  });

  it('excludes images with no tags when filters are active', () => {
    const item = {
      type: 'added' as const,
      key: 'added:group',
      name: 'group',
      displayName: 'group',
      images: [
        makeImage({image_file_name: 'a.png', tags: null}),
        makeImage({image_file_name: 'b.png', tags: {os: 'iOS'}}),
      ],
    };
    const result = narrowItemByTags(item, {os: 'iOS'});
    expect(result).toEqual(
      expect.objectContaining({
        images: [expect.objectContaining({image_file_name: 'b.png'})],
      })
    );
  });
});
