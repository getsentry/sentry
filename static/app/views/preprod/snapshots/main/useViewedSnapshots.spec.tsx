import {act, renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import type {
  SnapshotDiffPair,
  SnapshotImage,
} from 'sentry/views/preprod/types/snapshotTypes';

import {
  pruneViewed,
  useViewedSnapshots,
  VIEWED_SNAPSHOTS_STORAGE_KEY,
  viewedKeyForImage,
  viewedKeyForPair,
} from './useViewedSnapshots';

const DAY_MS = 24 * 60 * 60 * 1000;

function image(overrides: Partial<SnapshotImage> = {}): SnapshotImage {
  return {
    display_name: null,
    height: 100,
    image_file_name: 'login.png',
    key: 'hash-a',
    tags: null,
    width: 100,
    ...overrides,
  };
}

function pair(baseKey: string, headKey: string): SnapshotDiffPair {
  return {
    base_image: image({image_file_name: 'login.base.png', key: baseKey}),
    head_image: image({key: headKey}),
    diff: null,
    diff_image_key: null,
  };
}

describe('viewed keys', () => {
  it('keys a single image on its name and hash', () => {
    expect(viewedKeyForImage(image())).toBe('login.png:hash-a');
    expect(viewedKeyForImage(image({key: 'hash-b'}))).not.toBe(
      viewedKeyForImage(image())
    );
  });

  it('keys a pair on the head name and both hashes', () => {
    expect(viewedKeyForPair(pair('base-1', 'head-1'))).toBe('login.png:base-1:head-1');
    expect(viewedKeyForPair(pair('base-2', 'head-1'))).not.toBe(
      viewedKeyForPair(pair('base-1', 'head-1'))
    );
    expect(viewedKeyForPair(pair('base-1', 'head-2'))).not.toBe(
      viewedKeyForPair(pair('base-1', 'head-1'))
    );
  });
});

describe('pruneViewed', () => {
  const now = 100 * DAY_MS;

  it('drops entries older than 30 days', () => {
    expect(
      pruneViewed(
        {fresh: now - DAY_MS, edge: now - 30 * DAY_MS, stale: now - 31 * DAY_MS},
        now
      )
    ).toEqual({fresh: now - DAY_MS, edge: now - 30 * DAY_MS});
  });

  it('keeps only the newest 4,000 entries', () => {
    const entries = Object.fromEntries(
      Array.from({length: 4005}, (_, i) => [`k${i}`, now - i])
    );
    const pruned = pruneViewed(entries, now);
    expect(Object.keys(pruned)).toHaveLength(4000);
    expect(pruned).toHaveProperty('k0');
    expect(pruned).toHaveProperty('k3999');
    expect(pruned).not.toHaveProperty('k4000');
  });
});

describe('useViewedSnapshots', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('marks and unmarks a key and persists it', () => {
    const {result} = renderHookWithProviders(useViewedSnapshots);

    act(() => result.current.setViewed(['a'], true));
    expect(result.current.viewed).toHaveProperty('a');
    expect(
      JSON.parse(localStorage.getItem(VIEWED_SNAPSHOTS_STORAGE_KEY)!)
    ).toHaveProperty('a');

    act(() => result.current.setViewed(['a'], false));
    expect(result.current.viewed).not.toHaveProperty('a');
    expect(JSON.parse(localStorage.getItem(VIEWED_SNAPSHOTS_STORAGE_KEY)!)).toEqual({});
  });

  it('marks and unmarks several keys at once', () => {
    const {result} = renderHookWithProviders(useViewedSnapshots);

    act(() => result.current.setViewed(['a', 'b', 'c'], true));
    expect(Object.keys(result.current.viewed).sort()).toEqual(['a', 'b', 'c']);

    act(() => result.current.setViewed(['a', 'b'], false));
    expect(Object.keys(result.current.viewed)).toEqual(['c']);
  });

  it('merges into the latest stored value instead of overwriting it', () => {
    const {result} = renderHookWithProviders(useViewedSnapshots);
    localStorage.setItem(
      VIEWED_SNAPSHOTS_STORAGE_KEY,
      JSON.stringify({fromOtherTab: Date.now()})
    );

    act(() => result.current.setViewed(['a'], true));

    expect(
      Object.keys(JSON.parse(localStorage.getItem(VIEWED_SNAPSHOTS_STORAGE_KEY)!))
    ).toEqual(expect.arrayContaining(['a', 'fromOtherTab']));
  });

  it('ignores corrupt stored values', () => {
    localStorage.setItem(VIEWED_SNAPSHOTS_STORAGE_KEY, '{not json');
    const {result} = renderHookWithProviders(useViewedSnapshots);
    expect(result.current.viewed).toEqual({});

    localStorage.setItem(VIEWED_SNAPSHOTS_STORAGE_KEY, '["a"]');
    const {result: arrayResult} = renderHookWithProviders(useViewedSnapshots);
    expect(arrayResult.current.viewed).toEqual({});
  });
});
