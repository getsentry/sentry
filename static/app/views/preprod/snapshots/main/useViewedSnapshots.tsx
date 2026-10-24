import {useCallback, useState} from 'react';

import {localStorageWrapper} from 'sentry/utils/localStorage';
import type {
  SnapshotDiffPair,
  SnapshotImage,
} from 'sentry/views/preprod/types/snapshotTypes';

export const VIEWED_SNAPSHOTS_STORAGE_KEY = 'snapshot-viewed';
const VIEWED_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const VIEWED_MAX_ENTRIES = 4000;

type ViewedEntries = Record<string, number>;

const hashedKeys = new WeakMap<SnapshotImage | SnapshotDiffPair, string>();

function cyrb53(value: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < value.length; i++) {
    const ch = value.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

function hashOnce(item: SnapshotImage | SnapshotDiffPair, value: string): string {
  let key = hashedKeys.get(item);
  if (key === undefined) {
    key = cyrb53(value);
    hashedKeys.set(item, key);
  }
  return key;
}

export function viewedKeyForImage(image: SnapshotImage): string {
  return hashOnce(image, `${image.image_file_name}:${image.key}`);
}

export function viewedKeyForPair(pair: SnapshotDiffPair): string {
  return hashOnce(
    pair,
    `${pair.head_image.image_file_name}:${pair.base_image.key}:${pair.head_image.key}`
  );
}

function isFresh(viewedAt: number, now: number): boolean {
  return now - viewedAt <= VIEWED_MAX_AGE_MS;
}

export function pruneViewed(
  entries: ViewedEntries,
  now: number,
  keep: ReadonlySet<string> = new Set()
): ViewedEntries {
  const fresh = Object.entries(entries).filter(([, viewedAt]) => isFresh(viewedAt, now));
  if (fresh.length <= VIEWED_MAX_ENTRIES) {
    return Object.fromEntries(fresh);
  }
  const kept = fresh.filter(([key]) => keep.has(key));
  const others = fresh
    .filter(([key]) => !keep.has(key))
    .sort(([, a], [, b]) => b - a)
    .slice(0, Math.max(0, VIEWED_MAX_ENTRIES - kept.length));
  return Object.fromEntries([...kept, ...others]);
}

function readViewed(): ViewedEntries {
  const raw = localStorageWrapper.getItem(VIEWED_SNAPSHOTS_STORAGE_KEY);
  if (raw === null) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return {};
    }
    const now = Date.now();
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, number] =>
          typeof entry[1] === 'number' && isFresh(entry[1], now)
      )
    );
  } catch {
    return {};
  }
}

export function useViewedSnapshots(): {
  setViewed: (keys: string[], isViewed: boolean) => void;
  viewed: ViewedEntries;
} {
  const [viewed, setViewedState] = useState<ViewedEntries>(readViewed);

  const setViewed = useCallback((keys: string[], isViewed: boolean) => {
    const now = Date.now();
    const next = readViewed();
    for (const key of keys) {
      if (isViewed) {
        next[key] = now;
      } else {
        delete next[key];
      }
    }
    const pruned = pruneViewed(next, now, isViewed ? new Set(keys) : undefined);
    setViewedState(pruned);
    try {
      localStorageWrapper.setItem(VIEWED_SNAPSHOTS_STORAGE_KEY, JSON.stringify(pruned));
    } catch {
      return;
    }
  }, []);

  return {viewed, setViewed};
}
