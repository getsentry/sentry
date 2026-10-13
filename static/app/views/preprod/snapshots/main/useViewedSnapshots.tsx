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

export function viewedKeyForImage(image: SnapshotImage): string {
  return `${image.image_file_name}:${image.key}`;
}

export function viewedKeyForPair(pair: SnapshotDiffPair): string {
  return `${pair.head_image.image_file_name}:${pair.base_image.key}:${pair.head_image.key}`;
}

export function pruneViewed(entries: ViewedEntries, now: number): ViewedEntries {
  const fresh = Object.entries(entries).filter(
    ([, viewedAt]) => now - viewedAt <= VIEWED_MAX_AGE_MS
  );
  if (fresh.length > VIEWED_MAX_ENTRIES) {
    fresh.sort(([, a], [, b]) => b - a);
    fresh.length = VIEWED_MAX_ENTRIES;
  }
  return Object.fromEntries(fresh);
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
    return Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, number] => typeof entry[1] === 'number'
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
    const pruned = pruneViewed(next, now);
    setViewedState(pruned);
    try {
      localStorageWrapper.setItem(VIEWED_SNAPSHOTS_STORAGE_KEY, JSON.stringify(pruned));
    } catch {
      return;
    }
  }, []);

  return {viewed, setViewed};
}
