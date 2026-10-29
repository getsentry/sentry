import {act, renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {
  pruneViewed,
  useViewedSnapshots,
  VIEWED_SNAPSHOTS_STORAGE_KEY,
} from './useViewedSnapshots';

const DAY_MS = 24 * 60 * 60 * 1000;

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
    expect(pruned).toHaveProperty('k3999');
    expect(pruned).not.toHaveProperty('k4000');
  });

  it('keeps every key from the current change even past the limit', () => {
    const marked = Array.from({length: 4001}, (_, i) => `new${i}`);
    const entries = {
      old: now - DAY_MS,
      ...Object.fromEntries(marked.map(key => [key, now])),
    };
    const pruned = pruneViewed(entries, now, new Set(marked));
    expect(Object.keys(pruned)).toHaveLength(4001);
    expect(pruned).not.toHaveProperty('old');
  });
});

describe('useViewedSnapshots', () => {
  beforeEach(() => {
    localStorage.clear();
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
});
