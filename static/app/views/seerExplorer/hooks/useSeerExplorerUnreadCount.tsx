import {useCallback, useMemo, useSyncExternalStore} from 'react';

import {localStorageWrapper} from 'sentry/utils/localStorage';
import {useSeerExplorerPolling} from 'sentry/views/seerExplorer/hooks/useSeerExplorerPolling';
import {useSeerExplorerRunId} from 'sentry/views/seerExplorer/hooks/useSeerExplorerRunId';

const STORAGE_KEY = 'seer:explorer-last-viewed';
const MAX_TRACKED_RUNS = 50;

type LastViewedMap = Record<string, number>;

let cachedRaw: string | null | undefined;
let cachedMap: LastViewedMap = {};
const listeners = new Set<() => void>();

function readMap(): LastViewedMap {
  const raw = localStorageWrapper.getItem(STORAGE_KEY);
  if (cachedRaw === raw) {
    return cachedMap;
  }
  cachedRaw = raw;
  let parsed: unknown = null;
  if (raw) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      // fall through, treat as empty
    }
  }
  cachedMap =
    parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as LastViewedMap)
      : {};
  return cachedMap;
}

function writeMap(next: LastViewedMap): void {
  const entries = Object.entries(next);
  const pruned =
    entries.length <= MAX_TRACKED_RUNS
      ? next
      : Object.fromEntries(
          entries.sort((a, b) => b[1] - a[1]).slice(0, MAX_TRACKED_RUNS)
        );
  cachedRaw = JSON.stringify(pruned);
  cachedMap = pruned;
  localStorageWrapper.setItem(STORAGE_KEY, cachedRaw);
  listeners.forEach(l => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getServerSnapshot(): LastViewedMap {
  return {};
}

export function markSeerExplorerRead(runId: number | null, upTo?: number): void {
  if (runId === null) {
    return;
  }
  const map = readMap();
  const previous = map[String(runId)] ?? 0;
  const next = Math.max(upTo ?? Date.now(), previous);
  if (next === previous) {
    return;
  }
  writeMap({...map, [String(runId)]: next});
}

export function useSeerExplorerUnreadCount(enabled: boolean) {
  const [runId] = useSeerExplorerRunId();
  const {apiData} = useSeerExplorerPolling({runId: enabled ? runId : null});
  const blocks = apiData?.session?.blocks;

  const map = useSyncExternalStore(subscribe, readMap, getServerSnapshot);
  const lastViewedAt = runId === null ? 0 : (map[String(runId)] ?? 0);

  const latestBlockTimestamp = useMemo(() => {
    if (!blocks?.length) {
      return 0;
    }
    let latest = 0;
    for (const block of blocks) {
      const ts = new Date(block.timestamp).getTime();
      if (Number.isFinite(ts) && ts > latest) {
        latest = ts;
      }
    }
    return latest;
  }, [blocks]);

  const unreadCount = useMemo(() => {
    if (!blocks?.length || runId === null) {
      return 0;
    }
    return blocks.filter(block => {
      if (block.message.role === 'user' || block.loading) {
        return false;
      }
      const ts = new Date(block.timestamp).getTime();
      return Number.isFinite(ts) && ts > lastViewedAt;
    }).length;
  }, [blocks, lastViewedAt, runId]);

  const markAllRead = useCallback(() => {
    markSeerExplorerRead(runId, Math.max(latestBlockTimestamp, Date.now()));
  }, [runId, latestBlockTimestamp]);

  return {unreadCount, markAllRead, latestBlockTimestamp};
}
